package org.jakub.backendapi.dto;

import java.util.List;

public class GenerateShoppingListFromRecipeRequestDto {
    private List<RecipeIngredientDto> ingredients;

    public GenerateShoppingListFromRecipeRequestDto() {
    }

    public GenerateShoppingListFromRecipeRequestDto(List<RecipeIngredientDto> ingredients) {
        this.ingredients = ingredients;
    }

    public List<RecipeIngredientDto> getIngredients() {
        return ingredients;
    }

    public void setIngredients(List<RecipeIngredientDto> ingredients) {
        this.ingredients = ingredients;
    }
}
