package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.FridgeIngredientDto;
import org.jakub.backendapi.dto.RecipeIngredientDto;
import org.jakub.backendapi.dto.ShoppingListGenerationItemDto;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
public class ShoppingListIngredientMatcher {

    private enum SupportedUnit {
        G("g", "g", 1d),
        KG("kg", "g", 1000d),
        ML("ml", "ml", 1d),
        L("l", "ml", 1000d),
        PCS("pcs", "pcs", 1d);

        private final String canonical;
        private final String baseUnit;
        private final double factor;

        SupportedUnit(String canonical, String baseUnit, double factor) {
            this.canonical = canonical;
            this.baseUnit = baseUnit;
            this.factor = factor;
        }
    }

    public List<ShoppingListGenerationItemDto> findDeterministicMissingIngredients(
            List<RecipeIngredientDto> recipeIngredients,
            List<FridgeIngredientDto> fridgeItems
    ) {
        Map<String, List<FridgeIngredientDto>> fridgeItemsByName = new HashMap<>();

        for (FridgeIngredientDto fridgeItem : safeFridgeItems(fridgeItems)) {
            String normalizedName = normalizeIngredientName(fridgeItem.getName());
            if (!StringUtils.hasText(normalizedName)) {
                continue;
            }

            fridgeItemsByName.computeIfAbsent(normalizedName, ignored -> new ArrayList<>()).add(fridgeItem);
        }

        List<ShoppingListGenerationItemDto> missingIngredients = new ArrayList<>();

        for (RecipeIngredientDto ingredient : safeRecipeIngredients(recipeIngredients)) {
            String normalizedName = normalizeIngredientName(ingredient.getName());
            if (!StringUtils.hasText(normalizedName)) {
                continue;
            }

            List<FridgeIngredientDto> matchingFridgeItems = fridgeItemsByName.getOrDefault(normalizedName, List.of());
            if (matchingFridgeItems.isEmpty()) {
                missingIngredients.add(toShoppingListItem(ingredient.getName(), ingredient.getAmount(), ingredient.getUnit()));
                continue;
            }

            Double requiredAmount = ingredient.getAmount() > 0 ? ingredient.getAmount() : null;
            SupportedUnit requiredUnit = normalizeUnit(ingredient.getUnit());
            if (requiredAmount == null || requiredUnit == null) {
                continue;
            }

            double requiredBaseAmount = toBaseAmount(requiredAmount, requiredUnit);
            double availableBaseAmount = 0d;
            boolean hasCompatibleMeasuredItem = false;
            boolean hasUnmeasuredMatch = false;

            for (FridgeIngredientDto fridgeItem : matchingFridgeItems) {
                Double fridgeAmount = fridgeItem.getAmount();
                SupportedUnit fridgeUnit = normalizeUnit(fridgeItem.getUnit());

                if (fridgeAmount == null || fridgeAmount <= 0 || fridgeUnit == null) {
                    hasUnmeasuredMatch = true;
                    continue;
                }

                if (!requiredUnit.baseUnit.equals(fridgeUnit.baseUnit)) {
                    continue;
                }

                hasCompatibleMeasuredItem = true;
                availableBaseAmount += toBaseAmount(fridgeAmount, fridgeUnit);
            }

            if (hasCompatibleMeasuredItem && availableBaseAmount < requiredBaseAmount) {
                double missingAmount = roundAmount((requiredBaseAmount - availableBaseAmount) / requiredUnit.factor);
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

    private String normalizeIngredientName(String name) {
        return name == null ? "" : name.trim().toLowerCase(Locale.ROOT);
    }

    private SupportedUnit normalizeUnit(String unit) {
        if (!StringUtils.hasText(unit)) {
            return null;
        }

        String normalized = unit.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "g", "gram", "grams" -> SupportedUnit.G;
            case "kg", "kilogram", "kilograms" -> SupportedUnit.KG;
            case "ml", "milliliter", "milliliters" -> SupportedUnit.ML;
            case "l", "liter", "liters", "litre", "litres" -> SupportedUnit.L;
            case "pcs", "pc", "piece", "pieces", "unit", "units" -> SupportedUnit.PCS;
            default -> null;
        };
    }

    private double toBaseAmount(double amount, SupportedUnit unit) {
        return amount * unit.factor;
    }

    private double roundAmount(double amount) {
        return Math.round(amount * 100d) / 100d;
    }

    private String normalizeOutputUnit(String originalUnit, SupportedUnit fallbackUnit) {
        if (StringUtils.hasText(originalUnit)) {
            return originalUnit.trim();
        }
        return fallbackUnit.canonical;
    }

    private ShoppingListGenerationItemDto toShoppingListItem(String name, Double amount, String unit) {
        return new ShoppingListGenerationItemDto(
                name != null ? name.trim() : "",
                amount,
                StringUtils.hasText(unit) ? unit.trim() : null
        );
    }
}
