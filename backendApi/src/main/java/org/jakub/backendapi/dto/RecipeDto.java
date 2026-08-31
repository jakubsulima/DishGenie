package org.jakub.backendapi.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public class RecipeDto {
    private Long id; // Added id field
    @NotBlank(message = "Recipe name is required")
    @Size(max = 160, message = "Recipe name must not exceed 160 characters")
    private String name;
    @Valid
    @NotEmpty(message = "Recipe must contain at least one ingredient")
    @Size(max = 50, message = "Recipe must not contain more than 50 ingredients")
    private List<RecipeIngredientDto> ingredients = new ArrayList<>();
    @NotEmpty(message = "Recipe must contain at least one instruction")
    @Size(max = 50, message = "Recipe must not contain more than 50 instructions")
    private List<@NotBlank(message = "Instruction must not be blank") @Size(max = 1_000, message = "Instruction must not exceed 1000 characters") String> instructions = new ArrayList<>();
    @Size(max = 2_000, message = "Description must not exceed 2000 characters")
    private String description;
    @Size(max = 100, message = "Preparation time must not exceed 100 characters")
    private String timeToPrepare;
    @Valid
    private RecipeNutritionDto nutrition;
    @Min(value = 1, message = "Servings must be at least 1")
    @Max(value = 100, message = "Servings must not exceed 100")
    private int servings;

    public RecipeDto() {
    }

    public RecipeDto(Long id, String name, List<RecipeIngredientDto> ingredients, List<String> instructions, String description, String timeToPrepare, int servings) {
        this.id = id;
        this.name = name;
        this.ingredients = ingredients;
        this.instructions = instructions;
        this.description = description;
        this.timeToPrepare = timeToPrepare;
        this.servings = servings;
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

    public List<RecipeIngredientDto> getIngredients() {
        return ingredients;
    }

    public void setIngredients(List<RecipeIngredientDto> ingredients) {
        this.ingredients = ingredients;
    }

    public List<String> getInstructions() {
        return instructions;
    }

    public void setInstructions(List<String> instructions) {
        this.instructions = instructions;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getTimeToPrepare() {
        return timeToPrepare;
    }

    public void setTimeToPrepare(String timeToPrepare) {
        this.timeToPrepare = timeToPrepare;
    }

    public RecipeNutritionDto getNutrition() {
        return nutrition;
    }

    public void setNutrition(RecipeNutritionDto nutrition) {
        this.nutrition = nutrition;
    }

    public int getServings() {
        return servings;
    }

    public void setServings(int servings) {
        this.servings = servings;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        RecipeDto recipeDto = (RecipeDto) o;
        return servings == recipeDto.servings
                && Objects.equals(id, recipeDto.id)
                && Objects.equals(name, recipeDto.name)
                && Objects.equals(ingredients, recipeDto.ingredients)
                && Objects.equals(instructions, recipeDto.instructions)
                && Objects.equals(description, recipeDto.description)
                && Objects.equals(timeToPrepare, recipeDto.timeToPrepare)
                && Objects.equals(nutrition, recipeDto.nutrition);
    }

    @Override
    public int hashCode() {
        return Objects.hash(
                id,
                name,
                ingredients,
                instructions,
                description,
                timeToPrepare,
                nutrition,
                servings
        );
    }

    @Override
    public String toString() {
        return "RecipeDto{" +
                "id=" + id +
                ", name='" + name + '\'' +
                ", ingredients=" + ingredients +
                ", instructions=" + instructions +
                ", description='" + description + '\'' +
                ", timeToPrepare='" + timeToPrepare + '\'' +
                ", nutrition=" + nutrition +
                ", servings=" + servings +
                '}';
    }
}
