package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.FridgeIngredientDto;
import org.jakub.backendapi.dto.RecipeIngredientDto;
import org.jakub.backendapi.dto.ShoppingListGenerationItemDto;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ShoppingListCoverageServiceTest {

    private final ShoppingListCoverageService shoppingListCoverageService = new ShoppingListCoverageService();

    @Test
    void findMissingItems_shouldSkipExactMatch() {
        List<ShoppingListGenerationItemDto> result = shoppingListCoverageService.findMissingItems(
                List.of(recipe("Milk", 1, "l")),
                List.of(fridge("milk", 1d, "LITERS"))
        );

        assertTrue(result.isEmpty());
    }

    @Test
    void findMissingItems_shouldReturnPartialShortage() {
        List<ShoppingListGenerationItemDto> result = shoppingListCoverageService.findMissingItems(
                List.of(recipe("Rice", 500, "g")),
                List.of(fridge("rice", 200d, "GRAMS"))
        );

        assertEquals(List.of(new ShoppingListGenerationItemDto("Rice", 300d, "g")), result);
    }

    @Test
    void findMissingItems_shouldConvertCompatibleUnits() {
        List<ShoppingListGenerationItemDto> result = shoppingListCoverageService.findMissingItems(
                List.of(recipe("Broth", 750, "ml")),
                List.of(fridge("broth", 0.5d, "LITERS"))
        );

        assertEquals(List.of(new ShoppingListGenerationItemDto("Broth", 250d, "ml")), result);
    }

    @Test
    void findMissingItems_shouldTreatUnknownFridgeQuantityAsCovered() {
        List<ShoppingListGenerationItemDto> result = shoppingListCoverageService.findMissingItems(
                List.of(recipe("Eggs", 2, "pcs")),
                List.of(fridge("eggs", null, null))
        );

        assertTrue(result.isEmpty());
    }

    @Test
    void findCoverage_shouldMatchAStoredBaseIngredientToQualifiedRecipeName() {
        ShoppingListCoverageService.Coverage coverage = shoppingListCoverageService.findCoverage(
                List.of(recipe("Olive oil", 30, "ml")),
                List.of(fridge("olive", null, null))
        );

        assertEquals(List.of("Olive oil"), coverage.available());
        assertTrue(coverage.missing().isEmpty());
        assertTrue(coverage.unresolved().isEmpty());
    }

    private RecipeIngredientDto recipe(String name, double amount, String unit) {
        return new RecipeIngredientDto(name, amount, unit);
    }

    private FridgeIngredientDto fridge(String name, Double amount, String unit) {
        FridgeIngredientDto dto = new FridgeIngredientDto();
        dto.setName(name);
        dto.setAmount(amount);
        dto.setUnit(unit);
        return dto;
    }
}
