package org.jakub.backendapi.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public class RecipeShoppingPreviewRequestDto {
    @NotNull
    @Positive
    private Long recipeId;

    @Min(1)
    @Max(100)
    private int targetServings = 2;

    private boolean excludeStaples;

    public Long getRecipeId() { return recipeId; }
    public void setRecipeId(Long recipeId) { this.recipeId = recipeId; }
    public int getTargetServings() { return targetServings; }
    public void setTargetServings(int targetServings) { this.targetServings = targetServings; }
    public boolean isExcludeStaples() { return excludeStaples; }
    public void setExcludeStaples(boolean excludeStaples) { this.excludeStaples = excludeStaples; }
}
