package org.jakub.backendapi.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jakub.backendapi.dto.UserPreferencesDto;
import org.jakub.backendapi.entities.Enums.ShoppingPolicy;
import org.jakub.backendapi.exceptions.AppException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class GeneratedRecipeValidatorTest {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final GeneratedRecipeValidator validator = new GeneratedRecipeValidator();

    @Test
    void rejectsAnimalProductsForUppercaseVeganPreference() throws Exception {
        UserPreferencesDto preferences = new UserPreferencesDto();
        preferences.setDiets(new String[]{"VEGAN"});

        JsonNode recipe = recipeWithIngredient("chicken");

        assertThrows(AppException.class, () -> validator.validate(
                recipe, 1, preferences, List.of(), null, ShoppingPolicy.ALLOWED, 2));
    }

    @Test
    void acceptsVeganIngredientForUppercaseVeganPreference() throws Exception {
        UserPreferencesDto preferences = new UserPreferencesDto();
        preferences.setDiets(new String[]{"VEGAN"});

        JsonNode recipe = recipeWithIngredient("tofu");

        assertDoesNotThrow(() -> validator.validate(
                recipe, 1, preferences, List.of(), null, ShoppingPolicy.ALLOWED, 2));
    }

    @Test
    void rejectsPolishAnimalProductUsingPolishLexicon() throws Exception {
        UserPreferencesDto preferences = new UserPreferencesDto();
        preferences.setDiets(new String[]{"VEGAN"});

        JsonNode recipe = recipeWithIngredient("pierś z kurczaka");

        assertThrows(AppException.class, () -> validator.validate(
                recipe, 1, preferences, List.of(), null, ShoppingPolicy.ALLOWED, 2, "pl"));
    }

    @Test
    void acceptsPolishPlantBasedMilkForVeganDiet() throws Exception {
        UserPreferencesDto preferences = new UserPreferencesDto();
        preferences.setDiets(new String[]{"VEGAN", "DAIRY_FREE"});

        JsonNode recipe = recipeWithIngredient("mleko owsiane");

        assertDoesNotThrow(() -> validator.validate(
                recipe, 1, preferences, List.of(), null, ShoppingPolicy.ALLOWED, 2, "pl"));
    }

    private JsonNode recipeWithIngredient(String ingredientName) throws Exception {
        return objectMapper.readTree("""
                {
                  "servings": 2,
                  "ingredients": [{"name": "%s", "amount": 100, "unit": "g"}],
                  "fridgeCoverage": {"missing": []}
                }
                """.formatted(ingredientName));
    }
}
