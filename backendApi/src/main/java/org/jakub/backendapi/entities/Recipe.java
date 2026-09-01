package org.jakub.backendapi.entities;

import jakarta.persistence.*;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.ColumnDefault;
import org.jakub.backendapi.entities.Enums.RecipeVisibility;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "recipe")
public class Recipe {

    @Id
    @GeneratedValue
    private Long id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RecipeVisibility visibility = RecipeVisibility.PRIVATE;

    @Column(nullable = false)
    @ColumnDefault("2")
    private int servings = 2;

    @OneToMany(mappedBy = "recipe", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RecipeIngredient> recipeIngredients = new ArrayList<>();

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(columnDefinition = "TEXT")
    private String description;

    @ElementCollection
    @BatchSize(size = 50)
    @CollectionTable(name = "recipe_instructions", joinColumns = @JoinColumn(name = "recipe_id"))
    @Column(name = "instruction", columnDefinition = "TEXT")
    private List<String> instructions = new ArrayList<>();

    @Column
    private String timeToPrepare;

    @Column(name = "nutrition_calories")
    private Double nutritionCalories;

    @Column(name = "nutrition_protein")
    private Double nutritionProtein;

    @Column(name = "nutrition_carbs")
    private Double nutritionCarbs;

    @Column(name = "nutrition_fats")
    private Double nutritionFats;

    @UpdateTimestamp
    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "updated_at")
    private Instant updatedAt;

    public Recipe() {
    }

    public Recipe(Long id, String name, List<RecipeIngredient> recipeIngredients, User user, String description, List<String> instructions) {
        this.id = id;
        this.name = name;
        this.recipeIngredients = recipeIngredients;
        this.user = user;
        this.description = description;
        this.instructions = instructions;
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

    public RecipeVisibility getVisibility() {
        return visibility;
    }

    public void setVisibility(RecipeVisibility visibility) {
        this.visibility = visibility;
    }

    public int getServings() {
        return servings;
    }

    public void setServings(int servings) {
        this.servings = servings;
    }

    public List<RecipeIngredient> getRecipeIngredients() {
        return recipeIngredients;
    }

    public void setRecipeIngredients(List<RecipeIngredient> recipeIngredients) {
        this.recipeIngredients = recipeIngredients;
    }

    public void addRecipeIngredient(RecipeIngredient recipeIngredient) {
        recipeIngredients.add(recipeIngredient);
        recipeIngredient.setRecipe(this);
    }

    public void removeRecipeIngredient(RecipeIngredient recipeIngredient) {
        recipeIngredients.remove(recipeIngredient);
        recipeIngredient.setRecipe(null);
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public List<String> getInstructions() {
        return instructions;
    }

    public void setInstructions(List<String> instructions) {
        this.instructions = instructions;
    }

    public String getTimeToPrepare() {
        return timeToPrepare;
    }

    public void setTimeToPrepare(String timeToPrepare) {
        this.timeToPrepare = timeToPrepare;
    }

    public Double getNutritionCalories() {
        return nutritionCalories;
    }

    public void setNutritionCalories(Double nutritionCalories) {
        this.nutritionCalories = nutritionCalories;
    }

    public Double getNutritionProtein() {
        return nutritionProtein;
    }

    public void setNutritionProtein(Double nutritionProtein) {
        this.nutritionProtein = nutritionProtein;
    }

    public Double getNutritionCarbs() {
        return nutritionCarbs;
    }

    public void setNutritionCarbs(Double nutritionCarbs) {
        this.nutritionCarbs = nutritionCarbs;
    }

    public Double getNutritionFats() {
        return nutritionFats;
    }

    public void setNutritionFats(Double nutritionFats) {
        this.nutritionFats = nutritionFats;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        Recipe recipe = (Recipe) o;
        return id != null && id.equals(recipe.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }

    @Override
    public String toString() {
        return "Recipe{" +
                "id=" + id +
                ", name='" + name + '\'' +
                ", description='" + description + '\'' +
                ", timeToPrepare='" + timeToPrepare + '\'' +
                ", updatedAt=" + updatedAt +
                '}';
    }
}
