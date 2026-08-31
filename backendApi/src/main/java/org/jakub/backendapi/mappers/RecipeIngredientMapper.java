package org.jakub.backendapi.mappers;

import org.jakub.backendapi.dto.RecipeIngredientDto;
import org.jakub.backendapi.entities.RecipeIngredient;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface RecipeIngredientMapper {
    @Mapping(source = "ingredient.name", target = "name")
    RecipeIngredientDto toRecipeIngredientDto(RecipeIngredient recipeIngredient);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "recipe", ignore = true)
    @Mapping(source = "name", target = "ingredient.name")
    @Mapping(target = "ingredient.id", ignore = true)
    @Mapping(target = "ingredient.recipeIngredients", ignore = true)
    RecipeIngredient toRecipeIngredient(RecipeIngredientDto recipeIngredientDto);
}
