package org.jakub.backendapi.services;
import org.jakub.backendapi.dto.*;
import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.dto.StoreOfferDto.*;
import org.jakub.backendapi.entities.Enums.*;
import org.jakub.backendapi.repositories.*;
import org.jakub.backendapi.mappers.RecipeMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;
import java.time.*;
import java.math.BigDecimal;
import java.util.*;
@Service
public class MealPlanCandidateService {
    private final IngredientNormalizationService names;
    private final IngredientRepository ingredients;
    private final RecipeRepository recipes;
    private final RecipeMapper mapper;
    private final PlanRecipeValidationService validation;
    private final MealPlanService plans;
    private final StoreOfferService offers;
    private final MealPlanPricingService pricing;
    public MealPlanCandidateService(RecipeRepository recipes, RecipeMapper mapper, PlanRecipeValidationService validation,
            MealPlanService plans, StoreOfferService offers, MealPlanPricingService pricing, IngredientNormalizationService names, IngredientRepository ingredients) {
        this.names = names; this.ingredients = ingredients; this.recipes = recipes; this.mapper = mapper; this.validation = validation; this.plans = plans; this.offers = offers; this.pricing = pricing;
    }
    public List<Offer> deals(String email, Create settings) {
        LocalDate date = settings.shopping().shoppingDate() == null ? settings.startDate() : settings.shopping().shoppingDate();
        return offers.eligible(settings.stores(), date, Instant.now()).stream()
                .filter(o -> !o.details().loyaltyRequired() || settings.shopping().loyaltyStores().contains(o.details().store()))
                .filter(o -> !Boolean.TRUE.equals(o.details().couponRequired()) || settings.shopping().confirmedCouponOffers().contains(o.id()))
                .filter(o -> validation.allowedIngredient(email, o.details().productName(), settings.locale()))
                .sorted(Comparator.comparing((Offer o) -> !settings.shopping().selectedOffers().contains(o.id())).thenComparing(Offer::id))
                .limit(30).toList();
    }
    /** Selected products are week-level requirements, excluding the slot being replaced. */
    public List<Offer> requiredDeals(View plan, Slot target, List<Offer> available) {
        Set<Long> used = new HashSet<>();
        plan.plan().slots().stream().filter(s -> !s.id().equals(target.id()) && !s.skipped() && s.recipe() != null)
                .forEach(s -> used.addAll(ingredientIds(s.recipe(), plan.plan().settings().locale())));
        return available.stream().filter(o -> plan.plan().settings().shopping().selectedOffers().contains(o.id())
                && !used.contains(o.details().ingredientId())).toList();
    }
    public boolean matchesRequiredDeal(RecipeDto recipe, List<Offer> required, String locale) {
        if (required.isEmpty()) return true;
        Set<Long> used = ingredientIds(recipe, locale);
        return required.stream().anyMatch(o -> used.contains(o.details().ingredientId()));
    }
    public List<String> requiredIngredientNames(List<Offer> required) {
        return ingredients.findAllById(required.stream().map(o -> o.details().ingredientId()).distinct().toList())
                .stream().map(i -> i.getName()).sorted().toList();
    }
    private Set<Long> ingredientIds(RecipeDto recipe, String locale) {
        Set<Long> ids = new HashSet<>();
        recipe.getIngredients().forEach(i -> { var resolved = names.resolve(i.getName(), locale);
            if (resolved.isResolved()) ids.add(resolved.ingredient().getId()); });
        return ids;
    }
    @Transactional(readOnly = true)
    public RecipeDto choose(String email, View plan, Slot target, List<Offer> available, List<Offer> required) {
        var settings = plan.plan().settings();
        var ids = recipes.findPlanningCandidates(email, ContentLocale.valueOf(settings.locale()), RecipeVisibility.PUBLIC, PageRequest.of(0, 60));
        if (ids.isEmpty()) return null;
        Set<String> existing = new HashSet<>();
        plan.plan().slots().stream().filter(s -> s.recipe() != null).forEach(s -> existing.add(s.recipe().getName().toLowerCase(Locale.ROOT)));
        RecipeDto best = null; Score bestScore = null;
        for (var entity : recipes.findAllWithIngredientsByIdIn(ids)) {
            var recipe = mapper.toRecipeDto(entity);
            if (existing.contains(recipe.getName().toLowerCase(Locale.ROOT)) && !settings.shopping().allowRepeats()) continue;
            try { validation.validate(email, recipe, settings.maxMinutes(), settings.locale()); } catch (RuntimeException rejected) { continue; }
            if (!matchesRequiredDeal(recipe, required, settings.locale())) continue;
            var slots = plan.plan().slots().stream().map(s -> s.id().equals(target.id()) ? new Slot(s.id(), s.date(), s.mealType(), s.servings(), false, false, recipe, null, null, null) : s).toList();
            Shopping shopping = plans.previewShopping(email, plan.id(), slots);
            var candidate = new View(plan.id(), plan.version(), plan.createdAt(), new Document(2, settings, Status.DRAFT, slots, shopping));
            var input = new QuoteRequest(plan.version(), settings.shopping().shoppingDate() == null ? settings.startDate() : settings.shopping().shoppingDate(), settings.shopping().loyaltyStores(), settings.shopping().confirmedCouponOffers());
            var quote = pricing.calculate(candidate, input, available, Instant.now());
            Score score = quote.baskets().stream().map(basket -> score(basket, settings)).min(Comparator.naturalOrder()).orElseThrow();
            if (bestScore == null || score.compareTo(bestScore) < 0) { best = recipe; bestScore = score; }
        }
        if (best != null) { best.setId(null); best.setVisibility(RecipeVisibility.PRIVATE); best.setCanManage(false); }
        return best;
    }
    private Score score(Basket basket, Create settings) {
        int selected = (int) basket.items().stream().filter(i -> i.offer() != null && settings.shopping().selectedOffers().contains(i.offer().id())).count();
        // Count useful offers, then compare cash outlay and unused fraction across the entire week.
        double excess = basket.items().stream().filter(i -> i.offer() != null && i.purchasedAmount().signum() > 0)
                .mapToDouble(i -> i.leftoverAmount().doubleValue() / i.purchasedAmount().doubleValue()).sum();
        return new Score(-selected, basket.missingItems(), basket.knownTotal(), excess);
    }
    private record Score(int selected, int missing, BigDecimal cost, double excess) implements Comparable<Score> {
        public int compareTo(Score other) {
            int c = Integer.compare(selected, other.selected);
            if (c == 0) c = Integer.compare(missing, other.missing);
            // Unknown prices never make an incomplete basket cheaper than another basket.
            if (c == 0 && missing == 0) c = cost.compareTo(other.cost);
            return c == 0 ? Double.compare(excess, other.excess) : c;
        }
    }
}
