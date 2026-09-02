package org.jakub.backendapi.mappers;

import org.jakub.backendapi.dto.FridgeIngredientDto;
import org.jakub.backendapi.entities.Enums.Unit;
import org.jakub.backendapi.entities.FridgeIngredient;
import org.jakub.backendapi.entities.User;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface FridgeIngredientMapper {
    @Mapping(source = "unit", target = "unit")
    FridgeIngredientDto toFridgeIngredientDto(FridgeIngredient fridgeIngredient);

    @Mapping(target = "user", ignore = true)
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "ingredient", ignore = true)
    FridgeIngredient toFridgeIngredient(FridgeIngredientDto fridgeIngredientDto);

    default FridgeIngredient toFridgeIngredientWithUser(FridgeIngredientDto fridgeIngredientDto, User user) {
        FridgeIngredient fridgeIngredient = toFridgeIngredient(fridgeIngredientDto);
        fridgeIngredient.setUser(user);
        return fridgeIngredient;
    }

    default String fromUnit(Unit unit) {
        return unit == null ? null : unit.getAbbreviation();
    }
}
