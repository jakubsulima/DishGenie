package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.RecipeGenerationRequestDto;
import org.jakub.backendapi.entities.Enums.ShoppingPolicy;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/** Exercises the real provider HTTP serialization, parser and business validator together. */
class GeminiRecipeContractTest {
    private final ObjectMapper json = new ObjectMapper();

    @ParameterizedTest
    @ValueSource(ints = {1, 3})
    void requestsMeasurableUnitsAndRequiredFieldsForSingleAndMultipleRecipes(int count) {
        GeminiService service = new GeminiService(json);
        ReflectionTestUtils.setField(service, "geminiApiKey", "synthetic-test-key");
        ReflectionTestUtils.setField(service, "geminiModel", "test-model");
        RestTemplate client = (RestTemplate) ReflectionTestUtils.getField(service, "restTemplate");
        MockRestServiceServer server = MockRestServiceServer.bindTo(client).build();
        String recipe = """
            {"name":"Ryż z warzywami","description":"Prosty obiad","timeToPrepare":"25 minut","servings":4,
             "ingredients":[{"name":"ryż","amount":300,"unit":"g"},{"name":"sól","amount":2,"unit":"g"},
                            {"name":"cebula","amount":1,"unit":"pcs"}],
             "instructions":["Ugotuj ryż i warzywa."],"nutrition":{"calories":400,"protein":10,"carbs":70,"fats":5}}
            """;
        Object result = count == 1 ? json.readTree(recipe) : Map.of("recipes", IntStream.range(0, count).mapToObj(i -> json.readTree(recipe)).toList());
        String response = json.writeValueAsString(Map.of("candidates", List.of(Map.of("content", Map.of("parts",
                List.of(Map.of("text", json.writeValueAsString(result))))))));
        server.expect(requestTo("https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent"))
                .andExpect(request -> {
                    JsonNode payload = json.readTree(((MockClientHttpRequest) request).getBodyAsString());
                    JsonNode schema = payload.path("generationConfig").path("responseSchema");
                    assertThat(schema.isObject()).as("The HTTP request must constrain the recipe, not just request JSON MIME").isTrue();
                    if (count > 1) {
                        assertThat(schema.path("properties").path("recipes").path("minItems").asInt()).isEqualTo(count);
                        assertThat(schema.path("properties").path("recipes").path("maxItems").asInt()).isEqualTo(count);
                        schema = schema.path("properties").path("recipes").path("items");
                    }
                    JsonNode ingredient = schema.path("properties").path("ingredients").path("items");
                    var allowed = json.convertValue(ingredient.path("properties").path("unit").path("enum"), String[].class);
                    assertThat(allowed).containsExactlyInAnyOrder("g", "kg", "ml", "l", "pcs");
                    for (String value : allowed) assertThat(new UnitConversionService().normalize(value)).isPresent();
                    assertThat(allowed).doesNotContain("szczypta", "łyżeczka", "do smaku", "ząbki");
                    assertThat(json.convertValue(schema.path("required"), String[].class)).contains("servings", "ingredients", "nutrition", "instructions");
                    assertThat(payload.path("contents").toString()).contains("Do not translate unit codes", "do smaku");
                }).andRespond(withSuccess(response, MediaType.APPLICATION_JSON));
        RecipeGenerationRequestDto request = new RecipeGenerationRequestDto();
        request.setRequestText("Obiad"); request.setLocale("pl"); request.setCount(count); request.setServings(4);
        JsonNode generated = json.readTree(service.generateRecipes(request, null));
        new GeneratedRecipeValidator().validate(generated, count, null, List.of(), 45, ShoppingPolicy.ALLOWED, 4, "pl");
        server.verify();
    }
}
