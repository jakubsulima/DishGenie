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

    public MealPlanService(MealPlanRepository plans, UserRepository users, FridgeIngredientRepository fridge,
                           PlanIngredientAggregationService aggregation, ObjectMapper json) {
        this.plans = plans; this.users = users; this.fridge = fridge;
        this.aggregation = aggregation; this.json = json;
    }

    @Transactional
    public View create(String email, Create input) {
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
        List<Slot> slots = new ArrayList<>();
        for (int day = 0; day < input.dayCount(); day++) {
            for (MealType type : MealType.values()) {
                if (input.mealTypes().contains(type)) slots.add(new Slot(UUID.randomUUID(), input.startDate().plusDays(day),
                        type, input.servings(), false, false, null, null, null, null));
            }
        }
        MealPlan plan = new MealPlan();
        plan.setId(input.requestId()); plan.setUser(owner); plan.setCreatedAt(Instant.now());
        return save(plan, new Document(1, input, Status.DRAFT, slots, null));
    }

    @Transactional(readOnly = true)
    public List<Summary> list(String email) {
        return plans.findTop20ByUserEmailOrderByCreatedAtDesc(email).stream().map(plan -> {
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
    public View change(String email, UUID id, UUID slotId, Change input) {
        MealPlan plan = owned(email, id);
        checkVersion(plan, input.version());
        Document d = read(plan);
        assertIdle(d);
        Slot target = slot(d, slotId);
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
        return save(plan, new Document(1, d.settings(), contentChanged ? Status.DRAFT : d.status(),
                replace(d.slots(), updated), contentChanged ? null : d.shopping()));
    }

    @Transactional
    public GenerationWork beginGeneration(String email, UUID id, UUID slotId, Generate input) {
        MealPlan plan = owned(email, id);
        Document d = read(plan);
        Slot target = slot(d, slotId);
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
        View result = save(plan, new Document(1, d.settings(), d.status(), replace(d.slots(), running), d.shopping()));
        return new GenerationWork(result, running, true);
    }

    @Transactional
    public View finishGeneration(String email, UUID id, UUID slotId, UUID requestId, long version, RecipeDto recipe) {
        MealPlan plan = owned(email, id);
        checkVersion(plan, version);
        Document d = read(plan);
        Slot target = slot(d, slotId);
        if (!requestId.equals(target.generationId()) || target.generationStatus() != GenerationStatus.RUNNING)
            throw conflict("This generation has been replaced. Refresh the plan.");
        Slot done = new Slot(target.id(), target.date(), target.mealType(), target.servings(), false, false,
                recipe, requestId, GenerationStatus.COMPLETED, target.generationStartedAt());
        return save(plan, new Document(1, d.settings(), Status.DRAFT, replace(d.slots(), done), null));
    }

    @Transactional
    public void failGeneration(String email, UUID id, UUID slotId, UUID requestId) {
        MealPlan plan = owned(email, id);
        Document d = read(plan);
        Slot target = slot(d, slotId);
        if (!requestId.equals(target.generationId()) || target.generationStatus() != GenerationStatus.RUNNING) return;
        Slot failed = new Slot(target.id(), target.date(), target.mealType(), target.servings(), target.locked(), target.skipped(),
                target.recipe(), requestId, GenerationStatus.FAILED, target.generationStartedAt());
        save(plan, new Document(1, d.settings(), d.status(), replace(d.slots(), failed), d.shopping()));
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
        Shopping shopping = aggregation.aggregate(d.slots(), fridge.findByUser_Id(plan.getUser().getId()), d.settings().locale());
        return save(plan, new Document(1, d.settings(), Status.ACCEPTED, d.slots(), shopping));
    }

    @Transactional
    public View refreshShopping(String email, UUID id, Version input) {
        MealPlan plan = owned(email, id);
        checkVersion(plan, input.version());
        Document d = read(plan);
        assertIdle(d);
        if (d.status() != Status.ACCEPTED) throw conflict("Accept the plan before creating its shopping list.");
        Shopping calculated = aggregation.aggregate(d.slots(), fridge.findByUser_Id(plan.getUser().getId()), d.settings().locale());
        Set<String> checked = new HashSet<>(d.shopping() == null ? Set.of() : d.shopping().checkedKeys());
        checked.retainAll(calculated.items().stream().map(ShoppingItem::key).toList());
        return save(plan, new Document(1, d.settings(), d.status(), d.slots(),
                new Shopping(calculated.calculatedAt(), calculated.items(), checked)));
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
        return save(plan, new Document(1, d.settings(), d.status(), d.slots(),
                new Shopping(shopping.calculatedAt(), shopping.items(), checked)));
    }

    private MealPlan owned(String email, UUID id) { return plans.findOwnedForUpdate(id, email).orElseThrow(this::notFound); }
    private Document read(MealPlan plan) { return json.readValue(plan.getDocument(), Document.class); }
    private View view(MealPlan plan) { return new View(plan.getId(), plan.getVersion(), plan.getCreatedAt(), read(plan)); }
    private View save(MealPlan plan, Document document) {
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
