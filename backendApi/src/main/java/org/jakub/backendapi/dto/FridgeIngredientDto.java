package org.jakub.backendapi.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonSetter;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;

import java.time.LocalDate;
import java.util.Objects;

public class FridgeIngredientDto {
    @Positive(message = "Fridge item ID must be positive")
    private Long id;

    @NotBlank(message = "Fridge item name is required")
    @Size(max = 100, message = "Fridge item must not exceed 100 characters")
    private String name;

    @JsonFormat(pattern = "dd-MM-yyyy")
    private LocalDate expirationDate;

    @PositiveOrZero(message = "Fridge item amount cannot be negative")
    private Double amount;

    @Pattern(
            regexp = "(?i)(GRAMS|KILOGRAMS|LITERS|MILLILITERS|PIECES|g|kg|l|ml|pcs)",
            message = "Fridge item unit is invalid"
    )
    private String unit;

    public FridgeIngredientDto() {
    }

    public FridgeIngredientDto(Long id, String name, LocalDate expirationDate, Double amount, String unit) {
        this.id = id;
        this.name = name;
        this.expirationDate = expirationDate;
        this.amount = amount;
        this.unit = unit;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public LocalDate getExpirationDate() {
        return expirationDate;
    }

    public void setExpirationDate(LocalDate expirationDate) {
        this.expirationDate = expirationDate;
    }

    public Double getAmount() {
        return amount;
    }

    @JsonSetter("amount")
    public void setAmount(Object amount) {
        if (amount == null) {
            this.amount = null;
            return;
        }

        if (amount instanceof Number number) {
            this.amount = number.doubleValue();
            return;
        }

        if (amount instanceof String value) {
            String trimmedValue = value.trim();
            if (trimmedValue.isEmpty()) {
                this.amount = null;
                return;
            }
            try {
                this.amount = Double.parseDouble(trimmedValue);
                return;
            } catch (NumberFormatException ignored) {
                throw new IllegalArgumentException("Amount must be a valid number");
            }
        }

        throw new IllegalArgumentException("Amount must be a valid number");
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        if (unit == null) {
            this.unit = null;
            return;
        }
        String trimmedUnit = unit.trim();
        this.unit = trimmedUnit.isEmpty() ? null : trimmedUnit;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        FridgeIngredientDto that = (FridgeIngredientDto) o;
        return Objects.equals(id, that.id) && Objects.equals(name, that.name) && Objects.equals(expirationDate, that.expirationDate) && Objects.equals(amount, that.amount) && Objects.equals(unit, that.unit);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, name, expirationDate, amount, unit);
    }

    @Override
    public String toString() {
        return "FridgeIngredientDto{" +
                "id=" + id +
                ", name='" + name + '\'' +
                ", expirationDate=" + expirationDate +
                ", amount=" + amount +
                ", unit='" + unit + '\'' +
                '}';
    }
}
