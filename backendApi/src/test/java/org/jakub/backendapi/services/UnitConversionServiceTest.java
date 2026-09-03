package org.jakub.backendapi.services;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class UnitConversionServiceTest {

    private final UnitConversionService service = new UnitConversionService();

    @Test
    void normalizesEquivalentUnitsAndConvertsToTheSameBase() {
        UnitConversionService.NormalizedUnit kilograms = service.normalize("kg").orElseThrow();
        UnitConversionService.NormalizedUnit grams = service.normalize("GRAMS").orElseThrow();

        assertThat(service.toBaseAmount(1, kilograms)).isEqualTo(1_000);
        assertThat(service.toBaseAmount(500, grams)).isEqualTo(500);
        assertThat(service.areCompatible(kilograms, grams)).isTrue();
    }

    @Test
    void doesNotConvertAcrossDifferentDimensions() {
        UnitConversionService.NormalizedUnit grams = service.normalize("g").orElseThrow();
        UnitConversionService.NormalizedUnit pieces = service.normalize("pcs").orElseThrow();

        assertThat(service.areCompatible(grams, pieces)).isFalse();
    }

    @Test
    void matchesIngredientNamesWithSafeCulinaryQualifiers() {
        assertThat(service.ingredientNamesMatch("olive", "olive oil")).isTrue();
        assertThat(service.ingredientNamesMatch("tomato", "ripe tomatoes")).isTrue();
        assertThat(service.ingredientNamesMatch("basil", "fresh basil leaves")).isTrue();
        assertThat(service.ingredientNamesMatch("rice", "cooked rice")).isTrue();
    }

    @Test
    void doesNotMatchNamesWhenTheExtraWordsChangeTheIngredient() {
        assertThat(service.ingredientNamesMatch("chicken", "chicken broth")).isFalse();
        assertThat(service.ingredientNamesMatch("tomato", "tomato paste")).isFalse();
        assertThat(service.ingredientNamesMatch("oil", "olive oil")).isFalse();
        assertThat(service.ingredientNamesMatch("pepper", "red pepper")).isFalse();
        assertThat(service.ingredientNamesMatch("bean", "black beans")).isFalse();
    }
}
