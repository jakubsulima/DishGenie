package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.FridgeIngredientDto;
import org.jakub.backendapi.dto.RecipeIngredientDto;
import org.jakub.backendapi.dto.ShoppingListGenerationItemDto;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.ArrayList;
import java.util.List;

@Component
public class ShoppingListCoverageService {

    private final UnitConversionService unitConversionService;

    public ShoppingListCoverageService() {
        this(new UnitConversionService());
    }

    @Autowired
    public ShoppingListCoverageService(UnitConversionService unitConversionService) {
        this.unitConversionService = unitConversionService;
    }

    public List<ShoppingListGenerationItemDto> findMissingItems(
            List<RecipeIngredientDto> recipeIngredients,
            List<FridgeIngredientDto> fridgeItems
    ) {
        return findCoverage(recipeIngredients, fridgeItems).missing();
    }

    public boolean ingredientNamesMatch(String recipeName, String fridgeName) {
        return unitConversionService.ingredientNamesMatch(recipeName, fridgeName);
    }

    public Coverage findCoverage(List<RecipeIngredientDto> recipeIngredients, List<FridgeIngredientDto> fridgeItems) {
        List<FridgeIngredientDto> safeFridgeItems = safeFridgeItems(fridgeItems);

        List<ShoppingListGenerationItemDto> missingIngredients = new ArrayList<>();
        List<ShoppingListGenerationItemDto> unresolvedIngredients = new ArrayList<>();
        List<String> availableIngredients = new ArrayList<>();

        for (RecipeIngredientDto ingredient : safeRecipeIngredients(recipeIngredients)) {
            String normalizedName = unitConversionService.normalizeIngredientName(ingredient.getName());
            if (!StringUtils.hasText(normalizedName)) {
                continue;
            }

            List<FridgeIngredientDto> matchingFridgeItems = safeFridgeItems.stream()
                    .filter(item -> unitConversionService.ingredientNamesMatch(ingredient.getName(), item.getName()))
                    .toList();
            if (matchingFridgeItems.isEmpty()) {
                missingIngredients.add(toShoppingListItem(ingredient.getName(), ingredient.getAmount(), ingredient.getUnit()));
                continue;
            }

            Double requiredAmount = ingredient.getAmount() > 0 ? ingredient.getAmount() : null;
            UnitConversionService.NormalizedUnit requiredUnit = unitConversionService.normalize(ingredient.getUnit()).orElse(null);
            if (requiredAmount == null || requiredUnit == null) {
                unresolvedIngredients.add(toShoppingListItem(ingredient.getName(), ingredient.getAmount(), ingredient.getUnit()));
                continue;
            }

            double requiredBaseAmount = unitConversionService.toBaseAmount(requiredAmount, requiredUnit);
            double availableBaseAmount = 0d;
            boolean hasCompatibleMeasuredItem = false;
            boolean hasUnmeasuredMatch = false;

            for (FridgeIngredientDto fridgeItem : matchingFridgeItems) {
                Double fridgeAmount = fridgeItem.getAmount();
                UnitConversionService.NormalizedUnit fridgeUnit = unitConversionService.normalize(fridgeItem.getUnit()).orElse(null);

                if (fridgeAmount == null || fridgeAmount <= 0 || fridgeUnit == null) {
                    hasUnmeasuredMatch = true;
                    continue;
                }

                if (!unitConversionService.areCompatible(requiredUnit, fridgeUnit)) {
                    continue;
                }

                hasCompatibleMeasuredItem = true;
                availableBaseAmount += unitConversionService.toBaseAmount(fridgeAmount, fridgeUnit);
            }

            if (hasCompatibleMeasuredItem && availableBaseAmount < requiredBaseAmount) {
                double missingAmount = roundAmount(unitConversionService.fromBaseAmount(requiredBaseAmount - availableBaseAmount, requiredUnit));
                missingIngredients.add(toShoppingListItem(ingredient.getName(), missingAmount, normalizeOutputUnit(ingredient.getUnit(), requiredUnit)));
                continue;
            }

            if (hasCompatibleMeasuredItem || hasUnmeasuredMatch) {
                availableIngredients.add(ingredient.getName());
            } else if (!hasCompatibleMeasuredItem && !hasUnmeasuredMatch) {
                unresolvedIngredients.add(toShoppingListItem(ingredient.getName(), ingredient.getAmount(), ingredient.getUnit()));
            }
        }

        return new Coverage(availableIngredients, missingIngredients, unresolvedIngredients);
    }

    public record Coverage(List<String> available, List<ShoppingListGenerationItemDto> missing,
                           List<ShoppingListGenerationItemDto> unresolved) {}

    private List<RecipeIngredientDto> safeRecipeIngredients(List<RecipeIngredientDto> recipeIngredients) {
        return recipeIngredients == null ? List.of() : recipeIngredients;
    }

    private List<FridgeIngredientDto> safeFridgeItems(List<FridgeIngredientDto> fridgeItems) {
        return fridgeItems == null ? List.of() : fridgeItems;
    }

    private double roundAmount(double amount) {
        return Math.round(amount * 100d) / 100d;
    }

    private String normalizeOutputUnit(String originalUnit, UnitConversionService.NormalizedUnit fallbackUnit) {
        if (StringUtils.hasText(originalUnit)) {
            return originalUnit.trim();
        }
        return fallbackUnit.canonical();
    }

    private ShoppingListGenerationItemDto toShoppingListItem(String name, Double amount, String unit) {
        return new ShoppingListGenerationItemDto(
                name != null ? name.trim() : "",
                amount,
                StringUtils.hasText(unit) ? unit.trim() : null
        );
    }
}
