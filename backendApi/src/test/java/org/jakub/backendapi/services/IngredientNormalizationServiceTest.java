package org.jakub.backendapi.services;

import org.jakub.backendapi.entities.Ingredient;
import org.jakub.backendapi.entities.IngredientAlias;
import org.jakub.backendapi.entities.Enums.ContentLocale;
import org.jakub.backendapi.repositories.IngredientAliasRepository;
import org.jakub.backendapi.repositories.IngredientRepository;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class IngredientNormalizationServiceTest {
    @Test
    void keepsDiacriticsInCanonicalNamesAndUsesAccentFreeAliasKeys() {
        IngredientNormalizationService service = new IngredientNormalizationService(null, null);

        assertThat(service.canonicalName("  Świeże   zioła ")).isEqualTo("świeże zioła");
        assertThat(service.aliasName("  Świeże   zioła ")).isEqualTo("swieze ziola");
    }

    @Test
    void resolvesAliasesOnlyFromTheRequestedLocaleOrGlobalCatalog() {
        IngredientRepository ingredientRepository = mock(IngredientRepository.class);
        IngredientAliasRepository aliasRepository = mock(IngredientAliasRepository.class);
        IngredientNormalizationService service = new IngredientNormalizationService(
                ingredientRepository, aliasRepository);
        Ingredient tomato = new Ingredient();
        tomato.setId(7L);
        IngredientAlias polishAlias = new IngredientAlias();
        polishAlias.setIngredient(tomato);

        when(ingredientRepository.findByCanonicalName("pomidor")).thenReturn(java.util.List.of());
        when(ingredientRepository.findByNameIgnoreCase("pomidor")).thenReturn(java.util.Optional.empty());
        when(aliasRepository.findByNormalizedAliasForLocale("pomidor", ContentLocale.pl))
                .thenReturn(java.util.List.of(polishAlias));

        IngredientNormalizationService.Resolution resolution = service.resolve("pomidor", "pl");

        assertThat(resolution.status()).isEqualTo(IngredientNormalizationService.Status.ALIAS);
        assertThat(resolution.ingredient()).isSameAs(tomato);
    }
}
