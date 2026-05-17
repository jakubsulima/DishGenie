package org.jakub.backendapi.mappers;

import org.jakub.backendapi.dto.RecipeIngredientDto;
import org.jakub.backendapi.entities.RecipeIngredient;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface RecipeIngredientMapper {
    RecipeIngredientDto toRecipeIngredientDto(RecipeIngredient recipeIngredient);

    RecipeIngredient toRecipeIngredient(RecipeIngredientDto recipeIngredientDto);
}
