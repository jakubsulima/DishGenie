package org.jakub.backendapi.mappers;

import org.jakub.backendapi.dto.RecipeIngredientDto;
import org.jakub.backendapi.entities.RecipeIngredient;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface RecipeIngredientMapper {
    @Mapping(source = "ingredient.name", target = "name")
    RecipeIngredientDto toRecipeIngredientDto(RecipeIngredient recipeIngredient);

    @org.mapstruct.AfterMapping
    default void preserveDisplayName(RecipeIngredient source, @org.mapstruct.MappingTarget RecipeIngredientDto target) {
        if (source.getDisplayName() != null && !source.getDisplayName().isBlank()) {
            target.setName(source.getDisplayName());
        }
    }

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "recipe", ignore = true)
    @Mapping(target = "displayName", ignore = true)
    @Mapping(source = "name", target = "ingredient.name")
    @Mapping(target = "ingredient.id", ignore = true)
    @Mapping(target = "ingredient.recipeIngredients", ignore = true)
    RecipeIngredient toRecipeIngredient(RecipeIngredientDto recipeIngredientDto);
}
