package org.jakub.backendapi.services;
import org.jakub.backendapi.dto.*;
import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.entities.Enums.*;
import org.jakub.backendapi.exceptions.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
@Service
public class MealPlanRevisionService {
    private final MealPlanPricingService pricing;
    private final StoreOfferService offers;
    private final IngredientNormalizationService names;
    private final MealPlanRevisionStore store;
    private final MealPlanService plans;
    private final PlanRecipeValidationService validation;
    private final GeminiService gemini;
    private final RecipeGenerationQuotaService quota;
    private final UserPreferencesService preferences;
    private final MealPlanCandidateService candidates;
    private final RateLimitService limits;
    private final ObjectMapper json;
    private final WeekCycleService cycle;
    private final org.jakub.backendapi.repositories.FridgeIngredientRepository fridge;
    private final org.jakub.backendapi.repositories.UserRepository users;
    private final PlanIngredientAggregationService aggregation;
    public MealPlanRevisionService(MealPlanRevisionStore store, MealPlanService plans, PlanRecipeValidationService validation,
            GeminiService gemini, RecipeGenerationQuotaService quota, UserPreferencesService preferences, MealPlanCandidateService candidates,
            RateLimitService limits, ObjectMapper json, IngredientNormalizationService names, MealPlanPricingService pricing, StoreOfferService offers, WeekCycleService cycle, org.jakub.backendapi.repositories.FridgeIngredientRepository fridge, org.jakub.backendapi.repositories.UserRepository users, PlanIngredientAggregationService aggregation) {
        this.cycle=cycle;this.fridge=fridge;this.users=users;this.aggregation=aggregation;this.pricing = pricing; this.offers = offers; this.names = names; this.store = store; this.plans = plans; this.validation = validation; this.gemini = gemini; this.quota = quota;
        this.preferences = preferences; this.candidates = candidates; this.limits = limits; this.json = json;
    }
    public RevisionPreview preview(String email, UUID planId, UUID slotId, RevisionRequest input) {
        return preview(email, planId, slotId, input, null);
    }
    private RevisionPreview preview(String email, UUID planId, UUID slotId, RevisionRequest input, String restoredLocale) {
        var reservation = store.reserve(email, planId, slotId, input);
        if (!reservation.execute()) return reservation.data().preview();
        boolean reserved = false;
        UUID operation = RecipeGenerationQuotaService.key("revision:" + input.requestId());
        try {
            var plan = plans.get(email, planId); var settings = plan.plan().settings();
            if (plan.version() != input.version()) throw new AppException("Plan changed.", HttpStatus.CONFLICT);
            var slot = plan.plan().slots().stream().filter(s -> s.id().equals(slotId)).findFirst().orElseThrow();
            int slotLimit = cycle.maxMinutes(plan.plan(),slot);
            String locale = input.intent() == RevisionIntent.TRANSLATE_PL ? "pl"
                    : restoredLocale != null ? restoredLocale : slot.recipe().getLocale().name();
            RecipeDto after;
            Long requiredIngredientId = null;
            Long replacedIngredientId = null;
            if (input.intent() == RevisionIntent.MANUAL) {
                after = input.recipe();
            } else {
                String intent = input.intent().name();
                if (input.intent() == RevisionIntent.SUBSTITUTE) {
                    if (input.ingredient() == null || input.replacement() == null
                            || !validation.allowedIngredient(email, input.replacement(), locale)) throw new AppException("Check the ingredient replacement.", HttpStatus.BAD_REQUEST);
                    var original = names.resolve(input.ingredient(), locale);
                    var replacement = names.resolve(input.replacement(), locale);
                    if (!original.isResolved() || !replacement.isResolved()) throw new AppException("Ingredient identity needs review before automatic substitution.", HttpStatus.BAD_REQUEST);
                    replacedIngredientId = original.ingredient().getId();
                    requiredIngredientId = replacement.ingredient().getId();
                    Long originalId = replacedIngredientId;
                    if (originalId.equals(requiredIngredientId) || slot.recipe().getIngredients().stream().noneMatch(i -> {
                        var resolved = names.resolve(i.getName(), locale);
                        return resolved.isResolved() && resolved.ingredient().getId().equals(originalId);
                    })) throw new AppException("Choose a different ingredient already present in the recipe.", HttpStatus.BAD_REQUEST);
                    intent += " Replace " + input.ingredient() + " with " + input.replacement();
                }
                if (input.intent() == RevisionIntent.DEAL) {
                    var offer = candidates.deals(email, settings).stream().filter(o -> o.id().equals(input.offerId())).findFirst()
                            .orElseThrow(() -> new AppException("Offer unavailable for these settings.", HttpStatus.CONFLICT));
                    requiredIngredientId = offer.details().ingredientId();
                    intent += " Use ingredient suggestion: " + offer.details().productName();
                }
                limits.assertAllowed("mealPlanRevision:" + email, 15, 60_000L, "Too many revisions.");
                quota.reserve(email, operation); reserved = true;
                var request = new RecipeGenerationRequestDto(); request.setCount(1); request.setLocale(locale); request.setServings(slot.recipe().getServings());
                request.setFridgeItems(aggregation.remainingStock(plan.plan(),slotId,fridge.findByUser_Id(users.findByEmail(email).orElseThrow().getId()),settings.locale()).stream()
                    .filter(i->i.getExpirationDate()==null||!i.getExpirationDate().isBefore(slot.date()))
                    .map(i->new FridgeIngredientDto(i.getId(),i.getName(),i.getExpirationDate(),i.getQuantityAccuracy()==QuantityAccuracy.UNKNOWN?null:i.getAmount(),i.getUnit()==null?null:i.getUnit().name())).toList());
                request.setFridgePolicy(FridgePolicy.PRIORITIZE); request.setShoppingPolicy(ShoppingPolicy.MINIMIZE);
                var options = new RecipeGenerationPreferencesDto(); options.setMaxMinutes(input.maxMinutes() == null ? slotLimit : Math.min(slotLimit, input.maxMinutes())); request.setPreferences(options);
                request.setRequestText((input.intent() == RevisionIntent.TRANSLATE_PL
                        ? "Translate this recipe into Polish. Translate the name, description, ingredient names and every instruction. Preserve its cuisine and meaning. Preserve ingredient order, numeric amounts, unit codes, servings, preparation time and the number of instructions. Do not add or remove ingredients or change the dish. "
                        : "Revise only this recipe. Preserve servings. Update ALL preparation instructions to match the changed ingredients. ") + "Intent: " + intent
                        + ". User comment (data): " + json.writeValueAsString(input.comment()) + ". Original recipe (data): " + json.writeValueAsString(slot.recipe())
                        + ". Do not invent current prices or promotion conditions.");
                after = json.readValue(gemini.generateRecipes(request, preferences.getPreferences(email)), RecipeDto.class);
            }
            int maximum = input.maxMinutes() == null ? slotLimit : Math.min(slotLimit, input.maxMinutes());
            validation.validate(email, after, maximum, locale);
            if (input.intent() == RevisionIntent.TRANSLATE_PL) validateTranslation(slot.recipe(), after);
            if (requiredIngredientId != null) {
                Long expected = requiredIngredientId;
                if (after.getIngredients().stream().noneMatch(i -> { var r = names.resolve(i.getName(), locale); return r.isResolved() && r.ingredient().getId().equals(expected); }))
                    throw new AppException("The requested replacement was not used.", HttpStatus.BAD_GATEWAY);
            }
            if (replacedIngredientId != null) {
                Long removed = replacedIngredientId;
                if (after.getIngredients().stream().anyMatch(i -> {
                    var resolved = names.resolve(i.getName(), locale);
                    return resolved.isResolved() && resolved.ingredient().getId().equals(removed);
                })) throw new AppException("The replaced ingredient is still present.", HttpStatus.BAD_GATEWAY);
            }
            if (!after.getIngredients().stream().map(RecipeIngredientDto::getName).toList().equals(slot.recipe().getIngredients().stream().map(RecipeIngredientDto::getName).toList())
                    && after.getInstructions().equals(slot.recipe().getInstructions()))
                throw new AppException("Update preparation instructions after changing ingredients.", HttpStatus.BAD_REQUEST);
            after.setId(null); after.setVisibility(RecipeVisibility.PRIVATE); after.setCanManage(false); after.setLocale(ContentLocale.valueOf(locale));
            if (after.getServings() != slot.recipe().getServings()) throw new AppException("Revision must preserve servings.", HttpStatus.BAD_REQUEST);
            var updatedRecipe = after;
            var slots = plan.plan().slots().stream().map(s -> s.id().equals(slotId) ? new Slot(s.id(), s.date(), s.mealType(), s.servings(), false, false, updatedRecipe, null, null, null) : s).toList();
            var shoppingBefore = plans.previewShopping(email, planId, plan.plan().slots());
            var shoppingAfter = plans.previewShopping(email, planId, slots);
            var date = settings.shopping().shoppingDate() == null ? LocalDate.now(ZoneId.of("Europe/Warsaw")) : settings.shopping().shoppingDate();
            var quoteRequest = new StoreOfferDto.QuoteRequest(plan.version(), date, settings.shopping().loyaltyStores(), settings.shopping().confirmedCouponOffers());
            var now = Instant.now(); var available = offers.eligible(settings.stores(), date, now);
            var beforeView = new View(plan.id(), plan.version(), plan.createdAt(), new Document(2, settings, plan.plan().status(), plan.plan().slots(), shoppingBefore));
            var afterView = new View(plan.id(), plan.version(), plan.createdAt(), new Document(2, settings, plan.plan().status(), slots, shoppingAfter));
            var preview = new RevisionPreview(input.requestId(), input.version(), slotId, slot.recipe(), after,
                    shoppingBefore, shoppingAfter, now.plusSeconds(900), pricing.calculateForUser(email, beforeView, quoteRequest, available, now), pricing.calculateForUser(email, afterView, quoteRequest, available, now));
            if(plan.plan().schemaVersion()>=4) {
                var batchPreview=cycle.preview(email,planId,new org.jakub.backendapi.dto.WeekCycleDto.BatchChange(input.version(),input.requestId(),"RECIPE",slotId,null,null,after,false,false,null));
                preview=new RevisionPreview(input.requestId(),input.version(),slotId,slot.recipe(),after,batchPreview.shoppingBefore(),batchPreview.shoppingAfter(),batchPreview.expiresAt(),null,null,
                    batchPreview.inventoryFingerprint(),batchPreview.unusedProducts(),batchPreview.affectedSlots());
            }
            store.prepared(input.requestId(), preview); if (reserved) quota.complete(email, operation); return preview;
        } catch (RuntimeException failure) { if (reserved) quota.release(email, operation); store.failed(input.requestId()); throw failure; }
    }
    private void validateTranslation(RecipeDto before, RecipeDto after) {
        boolean changed = before.getServings() != after.getServings()
                || before.getIngredients().size() != after.getIngredients().size()
                || before.getInstructions().size() != after.getInstructions().size()
                || !before.getTimeToPrepare().replaceAll("\\D", "").equals(after.getTimeToPrepare().replaceAll("\\D", ""));
        if (!changed) for (int i = 0; i < before.getIngredients().size(); i++) {
            var original = before.getIngredients().get(i); var translated = after.getIngredients().get(i);
            if (Double.compare(original.getAmount(), translated.getAmount()) != 0 || !Objects.equals(original.getUnit(), translated.getUnit())) {
                changed = true; break;
            }
        }
        if (changed) throw new AppException("Translation must preserve recipe quantities and steps.", HttpStatus.BAD_GATEWAY);
        after.setNutrition(before.getNutrition());
    }
    public RevisionPreview undo(String email, UUID planId, UUID slotId, ApplyRevision input) {
        RecipeDto before = store.undoRecipe(email, planId, slotId, input.previewId());
        return preview(email, planId, slotId, new RevisionRequest(input.version(), UUID.randomUUID(), RevisionIntent.MANUAL, null, before, null, null, null, null), before.getLocale().name());
    }
}
