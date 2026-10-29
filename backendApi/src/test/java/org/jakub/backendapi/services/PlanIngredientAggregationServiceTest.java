package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.*;
import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.entities.*;
import org.jakub.backendapi.entities.Enums.Unit;
import org.jakub.backendapi.entities.Enums.QuantityAccuracy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class PlanIngredientAggregationServiceTest {
    private final IngredientNormalizationService names = mock(IngredientNormalizationService.class);
    private final PlanIngredientAggregationService service = new PlanIngredientAggregationService(
            new UnitConversionService(), names, new ServingScalingService());
    private final LocalDate day = LocalDate.of(2026, 10, 29);

    @BeforeEach
    void names() {
        when(names.resolve(anyString(), anyString())).thenAnswer(call -> new IngredientNormalizationService.Resolution(
                IngredientNormalizationService.Status.UNRESOLVED, null, call.getArgument(0), List.of()));
        when(names.canonicalName(anyString())).thenAnswer(call -> ((String) call.getArgument(0)).trim().toLowerCase(Locale.ROOT));
    }

    @Test
    void allocatesFridgeOnceAcrossMealsAndConvertsUnits() {
        var result = service.aggregate(List.of(slot(day, 300, "g", 2), slot(day.plusDays(1), .3, "kg", 2)),
                List.of(stock(400d, Unit.GRAMS, null)), "pl");
        assertThat(result.items()).hasSize(1);
        assertThat(result.items().get(0).amount()).isEqualTo(200d);
        assertThat(result.items().get(0).usedFromFridge()).isEqualTo(400d);
        assertThat(result.items().get(0).slotIds()).hasSize(2);
    }

    @Test
    void excludesExpiredStockAndSkipsMeals() {
        var dinner = slot(day.plusDays(1), 300, "g", 2);
        var skipped = new Slot(UUID.randomUUID(), day, MealType.LUNCH, 2, false, true,
                dinner.recipe(), null, null, null);
        var result = service.aggregate(List.of(dinner, skipped), List.of(stock(400d, Unit.GRAMS, day)), "pl");
        assertThat(result.items().get(0).amount()).isEqualTo(300d);
        assertThat(result.items().get(0).slotIds()).containsExactly(dinner.id());
    }

    @Test
    void unknownStockDoesNotEraseDemandAndIncompatibleUnitsAreNotConverted() {
        var result = service.aggregate(List.of(slot(day, 300, "g", 2)),
                List.of(stock(null, Unit.GRAMS, null), stock(4d, Unit.PIECES, null)), "pl");
        assertThat(result.items().get(0).amount()).isEqualTo(300d);
        assertThat(result.items().get(0).needsReview()).isTrue();
    }

    @Test
    void scalesServingsAndPreservesUnknownRecipeQuantities() {
        var result = service.aggregate(List.of(slot(day, 300, "g", 4), slot(day, 1, "pinch", 2)), List.of(), "pl");
        assertThat(result.items()).hasSize(2);
        assertThat(result.items().get(0).amount()).isEqualTo(600d);
        assertThat(result.items().get(1).amount()).isNull();
        assertThat(result.items().get(1).needsReview()).isTrue();
    }

    @Test
    void consumesEarliestExpiryFirstWithoutMutatingFridge() {
        var later = stock(300d, Unit.GRAMS, day.plusDays(4));
        var earlier = stock(300d, Unit.GRAMS, day);
        var result = service.aggregate(List.of(slot(day, 300, "g", 2), slot(day.plusDays(2), 300, "g", 2)),
                List.of(later, earlier), "pl");
        assertThat(result.items().get(0).amount()).isZero();
        assertThat(earlier.getAmount()).isEqualTo(300d);
        assertThat(later.getAmount()).isEqualTo(300d);
    }

    @Test
    void doesNotTreatCookedAndRawNamesAsTheSameIngredient() {
        var raw = stock(500d, Unit.GRAMS, null);
        raw.setName("ugotowany ryż");
        var result = service.aggregate(List.of(slot(day, 300, "g", 2)), List.of(raw), "pl");
        assertThat(result.items().get(0).amount()).isEqualTo(300d);
    }

    @Test
    void explicitlyUnknownStockCannotCoverDemandEvenWithAnOldAmount() {
        var unknown = stock(1000d, Unit.GRAMS, null);
        unknown.setQuantityAccuracy(QuantityAccuracy.UNKNOWN);
        var result = service.aggregate(List.of(slot(day, 300, "g", 2)), List.of(unknown), "pl");
        assertThat(result.items().get(0).amount()).isEqualTo(300d);
        assertThat(result.items().get(0).needsReview()).isTrue();
    }

    private Slot slot(LocalDate date, double amount, String unit, int servings) {
        var recipe = new RecipeDto(null, "Ryż", List.of(new RecipeIngredientDto("ryż", amount, unit)),
                List.of("Ugotuj"), "", "20 min", 2);
        return new Slot(UUID.randomUUID(), date, MealType.DINNER, servings, false, false, recipe, null, null, null);
    }
    private FridgeIngredient stock(Double amount, Unit unit, LocalDate expiry) {
        var item = new FridgeIngredient(null, "ryż", expiry, amount, unit, null);
        item.setQuantityAccuracy(amount == null ? QuantityAccuracy.UNKNOWN : QuantityAccuracy.EXACT);
        return item;
    }
}
