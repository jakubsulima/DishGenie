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
}
