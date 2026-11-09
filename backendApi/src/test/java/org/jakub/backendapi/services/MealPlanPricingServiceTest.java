package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.dto.StoreOfferDto.*;
import org.jakub.backendapi.entities.Ingredient;
import org.junit.jupiter.api.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MealPlanPricingServiceTest {
    private final Instant now = Instant.parse("2026-10-29T10:00:00Z");
    private final LocalDate day = LocalDate.of(2026, 10, 29);
    private IngredientNormalizationService names;
    private MealPlanPricingService pricing;
    @BeforeEach void setup() {
        names = mock(IngredientNormalizationService.class);
        pricing = new MealPlanPricingService(null, null, names);
        Ingredient rice = new Ingredient(1L, "rice", List.of());
        when(names.resolve("rice", "en")).thenReturn(new IngredientNormalizationService.Resolution(
                IngredientNormalizationService.Status.EXACT_CANONICAL, rice, "rice", List.of(rice)));
        when(names.resolve("unknown", "en")).thenReturn(new IngredientNormalizationService.Resolution(
                IngredientNormalizationService.Status.UNRESOLVED, null, "unknown", List.of()));
    }
    @Test void comparesActualWholePackageCostsRatherThanUnitPrices() {
        var offers = List.of(offer(Store.LIDL, "1000", "7.00", 1, 1, null, false, day, day, now),
                offer(Store.BIEDRONKA, "400", "3.00", 1, 1, null, false, day, day, now));
        var quote = quote(List.of(row("rice", 500d, false)), "6.00", offers, Set.of());
        assertThat(quote.baskets().get(0).knownTotal()).isEqualByComparingTo("7.00");
        var combined = quote.baskets().get(2);
        assertThat(combined.knownTotal()).isEqualByComparingTo("6.00");
        assertThat(combined.budgetStatus()).isEqualTo(BudgetStatus.WITHIN_BUDGET);
        assertThat(combined.items().get(0).packages()).isEqualByComparingTo("2");
        assertThat(combined.items().get(0).leftoverAmount()).isEqualByComparingTo("300");
    }
    @Test void enforcesLoyaltyMinimumMultiplesAndLimits() {
        Offer deal = offer(Store.LIDL, "400", "2.99", 3, 2, 4, true, day, day, now);
        assertThat(quote(List.of(row("rice", 500d, false)), "20", List.of(deal), Set.of()).baskets().get(0).missingItems()).isEqualTo(1);
        var basket = quote(List.of(row("rice", 500d, false)), "20", List.of(deal), Set.of(Store.LIDL)).baskets().get(0);
        assertThat(basket.knownTotal()).isEqualByComparingTo("11.96");
        assertThat(basket.items().get(0).packages()).isEqualByComparingTo("4");
        assertThat(quote(List.of(row("rice", 1601d, false)), "20", List.of(deal), Set.of(Store.LIDL)).baskets().get(0).missingItems()).isEqualTo(1);
    }
    @Test void rejectsStaleExpiredAndFutureOffersButIncludesDateBoundaries() {
        var candidates = List.of(
                offer(Store.LIDL, "500", "1", 1, 1, null, false, day, day, now.minusSeconds(172801)),
                offer(Store.LIDL, "500", "1", 1, 1, null, false, day.minusDays(1), day.minusDays(1), now),
                offer(Store.LIDL, "500", "1", 1, 1, null, false, day.plusDays(1), day.plusDays(1), now),
                offer(Store.LIDL, "500", "4", 1, 1, null, false, day, day, now));
        assertThat(quote(List.of(row("rice", 500d, false)), "20", candidates, Set.of()).baskets().get(0).knownTotal()).isEqualByComparingTo("4");
    }
    @Test void missingPricesNeverConfirmBudgetAndKnownSubtotalCanAlreadyExceedIt() {
        var offers = List.of(offer(Store.LIDL, "500", "4.99", 1, 1, null, false, day, day, now));
        var rows = List.of(row("rice", 500d, false), row("unknown", 1d, false));
        var incomplete = quote(rows, "20", offers, Set.of()).baskets().get(0);
        assertThat(incomplete.budgetStatus()).isEqualTo(BudgetStatus.INCOMPLETE);
        assertThat(incomplete.items().get(1).cost()).isNull();
        assertThat(quote(rows, "4", offers, Set.of()).baskets().get(0).budgetStatus()).isEqualTo(BudgetStatus.OVER_BUDGET);
        assertThat(quote(rows, "20", List.of(), Set.of()).baskets().get(0).budgetStatus()).isEqualTo(BudgetStatus.INCOMPLETE);
    }
    @Test void uncertainAmountsCannotBePricedAndFridgeCoverageNeedsNoPurchase() {
        var offers = List.of(offer(Store.LIDL, "500", "4.99", 1, 1, null, false, day, day, now));
        assertThat(quote(List.of(row("rice", null, true)), "20", offers, Set.of()).baskets().get(0).items().get(0).missingReason()).isEqualTo(MissingReason.CHECK_QUANTITY);
        assertThat(quote(List.of(row("rice", 50d, true)), "20", offers, Set.of()).baskets().get(0).missingItems()).isEqualTo(1);
        var covered = quote(List.of(row("rice", 0d, false)), "20", List.of(), Set.of()).baskets().get(0);
        assertThat(covered.knownTotal()).isEqualByComparingTo("0");
        assertThat(covered.budgetStatus()).isEqualTo(BudgetStatus.WITHIN_BUDGET);
        assertThat(covered.items()).isEmpty();
    }
    @Test void doesNotUseAmbiguousIngredientMapping() {
        when(names.resolve("rice", "en")).thenReturn(new IngredientNormalizationService.Resolution(
                IngredientNormalizationService.Status.AMBIGUOUS, null, "rice", List.of()));
        var offers = List.of(offer(Store.LIDL, "500", "4.99", 1, 1, null, false, day, day, now));
        assertThat(quote(List.of(row("rice", 500d, false)), "20", offers, Set.of()).baskets().get(0).missingItems()).isEqualTo(1);
    }
    @Test void changedAliasesCannotConsumeOnePromotionLimitTwice() {
        Ingredient rice = new Ingredient(1L, "rice", List.of());
        when(names.resolve("unknown", "en")).thenReturn(new IngredientNormalizationService.Resolution(
                IngredientNormalizationService.Status.ALIAS, rice, "unknown", List.of(rice)));
        var offers = List.of(offer(Store.LIDL, "500", "4.99", 1, 1, 1, false, day, day, now));
        var basket = quote(List.of(row("rice", 400d, false), row("unknown", 400d, false)), "20", offers, Set.of()).baskets().get(0);
        assertThat(basket.missingItems()).isEqualTo(2);
        assertThat(basket.items()).allMatch(item -> item.missingReason() == MissingReason.CHECK_QUANTITY);
    }

    @Test void cardDoesNotConfirmAnUnknownCoupon() {
        var old = new Offer(UUID.randomUUID(), 0, true, new Publish(0, Store.LIDL, 1L, "Rice", new BigDecimal("500"), "g", new BigDecimal("3"),
                1, 1, null, true, day, day, "https://www.lidl.pl/p/test", "Requires coupon", now, true, true, true));
        assertThat(quote(List.of(row("rice", 100d, false)), "20", List.of(old), Set.of(Store.LIDL)).baskets().get(0).missingItems()).isEqualTo(1);
        Create settings = new Create(UUID.randomUUID(), day, 1, 2, Set.of(MealType.DINNER), Set.of(Store.LIDL), null, "en", 30,
                PlanningMode.DEALS, BudgetMode.NONE, new ShoppingOptions(day, 1, Set.of(Store.LIDL), Set.of(old.id()), Set.of(), false));
        View view = new View(settings.requestId(), 2, now, new Document(2, settings, Status.DRAFT, List.of(), new Shopping(now, List.of(row("rice", 100d, false)), Set.of())));
        var basket = pricing.calculate(view, new QuoteRequest(2, day, Set.of(Store.LIDL), Set.of(old.id())), List.of(old), now).baskets().get(0);
        assertThat(basket.knownTotal()).isEqualByComparingTo("3");
        assertThat(basket.budgetStatus()).isEqualTo(BudgetStatus.NO_BUDGET);
    }
    @Test void bundlePriceNeverDividesAndRoundsAnIndividualPack() {
        var deal = extended(false, "7.99", 2, null, null);
        assertThat(quote(List.of(row("rice", 501d, false)), "20", List.of(deal), Set.of()).baskets().get(0).knownTotal()).isEqualByComparingTo("7.99");
        assertThat(quote(List.of(row("rice", 1501d, false)), "20", List.of(deal), Set.of()).baskets().get(0).knownTotal()).isEqualByComparingTo("15.98");
    }
    @Test void weightedPriceUsesDeclaredBasisAndRoundingStep() {
        var deal = extended(true, null, null, null, "10");
        var basket = quote(List.of(row("rice", 351d, false)), "20", List.of(deal), Set.of()).baskets().get(0);
        assertThat(basket.items().get(0).purchasedAmount()).isEqualByComparingTo("360");
        assertThat(basket.knownTotal()).isEqualByComparingTo("3.60");
        assertThat(basket.items().get(0).packages()).isNull();
    }
    @Test void weightedLimitUsesTheSamePriceBasisForTheRegularRemainder() {
        var d = extended(true, null, null, "20", "10").details();
        var offer = new Offer(UUID.randomUUID(), 0, true, new Publish(d.version(), d.store(), d.ingredientId(), d.productName(), d.packageAmount(), d.unit(), d.packagePrice(),
                d.minimumPackages(), d.packageMultiple(), d.maximumPackages(), d.loyaltyRequired(), d.validFrom(), d.validTo(), d.sourceUrl(), d.conditions(), d.verifiedAt(), d.nationwide(), d.fixedPackage(), d.conditionsVerified(),
                false, null, null, d.regularPrice(), d.category(), true, d.weightStep(), new BigDecimal("300")));
        assertThat(quote(List.of(row("rice", 351d, false)), "20", List.of(offer), Set.of()).baskets().get(0).knownTotal()).isEqualByComparingTo("4.20");
    }
    @Test void regularPriceCanAvoidExcessiveMinimumAndPriceRemainder() {
        var deal = extended(false, "7.99", 2, "5.00", null);
        assertThat(quote(List.of(row("rice", 100d, false)), "20", List.of(deal), Set.of()).baskets().get(0).knownTotal()).isEqualByComparingTo("5.00");
        assertThat(quote(List.of(row("rice", 2100d, false)), "30", List.of(deal), Set.of()).baskets().get(0).knownTotal()).isEqualByComparingTo("20.98");
    }
    @Test void threePacksCanCombineOneBundleAndOneRegularPackBelowTheLimit() {
        var basket = quote(List.of(row("rice", 1500d, false)), "20", List.of(extended(false, "7.99", 2, "5.00", null)), Set.of()).baskets().get(0);
        assertThat(basket.knownTotal()).isEqualByComparingTo("12.99");
        assertThat(basket.items().get(0).packages()).isEqualByComparingTo("3");
        assertThat(basket.items().get(0).leftoverAmount()).isZero();
    }
    @Test void unknownRegularPriceStillRequiresCompleteBundles() {
        var basket = quote(List.of(row("rice", 1500d, false)), "20", List.of(extended(false, "7.99", 2, null, null)), Set.of()).baskets().get(0);
        assertThat(basket.knownTotal()).isEqualByComparingTo("15.98");
        assertThat(basket.items().get(0).packages()).isEqualByComparingTo("4");
    }
    @Test void overbuyingAnotherBundleCanBeCheaperThanTheRegularRemainder() {
        var basket = quote(List.of(row("rice", 1500d, false)), "30", List.of(extended(false, "7.99", 2, "20.00", null)), Set.of()).baskets().get(0);
        assertThat(basket.knownTotal()).isEqualByComparingTo("15.98");
        assertThat(basket.items().get(0).packages()).isEqualByComparingTo("4");
    }
    @Test void anOngoingPlanCanBeQuotedTodayWithoutExcludingSavedPastMeals() {
        LocalDate today = LocalDate.now(ZoneId.of("Europe/Warsaw"));
        var plans = mock(MealPlanService.class); var offers = mock(StoreOfferService.class);
        var service = new MealPlanPricingService(plans, offers, names);
        var settings = new Create(UUID.randomUUID(), today.minusDays(1), 7, 2, Set.of(MealType.DINNER), Set.of(Store.LIDL), null, "en", 30,
                PlanningMode.DEALS, BudgetMode.NONE, new ShoppingOptions(today.minusDays(1), 1, Set.of(), Set.of(), Set.of(), false));
        var recipe = new org.jakub.backendapi.dto.RecipeDto(null, "Rice", List.of(), List.of("Cook."), "", "20 min", 2);
        var past = new Slot(UUID.randomUUID(), today.minusDays(1), MealType.DINNER, 2, false, false, recipe, null, null, null);
        var upcoming = new Slot(UUID.randomUUID(), today.plusDays(1), MealType.DINNER, 2, false, false, recipe, null, null, null);
        var shopping = new Shopping(Instant.now(), List.of(row("rice", 200d, false)), Set.of());
        var plan = new View(settings.requestId(), 2, Instant.now(), new Document(2, settings, Status.DRAFT, List.of(past, upcoming), shopping));
        when(plans.get("user", plan.id())).thenReturn(plan);
        when(plans.previewShopping("user", plan.id(), plan.plan().slots())).thenReturn(shopping);
        when(offers.eligible(org.mockito.ArgumentMatchers.eq(Set.of(Store.LIDL)), org.mockito.ArgumentMatchers.eq(today), org.mockito.ArgumentMatchers.any())).thenReturn(List.of());
        var quote = service.preview("user", plan.id(), new QuoteRequest(2, today, Set.of()));
        assertThat(quote.shoppingDate()).isEqualTo(today);
        assertThat(quote.baskets().get(0).items()).singleElement().satisfies(item -> assertThat(item.requiredAmount()).isEqualTo(200d));
        assertThat(plan.plan().settings().shopping().shoppingDate()).isEqualTo(today.minusDays(1));
        assertThatThrownBy(() -> service.preview("user", plan.id(), new QuoteRequest(2, today.plusDays(2), Set.of())))
                .isInstanceOf(org.jakub.backendapi.exceptions.AppException.class);
    }

    private Offer extended(boolean weighted, String bundle, Integer bundleSize, String regular, String step) {
        return new Offer(UUID.randomUUID(), 0, true, new Publish(0, Store.LIDL, 1L, "Rice", new BigDecimal(weighted ? "1000" : "500"), "g",
                (bundle != null ? null : new BigDecimal(weighted ? "10" : "4")), weighted ? 1 : 2, weighted ? 1 : 2, weighted ? null : 4, false, day, day,
                "https://www.lidl.pl/p/test", "Controlled test", now, true, !weighted, true, false,
                bundle == null ? null : new BigDecimal(bundle), bundleSize, regular == null ? null : new BigDecimal(regular), "DRY", weighted, step == null ? null : new BigDecimal(step), null));
    }

    private Quote quote(List<ShoppingItem> rows, String budget, List<Offer> offers, Set<Store> loyalty) {
        Create settings = new Create(UUID.randomUUID(), day, 1, 2, Set.of(MealType.DINNER), Set.of(Store.LIDL, Store.BIEDRONKA), new BigDecimal(budget), "en", 30);
        View view = new View(settings.requestId(), 2, now, new Document(1, settings, Status.ACCEPTED, List.of(), new Shopping(now, rows, Set.of())));
        return pricing.calculate(view, new QuoteRequest(2, day, loyalty), offers, now);
    }
    private ShoppingItem row(String name, Double amount, boolean review) { return new ShoppingItem(name, name, amount, "g", 0, List.of(), review); }
    private Offer offer(Store store, String size, String price, int min, int multiple, Integer max, boolean loyalty, LocalDate from, LocalDate to, Instant verified) {
        return new Offer(UUID.randomUUID(), 0, true, new Publish(0, store, 1L, "Pack of rice", new BigDecimal(size), "g", new BigDecimal(price),
                min, multiple, max, loyalty, from, to, "https://www.lidl.pl/test-fixture", "Test fixture only", verified, true, true, true, false, null, null, null, null, false, null, null));
    }
}
