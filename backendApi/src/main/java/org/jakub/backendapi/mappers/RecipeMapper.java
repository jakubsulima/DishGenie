package org.jakub.backendapi.mappers;

import org.jakub.backendapi.dto.RecipeDto;
import org.jakub.backendapi.dto.RecipeNutritionDto;
import org.jakub.backendapi.dto.RecipeResponseDto;
import org.jakub.backendapi.entities.Recipe;
import org.jakub.backendapi.entities.User;
import org.mapstruct.AfterMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

@Mapper(componentModel = "spring", uses = RecipeIngredientMapper.class)
public interface RecipeMapper {
    @Mapping(target = "ingredients", source = "recipeIngredients")
    @Mapping(target = "instructions", source = "instructions")
    @Mapping(target = "nutrition.calories", source = "nutritionCalories")
    @Mapping(target = "nutrition.protein", source = "nutritionProtein")
    @Mapping(target = "nutrition.carbs", source = "nutritionCarbs")
    @Mapping(target = "nutrition.fats", source = "nutritionFats")
    @Mapping(target = "canManage", ignore = true)
    RecipeDto toRecipeDto(Recipe recipe);

    @Mapping(target = "recipeDto", source = "recipe")
    RecipeResponseDto toResponseDto(String message, Recipe recipe);

    @Mapping(target = "recipeIngredients", source = "ingredients")
    @Mapping(target = "nutritionCalories", source = "nutrition.calories")
    @Mapping(target = "nutritionProtein", source = "nutrition.protein")
    @Mapping(target = "nutritionCarbs", source = "nutrition.carbs")
    @Mapping(target = "nutritionFats", source = "nutrition.fats")
    @Mapping(target = "user", ignore = true)
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "visibility", ignore = true)
    Recipe toRecipe(RecipeDto recipeDto);

    @AfterMapping
    default void removeEmptyNutrition(@MappingTarget RecipeDto recipeDto) {
        RecipeNutritionDto nutrition = recipeDto.getNutrition();
        if (nutrition != null && !nutrition.hasAnyValue()) {
            recipeDto.setNutrition(null);
        }
    }

    default Recipe toRecipeWithUser(RecipeDto recipeDto, User user) {
        Recipe recipe = toRecipe(recipeDto);
        recipe.setUser(user);
        recipe.setInstructions(recipeDto.getInstructions());
        return recipe;
    }
}
