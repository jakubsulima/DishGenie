package org.jakub.backendapi.dto;

import jakarta.validation.constraints.PositiveOrZero;

import java.util.Objects;

public class RecipeNutritionDto {
    @PositiveOrZero(message = "Calories must not be negative")
    private Double calories;
    @PositiveOrZero(message = "Protein must not be negative")
    private Double protein;
    @PositiveOrZero(message = "Carbs must not be negative")
    private Double carbs;
    @PositiveOrZero(message = "Fats must not be negative")
    private Double fats;

    public RecipeNutritionDto() {
    }

    public RecipeNutritionDto(
            Double calories,
            Double protein,
            Double carbs,
            Double fats
    ) {
        this.calories = calories;
        this.protein = protein;
        this.carbs = carbs;
        this.fats = fats;
    }

    public Double getCalories() {
        return calories;
    }

    public void setCalories(Double calories) {
        this.calories = calories;
    }

    public Double getProtein() {
        return protein;
    }

    public void setProtein(Double protein) {
        this.protein = protein;
    }

    public Double getCarbs() {
        return carbs;
    }

    public void setCarbs(Double carbs) {
        this.carbs = carbs;
    }

    public Double getFats() {
        return fats;
    }

    public void setFats(Double fats) {
        this.fats = fats;
    }

    public boolean hasAnyValue() {
        return calories != null
                || protein != null
                || carbs != null
                || fats != null;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        RecipeNutritionDto that = (RecipeNutritionDto) o;
        return Objects.equals(calories, that.calories)
                && Objects.equals(protein, that.protein)
                && Objects.equals(carbs, that.carbs)
                && Objects.equals(fats, that.fats);
    }

    @Override
    public int hashCode() {
        return Objects.hash(calories, protein, carbs, fats);
    }

    @Override
    public String toString() {
        return "RecipeNutritionDto{" +
                "calories=" + calories +
                ", protein=" + protein +
                ", carbs=" + carbs +
                ", fats=" + fats +
                '}';
    }
}
