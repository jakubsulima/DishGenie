package org.jakub.backendapi.services;

import java.util.List;
import java.util.Map;

/** Gemini's output contract must match the units and fields used by deterministic shopping calculations. */
final class RecipeGenerationSchema {
    private RecipeGenerationSchema() {}

    static Map<String, Object> forCount(int count) {
        // Keep nested array/numeric bounds in server validation: large bounds exceed Gemini 2.5 grammar limits.
        Map<String, Object> text = Map.of("type", "STRING");
        Map<String, Object> number = Map.of("type", "NUMBER");
        Map<String, Object> ingredient = object(Map.of(
                "name", text,
                "amount", Map.of("type", "NUMBER"),
                "unit", Map.of("type", "STRING", "enum", List.of("g", "kg", "ml", "l", "pcs"),
                        "description", "Fixed unit code, never translated. Use g or ml for spices; pcs for countable ingredients.")),
                List.of("name", "amount", "unit"));
        Map<String, Object> recipe = object(Map.of(
                "name", text,
                "description", text,
                "timeToPrepare", text,
                "servings", Map.of("type", "INTEGER"),
                "ingredients", Map.of("type", "ARRAY", "items", ingredient),
                "instructions", Map.of("type", "ARRAY", "items", text),
                "nutrition", object(Map.of("calories", number, "protein", number, "carbs", number, "fats", number),
                        List.of("calories", "protein", "carbs", "fats"))),
                List.of("name", "description", "timeToPrepare", "servings", "ingredients", "instructions", "nutrition"));
        return count == 1 ? recipe : object(Map.of("recipes", Map.of(
                "type", "ARRAY", "items", recipe, "minItems", count, "maxItems", count)), List.of("recipes"));
    }

    private static Map<String, Object> object(Map<String, Object> properties, List<String> required) {
        return Map.of("type", "OBJECT", "properties", properties, "required", required, "propertyOrdering", required);
    }
}
