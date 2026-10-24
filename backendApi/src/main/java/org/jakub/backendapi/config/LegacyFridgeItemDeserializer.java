package org.jakub.backendapi.config;

import tools.jackson.core.JsonParser;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.deser.std.StdDeserializer;
import org.jakub.backendapi.dto.FridgeIngredientDto;

public class LegacyFridgeItemDeserializer extends StdDeserializer<FridgeIngredientDto> {

    public LegacyFridgeItemDeserializer() {
        super(FridgeIngredientDto.class);
    }

    @Override
    public FridgeIngredientDto deserialize(JsonParser parser, DeserializationContext context) {
        if (parser.hasToken(JsonToken.VALUE_STRING)) {
            return new FridgeIngredientDto(null, parser.getValueAsString(), null, null, null);
        }

        if (parser.hasToken(JsonToken.START_OBJECT)) {
            return parser.readValueAs(FridgeIngredientDto.class);
        }

        return (FridgeIngredientDto) context.handleUnexpectedToken(FridgeIngredientDto.class, parser);
    }
}
