package org.jakub.backendapi.dto;

import tools.jackson.databind.annotation.JsonDeserialize;
import org.jakub.backendapi.config.CommaSeparatedStringToArrayDeserializer;

import java.util.Arrays;
import java.util.Objects;

public class UserPreferencesDto {

    private String diet;
    private String[] diets;
    @JsonDeserialize(using = CommaSeparatedStringToArrayDeserializer.class)
    private String[] dislikedIngredients;

    public UserPreferencesDto() {
    }

    public UserPreferencesDto(String diet, String[] diets, String[] dislikedIngredients) {
        this.diet = diet;
        this.diets = diets;
        this.dislikedIngredients = dislikedIngredients;
    }

    public String getDiet() {
        return diet;
    }

    public void setDiet(String diet) {
        this.diet = diet;
    }

    public String[] getDiets() {
        return diets;
    }

    public void setDiets(String[] diets) {
        this.diets = diets;
    }

    public String[] getDislikedIngredients() {
        return dislikedIngredients;
    }

    public void setDislikedIngredients(String[] dislikedIngredients) {
        this.dislikedIngredients = dislikedIngredients;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        UserPreferencesDto that = (UserPreferencesDto) o;
        return Objects.equals(diet, that.diet)
                && Arrays.equals(diets, that.diets)
                && Arrays.equals(dislikedIngredients, that.dislikedIngredients);
    }

    @Override
    public int hashCode() {
        int result = Objects.hash(diet);
        result = 31 * result + Arrays.hashCode(diets);
        result = 31 * result + Arrays.hashCode(dislikedIngredients);
        return result;
    }

    @Override
    public String toString() {
        return "UserPreferencesDto{" +
                "diet='" + diet + '\'' +
            ", diets=" + Arrays.toString(diets) +
                ", dislikedIngredients=" + Arrays.toString(dislikedIngredients) +
                '}';
    }
}
