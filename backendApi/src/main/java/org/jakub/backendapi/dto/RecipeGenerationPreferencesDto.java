package org.jakub.backendapi.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class RecipeGenerationPreferencesDto {

    @Pattern(regexp = "BREAKFAST|LUNCH|DINNER|SNACK|DESSERT|ANY", message = "Meal type is invalid")
    private String mealType;

    @Min(value = 1, message = "Maximum preparation time must be at least 1 minute")
    @Max(value = 240, message = "Maximum preparation time must not exceed 240 minutes")
    private Integer maxMinutes;

    @Pattern(regexp = "LOW|MEDIUM|HIGH", message = "Effort is invalid")
    private String effort;

    @Pattern(regexp = "FRESH|COMFORTING|LIGHT|HEARTY|ANY", message = "Mood is invalid")
    private String mood;

    @Pattern(regexp = "BALANCED|SPICY|SWEET|SAVORY|TANGY|ANY", message = "Flavor is invalid")
    private String flavor;

    @jakarta.validation.constraints.Size(max = 8, message = "Too many additional constraints")
    private List<String> constraints = new ArrayList<>();

    public String getMealType() {
        return mealType;
    }

    public void setMealType(String mealType) {
        this.mealType = normalize(mealType);
    }

    public Integer getMaxMinutes() {
        return maxMinutes;
    }

    public void setMaxMinutes(Integer maxMinutes) {
        this.maxMinutes = maxMinutes;
    }

    public String getEffort() {
        return effort;
    }

    public void setEffort(String effort) {
        this.effort = normalize(effort);
    }

    public String getMood() {
        return mood;
    }

    public void setMood(String mood) {
        this.mood = normalize(mood);
    }

    public String getFlavor() {
        return flavor;
    }

    public void setFlavor(String flavor) {
        this.flavor = normalize(flavor);
    }

    public List<String> getConstraints() {
        return constraints;
    }

    public void setConstraints(List<String> constraints) {
        this.constraints = constraints == null ? new ArrayList<>() : new ArrayList<>(constraints);
    }

    private String normalize(String value) {
        return value == null || value.trim().isEmpty()
                ? null
                : value.trim().toUpperCase(Locale.ROOT);
    }
}
