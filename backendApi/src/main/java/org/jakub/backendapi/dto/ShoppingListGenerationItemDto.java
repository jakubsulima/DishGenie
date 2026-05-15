package org.jakub.backendapi.dto;

import java.util.Objects;

public class ShoppingListGenerationItemDto {
    private String name;
    private Double amount;
    private String unit;

    public ShoppingListGenerationItemDto() {
    }

    public ShoppingListGenerationItemDto(String name, Double amount, String unit) {
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

    public Double getAmount() {
        return amount;
    }

    public void setAmount(Double amount) {
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
        ShoppingListGenerationItemDto that = (ShoppingListGenerationItemDto) o;
        return Objects.equals(name, that.name) && Objects.equals(amount, that.amount) && Objects.equals(unit, that.unit);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, amount, unit);
    }
}
