package org.jakub.backendapi.config;

import tools.jackson.core.JsonParser;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;

public class CommaSeparatedStringToArrayDeserializer extends ValueDeserializer<String[]> {

    @Override
    public String[] deserialize(JsonParser p, DeserializationContext ctxt) {
        String value = p.getText();
        if (value == null || value.trim().isEmpty()) {
            return new String[0];
        }
        return value.trim().split("\\s*,\\s*");
    }
}

