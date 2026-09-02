package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.RecipeIngredientDto;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ServingScalingService {
    public List<RecipeIngredientDto> scale(List<RecipeIngredientDto> ingredients, int baseServings, int targetServings) {
        if (baseServings < 1 || targetServings < 1) {
            throw new IllegalArgumentException("Servings must be positive");
        }
        double multiplier = (double) targetServings / baseServings;
        return ingredients == null ? List.of() : ingredients.stream()
                .map(ingredient -> new RecipeIngredientDto(
                        ingredient.getName(),
                        ingredient.getAmount() * multiplier,
                        ingredient.getUnit()))
                .toList();
    }
}
