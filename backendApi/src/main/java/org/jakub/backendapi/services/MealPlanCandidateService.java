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
import java.math.MathContext;
import java.util.*;
@Service
public class MealPlanCandidateService {
    private static final java.util.regex.Pattern REFERENCE = java.util.regex.Pattern.compile(
            "(?i)(?:cena przed obniżką(?:\\s*/\\s*cena poza promocją)?|cena poza promocją)\\s*:\\s*(?:1\\s*(?:kg|l)\\s*=\\s*)?(\\d+[,.]\\d{2})");
    private final IngredientNormalizationService names;
    private final IngredientRepository ingredients;
    private final RecipeRepository recipes;
    private final RecipeMapper mapper;
    private final PlanRecipeValidationService validation;
    private final MealPlanService plans;
    private final StoreOfferService offers;
    private final MealPlanPricingService pricing;
    private final LidlPriceCatalogService catalog;
    private final FridgeIngredientRepository fridge;
    public MealPlanCandidateService(RecipeRepository recipes, RecipeMapper mapper, PlanRecipeValidationService validation,
            MealPlanService plans, StoreOfferService offers, MealPlanPricingService pricing, IngredientNormalizationService names, IngredientRepository ingredients, LidlPriceCatalogService catalog, FridgeIngredientRepository fridge) {
        this.fridge = fridge; this.catalog = catalog;
        this.names = names; this.ingredients = ingredients; this.recipes = recipes; this.mapper = mapper; this.validation = validation; this.plans = plans; this.offers = offers; this.pricing = pricing;
    }
    public List<Offer> deals(String email, Create settings) {
        if (settings.planningMode() != PlanningMode.PRACTICAL) catalog.ensureFresh(settings.stores());
        LocalDate date = settings.shopping().shoppingDate() == null ? settings.startDate() : settings.shopping().shoppingDate();
        var eligible = offers.eligible(settings.stores(), date, Instant.now()).stream()
                .filter(o -> !o.details().loyaltyRequired() || settings.shopping().loyaltyStores().contains(o.details().store()))
                .filter(o -> !Boolean.TRUE.equals(o.details().couponRequired()) || settings.shopping().confirmedCouponOffers().contains(o.id()))
                .filter(o -> validation.allowedIngredient(email, o.details().productName(), settings.locale()))
                .toList();
        return rank(eligible, settings.shopping().selectedOffers());
    }
    /** A store-declared reference price can rank a reduction; it never becomes a current shopping price. */
    public List<Offer> rank(List<Offer> available, Set<UUID> selected) {
        var sorted = available.stream().sorted(Comparator.comparing((Offer o) -> !selected.contains(o.id()))
                .thenComparing(this::saving, Comparator.reverseOrder())
                .thenComparing(this::unitPrice).thenComparing(Offer::id)).toList();
        // Keep the regular-price alternative as well: a coupon limit may cover only part of the basket.
        return sorted.stream().limit(100).toList();
    }
    private String identity(Offer offer) { return offer.ingredientKey() == null ? "id:" + offer.details().ingredientId() : offer.ingredientKey(); }
    private BigDecimal unitPrice(Offer offer) {
        var d = offer.details();
        BigDecimal price = d.packagePrice() != null ? d.packagePrice() : d.bundlePrice().divide(BigDecimal.valueOf(d.bundleSize()), MathContext.DECIMAL64);
        return price.divide(d.packageAmount(), MathContext.DECIMAL64);
    }
    private BigDecimal saving(Offer offer) {
        var d = offer.details();
        BigDecimal reference = d.regularPrice();
        if (reference == null && LidlCatalogStore.SOURCE_TYPE.equals(offer.sourceType())) {
            var matcher = REFERENCE.matcher(d.conditions());
            if (matcher.find()) reference = new BigDecimal(matcher.group(1).replace(',', '.'));
        }
        if (reference == null || reference.signum() <= 0) return BigDecimal.ZERO;
        BigDecimal price = d.packagePrice() != null ? d.packagePrice() : d.bundlePrice().divide(BigDecimal.valueOf(d.bundleSize()), MathContext.DECIMAL64);
        return reference.subtract(price).max(BigDecimal.ZERO).divide(reference, MathContext.DECIMAL64);
    }
    /** Prefer unconsumed selections, then ranked priced ingredients, excluding the slot being replaced. */
    public List<Offer> requiredDeals(View plan, Slot target, List<Offer> available) {
        Set<Long> used = new HashSet<>();
        Set<String> usedKeys = new HashSet<>();
        plan.plan().slots().stream().filter(s -> !s.id().equals(target.id()) && !s.skipped() && s.recipe() != null)
                .forEach(s -> { used.addAll(ingredientIds(s.recipe(), s.recipe().getLocale().name()));
                    s.recipe().getIngredients().stream().map(i -> PriceIngredientKeys.recipeKey(i.getName())).filter(Objects::nonNull).forEach(usedKeys::add); });
        var selected = available.stream().filter(o -> plan.plan().settings().shopping().selectedOffers().contains(o.id())
                && !used.contains(o.details().ingredientId()) && (o.ingredientKey() == null || !usedKeys.contains(o.ingredientKey()))).toList();
        if (plan.plan().schemaVersion() >= 4 || plan.plan().settings().planningMode() != PlanningMode.PROMOTIONS_FIRST) return selected;
        // Prefer new ingredients across the week without exhausting the catalog or inventing offers.
        Set<String> seen = new HashSet<>();
        return java.util.stream.Stream.concat(selected.stream(), available.stream().sorted(Comparator.comparing((Offer o) -> used.contains(o.details().ingredientId())
                || o.ingredientKey() != null && usedKeys.contains(o.ingredientKey()))))
                .filter(o -> seen.add(identity(o))).limit(2).toList();
    }
    public boolean matchesRequiredDeal(RecipeDto recipe, List<Offer> required, String locale) {
        if (required.isEmpty()) return true;
        Set<Long> used = ingredientIds(recipe, locale);
        return required.stream().anyMatch(o -> used.contains(o.details().ingredientId()) || o.ingredientKey() != null
                && recipe.getIngredients().stream().anyMatch(i -> o.ingredientKey().equals(PriceIngredientKeys.recipeKey(i.getName()))));
    }
    public boolean matchesPlanningDeals(RecipeDto recipe, List<Offer> required, Create settings) {
        return settings.planningMode() == PlanningMode.PROMOTIONS_FIRST
                ? required.stream().allMatch(o -> matchesRequiredDeal(recipe, List.of(o), settings.locale()))
                : matchesRequiredDeal(recipe, required, settings.locale());
    }
    public List<String> requiredIngredientNames(List<Offer> required) {
        return ingredients.findAllById(required.stream().map(o -> o.details().ingredientId()).distinct().toList())
                .stream().map(i -> i.getName()).sorted().toList();
    }
    public List<Map<String, Object>> offerContext(List<Offer> available) {
        var byId = ingredients.findAllById(available.stream().map(o -> o.details().ingredientId()).distinct().toList())
                .stream().collect(java.util.stream.Collectors.toMap(i -> i.getId(), i -> i.getName()));
        return available.stream().map(o -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("ingredient", byId.get(o.details().ingredientId()));
            item.put("product", o.details().productName()); item.put("store", o.details().store());
            item.put("packageAmount", o.details().packageAmount()); item.put("unit", o.details().unit());
            item.put("packagePrice", o.details().packagePrice()); item.put("minimumPackages", o.details().minimumPackages());
            item.put("packageMultiple", o.details().packageMultiple());
            item.put("conditions", o.details().conditions()); return item;
        }).toList();
    }
    public List<RecipeGenerationRequestDto.PricedIngredient> planningIngredients(List<Offer> available) {
        var byId = ingredients.findAllById(available.stream().map(o -> o.details().ingredientId()).distinct().toList())
                .stream().collect(java.util.stream.Collectors.toMap(i -> i.getId(), i -> i.getName()));
        return available.stream().map(o -> new RecipeGenerationRequestDto.PricedIngredient(byId.get(o.details().ingredientId()), o.details().unit()))
                .distinct().toList();
    }
    public boolean hasPriceCoverage(String email, View plan, Slot target, RecipeDto recipe, List<Offer> available) {
        if (plan.plan().schemaVersion() >= 4 || plan.plan().settings().planningMode() != PlanningMode.PROMOTIONS_FIRST) return true;
        var slots = plan.plan().slots().stream().map(s -> s.id().equals(target.id())
                ? new Slot(s.id(), s.date(), s.mealType(), s.servings(), false, false, recipe, null, null, null) : s).toList();
        var shopping = plans.previewShopping(email, plan.id(), slots);
        var keys = shopping.items().stream().filter(i -> i.slotIds().contains(target.id()) && (i.amount() == null || i.amount() > 0))
                .map(ShoppingItem::key).collect(java.util.stream.Collectors.toSet());
        if (keys.isEmpty()) return true; // A meal fully covered by the fridge has no purchase requirement.
        var settings = plan.plan().settings();
        var candidate = new View(plan.id(), plan.version(), plan.createdAt(), new Document(2, settings, Status.DRAFT, slots, shopping));
        var input = new QuoteRequest(plan.version(), settings.shopping().shoppingDate() == null ? settings.startDate() : settings.shopping().shoppingDate(),
                settings.shopping().loyaltyStores(), settings.shopping().confirmedCouponOffers());
        var quote = pricing.calculateForUser(email, candidate, input, available, Instant.now());
        return quote.baskets().stream().anyMatch(b -> b.items().stream().filter(i -> keys.contains(i.key()) && i.cost() != null).count() * 2 >= keys.size());
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
        Set<String> priorityNames = plan.plan().cycle() == null ? Set.of() : fridge.findAllById(plan.plan().cycle().priorityFridgeIds()).stream()
            .filter(i -> i.getUser().getEmail().equals(email)).map(i -> names.canonicalName(i.getName())).collect(java.util.stream.Collectors.toSet());
        RecipeDto best = null; Score bestScore = null; double bestPractical = Double.POSITIVE_INFINITY;
        for (var entity : recipes.findAllWithIngredientsByIdIn(ids)) {
            var recipe = mapper.toRecipeDto(entity);
            if (existing.contains(recipe.getName().toLowerCase(Locale.ROOT)) && !settings.shopping().allowRepeats()) continue;
            try { validation.validate(email, recipe, plan.plan().cycle() == null ? settings.maxMinutes() : plan.plan().cycle().exceptions().stream().filter(e -> e.date().equals(target.date()) && e.mealType() == target.mealType() && e.maxMinutes() != null).map(org.jakub.backendapi.dto.WeekCycleDto.ExceptionDay::maxMinutes).findFirst().orElse(settings.maxMinutes()), settings.locale()); } catch (RuntimeException rejected) { continue; }
            if (!matchesPlanningDeals(recipe, required, settings)) continue;
            if (!hasPriceCoverage(email, plan, target, recipe, available)) continue;
            var slots = plan.plan().slots().stream().map(s -> s.id().equals(target.id()) ? new Slot(s.id(), s.date(), s.mealType(), s.servings(), false, false, recipe, null, null, null) : s).toList();
            Shopping shopping = plans.previewShopping(email, plan.id(), slots);
            var candidate = new View(plan.id(), plan.version(), plan.createdAt(), new Document(2, settings, Status.DRAFT, slots, shopping));
            var input = new QuoteRequest(plan.version(), settings.shopping().shoppingDate() == null ? settings.startDate() : settings.shopping().shoppingDate(), settings.shopping().loyaltyStores(), settings.shopping().confirmedCouponOffers());
            var quote = pricing.calculate(candidate, input, available, Instant.now());
            Score score = quote.baskets().stream().map(basket -> score(basket, settings)).min(Comparator.naturalOrder()).orElseThrow();
            double practical = shopping.items().stream().filter(i -> i.slotIds().contains(target.id()))
                .mapToDouble(i -> i.needsReview() || i.amount() == null ? 2 : i.amount() > 0 ? 1 : 0).sum();
            if (settings.planningMode() == PlanningMode.PRACTICAL) {
                int priorityMatches = (int) recipe.getIngredients().stream().filter(i -> priorityNames.contains(names.canonicalName(i.getName()))).count();
                long covered = shopping.items().stream().filter(i -> i.slotIds().contains(target.id()) && !i.needsReview() && i.amount() != null && i.amount() == 0).count();
                practical = practical * 1000 - priorityMatches * 10 - covered;
                if (best == null || practical < bestPractical || practical == bestPractical && score.compareTo(bestScore) < 0) {
                    best = recipe; bestScore = score; bestPractical = practical;
                }
            } else if (bestScore == null || score.compareTo(bestScore) < 0) { best = recipe; bestScore = score; }
        }
        if (best != null) { best.setId(null); best.setVisibility(RecipeVisibility.PRIVATE); best.setCanManage(false); }
        return best;
    }
    private Score score(Basket basket, Create settings) {
        int selected = (int) basket.items().stream().filter(i -> i.offer() != null && settings.shopping().selectedOffers().contains(i.offer().id())).count();
        // Count useful offers, then compare cash outlay and unused fraction across the entire week.
        double excess = basket.items().stream().filter(i -> i.offer() != null && i.purchasedAmount().signum() > 0)
                .mapToDouble(i -> i.leftoverAmount().doubleValue() / i.purchasedAmount().doubleValue()).sum();
        int count = basket.pricedItems() + basket.missingItems();
        double missingShare = settings.planningMode() == PlanningMode.PROMOTIONS_FIRST && count > 0 ? (double) basket.missingItems() / count : 0;
        return new Score(-selected, missingShare, basket.missingItems(), basket.knownTotal(), excess);
    }
    private record Score(int selected, double missingShare, int missing, BigDecimal cost, double excess) implements Comparable<Score> {
        public int compareTo(Score other) {
            int c = Integer.compare(selected, other.selected);
            if (c == 0) c = Double.compare(missingShare, other.missingShare);
            if (c == 0) c = Integer.compare(missing, other.missing);
            // Unknown prices never make an incomplete basket cheaper than another basket.
            if (c == 0 && missing == 0) c = cost.compareTo(other.cost);
            return c == 0 ? Double.compare(excess, other.excess) : c;
        }
    }
}
