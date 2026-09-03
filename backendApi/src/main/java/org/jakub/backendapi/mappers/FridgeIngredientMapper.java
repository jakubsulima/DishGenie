package org.jakub.backendapi.mappers;

import org.jakub.backendapi.dto.FridgeIngredientDto;
import org.jakub.backendapi.entities.Enums.FridgeOperationSource;
import org.jakub.backendapi.entities.Enums.FridgeStockState;
import org.jakub.backendapi.entities.Enums.QuantityAccuracy;
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
        if (fridgeIngredient.getSource() == null) {
            fridgeIngredient.setSource(FridgeOperationSource.MANUAL);
        }
        if (fridgeIngredient.getQuantityAccuracy() == null) {
            fridgeIngredient.setQuantityAccuracy(QuantityAccuracy.UNKNOWN);
        }
        if (fridgeIngredient.getStockState() == null) {
            fridgeIngredient.setStockState(FridgeStockState.IN_STOCK);
        }
        return fridgeIngredient;
    }

    default String fromUnit(Unit unit) {
        return unit == null ? null : unit.getAbbreviation();
    }

    default Unit toUnit(String unit) {
        if (unit == null || unit.isBlank()) {
            return null;
        }

        String normalized = unit.trim();
        for (Unit candidate : Unit.values()) {
            if (candidate.name().equalsIgnoreCase(normalized)
                    || candidate.getAbbreviation().equalsIgnoreCase(normalized)) {
                return candidate;
            }
        }
        throw new IllegalArgumentException("Unknown fridge unit: " + unit);
    }
}
