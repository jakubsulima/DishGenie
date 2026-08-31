package org.jakub.backendapi.config;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;
import org.jakub.backendapi.dto.FridgeIngredientDto;

import java.io.IOException;

public class LegacyFridgeItemDeserializer extends StdDeserializer<FridgeIngredientDto> {

    public LegacyFridgeItemDeserializer() {
        super(FridgeIngredientDto.class);
    }

    @Override
    public FridgeIngredientDto deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        if (parser.hasToken(JsonToken.VALUE_STRING)) {
            return new FridgeIngredientDto(null, parser.getValueAsString(), null, null, null);
        }

        if (parser.hasToken(JsonToken.START_OBJECT)) {
            return parser.readValueAs(FridgeIngredientDto.class);
        }

        return (FridgeIngredientDto) context.handleUnexpectedToken(FridgeIngredientDto.class, parser);
    }
}
