package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.FridgeIngredientDto;
import org.jakub.backendapi.dto.RecipeIngredientDto;
import org.jakub.backendapi.dto.ShoppingListGenerationItemDto;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
        Map<String, List<FridgeIngredientDto>> fridgeItemsByName = new HashMap<>();

        for (FridgeIngredientDto fridgeItem : safeFridgeItems(fridgeItems)) {
            String normalizedName = unitConversionService.normalizeIngredientName(fridgeItem.getName());
            if (!StringUtils.hasText(normalizedName)) {
                continue;
            }

            fridgeItemsByName.computeIfAbsent(normalizedName, ignored -> new ArrayList<>()).add(fridgeItem);
        }

        List<ShoppingListGenerationItemDto> missingIngredients = new ArrayList<>();

        for (RecipeIngredientDto ingredient : safeRecipeIngredients(recipeIngredients)) {
            String normalizedName = unitConversionService.normalizeIngredientName(ingredient.getName());
            if (!StringUtils.hasText(normalizedName)) {
                continue;
            }

            List<FridgeIngredientDto> matchingFridgeItems = fridgeItemsByName.getOrDefault(normalizedName, List.of());
            if (matchingFridgeItems.isEmpty()) {
                missingIngredients.add(toShoppingListItem(ingredient.getName(), ingredient.getAmount(), ingredient.getUnit()));
                continue;
            }

            Double requiredAmount = ingredient.getAmount() > 0 ? ingredient.getAmount() : null;
            UnitConversionService.NormalizedUnit requiredUnit = unitConversionService.normalize(ingredient.getUnit()).orElse(null);
            if (requiredAmount == null || requiredUnit == null) {
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

            if (!hasCompatibleMeasuredItem && !hasUnmeasuredMatch) {
                missingIngredients.add(toShoppingListItem(ingredient.getName(), ingredient.getAmount(), ingredient.getUnit()));
            }
        }

        return missingIngredients;
    }

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
