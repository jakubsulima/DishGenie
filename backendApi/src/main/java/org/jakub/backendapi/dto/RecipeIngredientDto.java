package org.jakub.backendapi.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.Objects;

public class RecipeIngredientDto {
    @NotBlank(message = "Ingredient name is required")
    @Size(max = 160, message = "Ingredient name must not exceed 160 characters")
    private String name;
    @Positive(message = "Ingredient amount must be positive")
    private double amount;
    @NotBlank(message = "Ingredient unit is required")
    @Size(max = 40, message = "Ingredient unit must not exceed 40 characters")
    private String unit;

    public RecipeIngredientDto() {
    }

    public RecipeIngredientDto(String name, double amount, String unit) {
        this.name = name;
        this.amount = amount;
        this.unit = unit;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public double getAmount() {
        return amount;
    }

    public void setAmount(double amount) {
        this.amount = amount;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        RecipeIngredientDto that = (RecipeIngredientDto) o;
        return Double.compare(that.amount, amount) == 0 && Objects.equals(name, that.name) && Objects.equals(unit, that.unit);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, amount, unit);
    }

    @Override
    public String toString() {
        return "RecipeIngredientDto{" +
                "name='" + name + '\'' +
                ", amount=" + amount +
                ", unit='" + unit + '\'' +
                '}';
    }
}
