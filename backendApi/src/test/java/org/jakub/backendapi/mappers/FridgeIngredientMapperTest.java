package org.jakub.backendapi.mappers;

import org.jakub.backendapi.dto.FridgeIngredientDto;
import org.jakub.backendapi.entities.Enums.FridgeOperationSource;
import org.jakub.backendapi.entities.Enums.FridgeStockState;
import org.jakub.backendapi.entities.Enums.QuantityAccuracy;
import org.jakub.backendapi.entities.Enums.Unit;
import org.jakub.backendapi.entities.FridgeIngredient;
import org.jakub.backendapi.entities.User;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;

import static org.junit.jupiter.api.Assertions.assertEquals;

class FridgeIngredientMapperTest {

    private final FridgeIngredientMapper mapper = Mappers.getMapper(FridgeIngredientMapper.class);

    @Test
    void mapsUnitAbbreviationsUsedByShoppingListImports() {
        FridgeIngredientDto dto = new FridgeIngredientDto(null, "maple syrup", null, 15D, "ml");

        FridgeIngredient mapped = mapper.toFridgeIngredientWithUser(dto, new User());

        assertEquals(Unit.MILLILITERS, mapped.getUnit());
    }

    @Test
    void mapsEverySupportedApiUnitFormat() {
        assertEquals(Unit.GRAMS, mapper.toUnit("g"));
        assertEquals(Unit.KILOGRAMS, mapper.toUnit("kg"));
        assertEquals(Unit.LITERS, mapper.toUnit("l"));
        assertEquals(Unit.MILLILITERS, mapper.toUnit("MILLILITERS"));
        assertEquals(Unit.PIECES, mapper.toUnit("pcs"));
    }

    @Test
    void keepsDatabaseSafeDefaultsWhenLegacyClientOmitsInventoryMetadata() {
        FridgeIngredientDto dto = new FridgeIngredientDto(null, "Tomato", null, null, null);

        FridgeIngredient mapped = mapper.toFridgeIngredientWithUser(dto, new User());

        assertEquals(FridgeOperationSource.MANUAL, mapped.getSource());
        assertEquals(QuantityAccuracy.UNKNOWN, mapped.getQuantityAccuracy());
        assertEquals(FridgeStockState.IN_STOCK, mapped.getStockState());
    }
}
