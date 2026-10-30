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

    private Quote quote(List<ShoppingItem> rows, String budget, List<Offer> offers, Set<Store> loyalty) {
        Create settings = new Create(UUID.randomUUID(), day, 1, 2, Set.of(MealType.DINNER), Set.of(Store.LIDL, Store.BIEDRONKA), new BigDecimal(budget), "en", 30);
        View view = new View(settings.requestId(), 2, now, new Document(1, settings, Status.ACCEPTED, List.of(), new Shopping(now, rows, Set.of())));
        return pricing.calculate(view, new QuoteRequest(2, day, loyalty), offers, now);
    }
    private ShoppingItem row(String name, Double amount, boolean review) { return new ShoppingItem(name, name, amount, "g", 0, List.of(), review); }
    private Offer offer(Store store, String size, String price, int min, int multiple, Integer max, boolean loyalty, LocalDate from, LocalDate to, Instant verified) {
        return new Offer(UUID.randomUUID(), 0, true, new Publish(0, store, 1L, "Pack of rice", new BigDecimal(size), "g", new BigDecimal(price),
                min, multiple, max, loyalty, from, to, "https://www.lidl.pl/test-fixture", "Test fixture only", verified, true, true, true));
    }
}
