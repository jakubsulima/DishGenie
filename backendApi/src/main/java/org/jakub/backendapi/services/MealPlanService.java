package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.dto.RecipeDto;
import org.jakub.backendapi.entities.MealPlan;
import org.jakub.backendapi.exceptions.AppException;
import org.jakub.backendapi.repositories.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;

@Service
public class MealPlanService {
    private final MealPlanRepository plans;
    private final UserRepository users;
    private final FridgeIngredientRepository fridge;
    private final PlanIngredientAggregationService aggregation;
    private final ObjectMapper json;
    private final ShoppingPreferencesService preferences;
    private final OfferFeatureService offerFeature;

    public MealPlanService(MealPlanRepository plans, UserRepository users, FridgeIngredientRepository fridge,
                           PlanIngredientAggregationService aggregation, ObjectMapper json, ShoppingPreferencesService preferences, OfferFeatureService offerFeature) {
        this.plans = plans; this.users = users; this.fridge = fridge;
        this.preferences = preferences; this.aggregation = aggregation; this.json = json;
        this.offerFeature = offerFeature;
    }

    @Transactional
    public View create(String email, Create input) {
        if (input.planningMode() != PlanningMode.PRACTICAL) offerFeature.requireAvailable(email);
        var owner = users.findByEmailForUpdate(email).orElseThrow(() -> error("Unauthorized", HttpStatus.UNAUTHORIZED));
        var existing = plans.findById(input.requestId());
        if (existing.isPresent()) {
            var plan = existing.get();
            if (!plan.getUser().getId().equals(owner.getId()) || !read(plan).settings().equals(input))
                throw error("This request ID has already been used.", HttpStatus.CONFLICT);
            return view(plan);
        }
        LocalDate today = LocalDate.now(ZoneId.of("Europe/Warsaw"));
        if (input.startDate().isBefore(today.minusDays(7)) || input.startDate().isAfter(today.plusYears(1)))
            throw error("Choose a start date within the next year.", HttpStatus.BAD_REQUEST);
        if (input.shopping().shoppingDate() != null && (input.shopping().shoppingDate().isBefore(today)
                || input.planningMode() != PlanningMode.PRACTICAL && input.shopping().shoppingDate().isAfter(today.plusDays(7)) || input.shopping().shoppingDate().isAfter(input.startDate())))
            throw error("Shopping must be within seven days and no later than the first meal.", HttpStatus.BAD_REQUEST);
        List<Slot> slots = new ArrayList<>();
        for (int day = 0; day < input.dayCount(); day++) {
            for (MealType type : MealType.values()) {
                if (input.mealTypes().contains(type)) slots.add(new Slot(UUID.randomUUID(), input.startDate().plusDays(day),
                        type, input.servings(), false, false, null, null, null, null));
            }
        }
        MealPlan plan = new MealPlan();
        plan.setId(input.requestId()); plan.setUser(owner); plan.setCreatedAt(Instant.now());
        preferences.save(email, input);
        return save(plan, new Document(2, input, Status.DRAFT, slots, null));
    }

    @Transactional(readOnly = true)
    public List<Summary> list(String email) { return list(email, 0); }

    @Transactional(readOnly = true)
    public List<Summary> list(String email, int page) {
        if (page < 0) throw error("Page cannot be negative.", HttpStatus.BAD_REQUEST);
        return plans.findByUserEmailOrderByCreatedAtDescIdDesc(email,
                org.springframework.data.domain.PageRequest.of(page, 20)).stream().map(plan -> {
            Document d = read(plan);
            return new Summary(plan.getId(), plan.getVersion(), d.settings().startDate(), d.settings().dayCount(),
                    d.status(), (int) d.slots().stream().filter(s -> s.recipe() != null && !s.skipped()).count(), d.slots().size());
        }).toList();
    }

    @Transactional(readOnly = true)
    public View get(String email, UUID id) {
        return view(plans.findByIdAndUserEmail(id, email).orElseThrow(this::notFound));
    }

    @Transactional
    public View settings(String email, UUID id, SettingsChange input) {
        if (input.settings().planningMode() != PlanningMode.PRACTICAL) offerFeature.requireAvailable(email);
        MealPlan plan = owned(email, id); checkVersion(plan, input.version()); Document d = read(plan); assertIdle(d);
        Create old = d.settings(); Create next = input.settings();
        if (!old.startDate().equals(next.startDate()) || old.dayCount() != next.dayCount() || old.servings() != next.servings()
                || !old.mealTypes().equals(next.mealTypes()) || !old.locale().equals(next.locale()))
            throw error("Change dates, meal types and people by creating a new plan; individual portions can be edited separately.", HttpStatus.BAD_REQUEST);
        LocalDate day = next.shopping().shoppingDate(); LocalDate today = LocalDate.now(ZoneId.of("Europe/Warsaw"));
        // A saved shopping date can pass while the rest of the week's settings remain editable.
        if (day != null && !Objects.equals(day, old.shopping().shoppingDate())
                && (day.isBefore(today) || next.planningMode() != PlanningMode.PRACTICAL && day.isAfter(today.plusDays(7)) || day.isAfter(next.startDate())))
            throw error("Choose a shopping date in the next seven days, no later than the first meal.", HttpStatus.BAD_REQUEST);
        Create settings = new Create(old.requestId(), old.startDate(), old.dayCount(), old.servings(), old.mealTypes(), next.stores(),
                next.budget(), old.locale(), next.maxMinutes(), next.planningMode(), next.budgetMode(), next.shopping());
        preferences.save(email, settings);
        return save(plan, new Document(d.schemaVersion(), settings, Status.DRAFT, d.slots(), synchronizedShopping(plan, d, d.slots()), d.cycle()));
    }

    @Transactional
    public View change(String email, UUID id, UUID slotId, Change input) {
        MealPlan plan = owned(email, id);
        checkVersion(plan, input.version());
        Document d = read(plan);
        assertIdle(d);
        Slot target = slot(d, slotId);
        if (input.action() != Action.LOCK && input.action() != Action.UNLOCK && d.cycle() != null && d.cycle().batches().stream().anyMatch(b -> b.allocations().stream().anyMatch(a -> a.slotId().equals(slotId) && !a.status().equals("SKIPPED"))))
            throw conflict("Use the cooking batch preview to change this meal.");
        if (target.locked() && input.action() != Action.UNLOCK) throw conflict("Unlock this meal before changing it.");
        if (input.action() == Action.LOCK && (target.recipe() == null || target.skipped()))
            throw conflict("Only a planned meal can be locked.");
        if (input.action() == Action.SERVINGS && input.servings() == null)
            throw error("Servings are required.", HttpStatus.BAD_REQUEST);
        Slot updated = new Slot(target.id(), target.date(), target.mealType(),
                input.action() == Action.SERVINGS ? input.servings() : target.servings(),
                input.action() == Action.LOCK || (input.action() != Action.UNLOCK && target.locked()),
                input.action() == Action.SKIP || (input.action() != Action.RESTORE && target.skipped()),
                target.recipe(), target.generationId(), target.generationStatus(), target.generationStartedAt());
        boolean contentChanged = input.action() != Action.LOCK && input.action() != Action.UNLOCK;
        return save(plan, new Document(d.schemaVersion(), d.settings(), contentChanged ? Status.DRAFT : d.status(),
                replace(d.slots(), updated), contentChanged ? synchronizedShopping(plan, d, replace(d.slots(), updated)) : d.shopping(), d.cycle()));
    }

    @Transactional
    public GenerationWork beginGeneration(String email, UUID id, UUID slotId, Generate input) {
        MealPlan plan = owned(email, id);
        Document d = read(plan);
        Slot target = slot(d, slotId);
        if (d.cycle() != null && d.cycle().batches().stream().anyMatch(b -> b.allocations().stream().anyMatch(a -> a.slotId().equals(slotId) && !a.status().equals("SKIPPED"))))
            throw conflict("Use the cooking batch preview to change this meal.");
        if (input.requestId().equals(target.generationId())) {
            if (target.generationStatus() == GenerationStatus.COMPLETED)
                return new GenerationWork(view(plan), target, false);
            if (target.generationStatus() == GenerationStatus.RUNNING && isRunning(target))
                throw conflict("This meal is still being generated. Refresh the plan shortly.");
            throw conflict("The previous attempt ended. Refresh the plan and try again.");
        }
        checkVersion(plan, input.version());
        assertIdle(d);
        if (target.locked() || target.skipped()) throw conflict("Unlock or restore this meal before generating it.");
        Slot running = new Slot(target.id(), target.date(), target.mealType(), target.servings(), false, false,
                target.recipe(), input.requestId(), GenerationStatus.RUNNING, Instant.now());
        View result = save(plan, new Document(d.schemaVersion(), d.settings(), d.status(), replace(d.slots(), running), d.shopping(), d.cycle()));
        return new GenerationWork(result, running, true);
    }

    @Transactional
    public View finishGeneration(String email, UUID id, UUID slotId, UUID requestId, long version, RecipeDto recipe) {
        MealPlan plan = owned(email, id);
        checkVersion(plan, version);
        Document d = read(plan);
        Slot target = slot(d, slotId);
        if (d.cycle() != null && d.cycle().batches().stream().anyMatch(b -> b.allocations().stream().anyMatch(a -> a.slotId().equals(slotId) && !a.status().equals("SKIPPED"))))
            throw conflict("Use the cooking batch preview to change this meal.");
        if (!requestId.equals(target.generationId()) || target.generationStatus() != GenerationStatus.RUNNING)
            throw conflict("This generation has been replaced. Refresh the plan.");
        Slot done = new Slot(target.id(), target.date(), target.mealType(), target.servings(), false, false,
                recipe, requestId, GenerationStatus.COMPLETED, target.generationStartedAt());
        var completedSlots = replace(d.slots(), done);
        var cycle = d.cycle();
        if (cycle != null && cycle.exceptions().stream().anyMatch(e -> e.date().equals(target.date()) && e.mealType() == target.mealType() && e.cookForNext() && !e.skipped())) {
            var next = d.slots().stream().filter(s -> s.mealType() == target.mealType() && s.date().isAfter(target.date()) && !s.skipped())
                .min(Comparator.comparing(Slot::date)).orElseThrow(() -> conflict("No later meal is available for these portions."));
            if (next.recipe() != null || next.locked()) throw conflict("The meal for tomorrow is occupied.");
            var batches = new ArrayList<>(cycle.batches());
            batches.add(new org.jakub.backendapi.dto.WeekCycleDto.Batch(target.id(), target.date(), recipe, target.servings() + next.servings(), "PLANNED",
                List.of(new org.jakub.backendapi.dto.WeekCycleDto.Allocation(target.id(), target.servings(), "PLANNED"),
                    new org.jakub.backendapi.dto.WeekCycleDto.Allocation(next.id(), next.servings(), "PLANNED")), null, false, null));
            cycle = new org.jakub.backendapi.dto.WeekCycleDto.Cycle(cycle.exceptions(), cycle.priorityFridgeIds(), batches, cycle.inventoryReview());
            completedSlots = replace(completedSlots, new Slot(next.id(), next.date(), next.mealType(), next.servings(), false, false, recipe, null, null, null));
        }
        var nextDocument = new Document(d.schemaVersion(), d.settings(), Status.DRAFT, completedSlots, null, cycle);
        return save(plan, new Document(d.schemaVersion(), d.settings(), Status.DRAFT, completedSlots, synchronizedShopping(plan, nextDocument, completedSlots), cycle));
    }

    @Transactional
    public void failGeneration(String email, UUID id, UUID slotId, UUID requestId) {
        MealPlan plan = owned(email, id);
        Document d = read(plan);
        Slot target = slot(d, slotId);
        if (d.cycle() != null && d.cycle().batches().stream().anyMatch(b -> b.allocations().stream().anyMatch(a -> a.slotId().equals(slotId) && !a.status().equals("SKIPPED"))))
            throw conflict("Use the cooking batch preview to change this meal.");
        if (!requestId.equals(target.generationId()) || target.generationStatus() != GenerationStatus.RUNNING) return;
        Slot failed = new Slot(target.id(), target.date(), target.mealType(), target.servings(), target.locked(), target.skipped(),
                target.recipe(), requestId, GenerationStatus.FAILED, target.generationStartedAt());
        save(plan, new Document(d.schemaVersion(), d.settings(), d.status(), replace(d.slots(), failed), d.shopping(), d.cycle()));
    }

    @Transactional
    public View accept(String email, UUID id, Version input) {
        MealPlan plan = owned(email, id);
        Document d = read(plan);
        checkVersion(plan, input.version());
        if (d.status() == Status.ACCEPTED) return view(plan);
        assertIdle(d);
        if (d.slots().stream().noneMatch(s -> s.recipe() != null && !s.skipped()))
            throw conflict("Plan at least one meal before accepting.");
        Shopping shopping = synchronizedShopping(plan, d, d.slots());
        if (shopping == null) shopping = aggregate(plan, d, d.slots());
        return save(plan, new Document(d.schemaVersion(), d.settings(), Status.ACCEPTED, d.slots(), shopping, d.cycle()));
    }

    @Transactional
    public View refreshShopping(String email, UUID id, Version input) {
        MealPlan plan = owned(email, id);
        checkVersion(plan, input.version());
        Document d = read(plan);
        assertIdle(d);
        if (d.shopping() == null) throw conflict("Create this plan’s shopping list first.");
        return save(plan, new Document(d.schemaVersion(), d.settings(), d.status(), d.slots(), synchronizedShopping(plan, d, d.slots()), d.cycle()));
    }

    /** Pure preview: reads current inventory once without changing the plan. */
    @Transactional(readOnly = true)
    public Shopping previewShopping(String email, UUID id, List<Slot> slots) {
        MealPlan plan = plans.findByIdAndUserEmail(id, email).orElseThrow(this::notFound);
        return aggregate(plan, read(plan), slots);
    }

    @Transactional
    public View revise(String email, UUID id, UUID slotId, long version, RecipeDto recipe) {
        MealPlan plan = owned(email, id);
        checkVersion(plan, version);
        Document d = read(plan); assertIdle(d);
        Slot target = slot(d, slotId);
        if (d.cycle() != null && d.cycle().batches().stream().anyMatch(b -> b.allocations().stream().anyMatch(a -> a.slotId().equals(slotId) && !a.status().equals("SKIPPED"))))
            throw conflict("Use the cooking batch preview to change this meal.");
        if (target.locked() || target.skipped() || target.recipe() == null) throw conflict("Unlock or restore the meal before editing.");
        Slot revised = new Slot(target.id(), target.date(), target.mealType(), target.servings(), false, false,
                recipe, null, null, null);
        var slots = replace(d.slots(), revised);
        // Once a historical plan is translated, future generated meals use Polish too.
        if (recipe.getLocale() == org.jakub.backendapi.entities.Enums.ContentLocale.pl && !"pl".equals(d.settings().locale())) {
            var s = d.settings();
            d = new Document(d.schemaVersion(), new Create(s.requestId(), s.startDate(), s.dayCount(), s.servings(), s.mealTypes(), s.stores(),
                    s.budget(), "pl", s.maxMinutes(), s.planningMode(), s.budgetMode(), s.shopping()), d.status(), d.slots(), d.shopping(), d.cycle());
        }
        return save(plan, new Document(d.schemaVersion(), d.settings(), Status.DRAFT, slots, synchronizedShopping(plan, d, slots), d.cycle()));
    }

    @Transactional
    public View selectBasket(String email, UUID id, long version, String option, org.jakub.backendapi.dto.StoreOfferDto.Quote quote) {
        MealPlan plan = owned(email, id); checkVersion(plan, version); Document d = read(plan); assertIdle(d);
        if (quote.planVersion() != version || quote.baskets().stream().noneMatch(b -> b.option().equals(option))) throw conflict("Basket changed. Refresh prices.");
        Shopping shopping = synchronizedShopping(plan, d, d.slots());
        if (shopping == null) shopping = aggregate(plan, d, d.slots());
        return save(plan, new Document(d.schemaVersion(), d.settings(), d.status(), d.slots(),
                new Shopping(shopping.calculatedAt(), shopping.items(), shopping.checkedKeys(), option, quote), d.cycle()));
    }

    private Shopping aggregate(MealPlan plan, Document d, List<Slot> slots) {
        return aggregation.aggregate(d.withSlots(slots, d.status(), null), d.cycle() != null && d.cycle().inventoryReview() ? List.of() : fridge.findByUser_Id(plan.getUser().getId()), d.settings().locale());
    }
    private Shopping synchronizedShopping(MealPlan plan, Document d, List<Slot> slots) {
        if (d.shopping() == null) return null;
        Shopping calculated = aggregate(plan, d, slots);
        Set<String> checked = new HashSet<>(d.shopping().checkedKeys());
        checked.retainAll(calculated.items().stream().map(ShoppingItem::key).toList());
        return new Shopping(calculated.calculatedAt(), calculated.items(), checked, d.shopping().basketOption(), null);
    }

    @Transactional
    public View syncShopping(String email, UUID id, Generate input) {
        MealPlan plan = owned(email, id); Document d = read(plan);
        if (d.shopping() != null && input.requestId().equals(d.shopping().syncRequestId())) return view(plan);
        checkVersion(plan, input.version()); assertIdle(d);
        if (d.shopping() == null) throw conflict("Create this plan’s shopping list first.");
        Shopping calculated = synchronizedShopping(plan, d, d.slots());
        return save(plan, new Document(d.schemaVersion(), d.settings(), d.status(), d.slots(), new Shopping(calculated.calculatedAt(),
                calculated.items(), calculated.checkedKeys(), calculated.basketOption(), null, input.requestId()), d.cycle()));
    }

    @Transactional
    public View checkShopping(String email, UUID id, Check input) {
        MealPlan plan = owned(email, id);
        checkVersion(plan, input.version());
        Document d = read(plan);
        assertIdle(d);
        Shopping shopping = d.shopping();
        if (shopping == null || shopping.items().stream().noneMatch(i -> i.key().equals(input.key()))) throw notFound();
        Set<String> checked = new HashSet<>(shopping.checkedKeys());
        if (input.checked()) checked.add(input.key()); else checked.remove(input.key());
        return save(plan, new Document(d.schemaVersion(), d.settings(), d.status(), d.slots(),
                new Shopping(shopping.calculatedAt(), shopping.items(), checked, shopping.basketOption(), shopping.quote(), shopping.syncRequestId()), d.cycle()));
    }
    @Transactional
    public View priceChanged(String email, UUID id, long version) {
        MealPlan plan = owned(email, id); checkVersion(plan, version); Document d = read(plan); assertIdle(d);
        plan.markPricesChanged();
        Shopping old = d.shopping();
        Shopping shopping = old == null ? null : new Shopping(old.calculatedAt(), old.items(), old.checkedKeys(), old.basketOption(), null, old.syncRequestId());
        return save(plan, new Document(d.schemaVersion(), d.settings(), d.status(), d.slots(), shopping, d.cycle()));
    }

    private MealPlan owned(String email, UUID id) { return plans.findOwnedForUpdate(id, email).orElseThrow(this::notFound); }
    private Document read(MealPlan plan) { return json.readValue(plan.getDocument(), Document.class); }
    private View view(MealPlan plan) { return new View(plan.getId(), plan.getVersion(), plan.getCreatedAt(), read(plan)); }
    private View save(MealPlan plan, Document document) {
        if (plan.getDocument() != null && read(plan).schemaVersion() > document.schemaVersion())
            throw conflict("Update the planner before changing this document.");
        plan.setDocument(json.writeValueAsString(document));
        return view(plans.saveAndFlush(plan));
    }
    private Slot slot(Document d, UUID id) { return d.slots().stream().filter(s -> s.id().equals(id)).findFirst().orElseThrow(this::notFound); }
    private List<Slot> replace(List<Slot> slots, Slot updated) { return slots.stream().map(s -> s.id().equals(updated.id()) ? updated : s).toList(); }
    private void checkVersion(MealPlan plan, long version) {
        if (plan.getVersion() != version) throw conflict("The plan changed elsewhere. Refresh it before continuing.");
    }
    private void assertIdle(Document d) {
        if (d.slots().stream().anyMatch(this::isRunning)) throw conflict("Wait for the current meal to finish generating.");
    }
    private boolean isRunning(Slot slot) {
        return slot.generationStatus() == GenerationStatus.RUNNING && slot.generationStartedAt() != null
                && slot.generationStartedAt().isAfter(Instant.now().minusSeconds(300));
    }
    private AppException notFound() { return error("Meal plan not found.", HttpStatus.NOT_FOUND); }
    private AppException conflict(String message) { return error(message, HttpStatus.CONFLICT); }
    private AppException error(String message, HttpStatus status) { return new AppException(message, status); }
}
