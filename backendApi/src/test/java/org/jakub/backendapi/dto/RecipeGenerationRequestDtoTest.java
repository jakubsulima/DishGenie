package org.jakub.backendapi.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.jakub.backendapi.entities.Enums.FridgePolicy;
import org.jakub.backendapi.entities.Enums.ShoppingPolicy;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class RecipeGenerationRequestDtoTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Test
    void acceptsStructuredGenerationContextAndUsesSafeDefaults() throws Exception {
        RecipeGenerationRequestDto request = objectMapper.readValue("""
                {
                  "requestText": "Lekki włoski makaron na szybki obiad",
                  "locale": "pl",
                  "count": 3,
                  "fridgeItems": [{"id": 12, "name": "szpinak", "amount": 150, "unit": "g", "expirationDate": "02-09-2026"}],
                  "mustUseFridgeItemIds": [12],
                  "preferences": {"mealType": "DINNER", "maxMinutes": 30, "effort": "LOW", "mood": "FRESH", "flavor": "BALANCED"}
                }
                """, RecipeGenerationRequestDto.class);

        assertThat(request.requestText()).isEqualTo("Lekki włoski makaron na szybki obiad");
        assertThat(request.fridgePolicy()).isEqualTo(FridgePolicy.SUGGEST);
        assertThat(request.shoppingPolicy()).isEqualTo(ShoppingPolicy.ALLOWED);
        assertThat(request.fridgeItems()).singleElement().satisfies(item -> {
            assertThat(item.getId()).isEqualTo(12L);
            assertThat(item.getName()).isEqualTo("szpinak");
            assertThat(item.getAmount()).isEqualTo(150D);
            assertThat(item.getExpirationDate()).isEqualTo(LocalDate.of(2026, 9, 2));
        });
        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void adaptsTheLegacyPromptAndFridgeNamesWithoutChangingTheirMeaning() throws Exception {
        RecipeGenerationRequestDto request = objectMapper.readValue("""
                {"prompt":"quick dinner with eggs","fridgeItems":["eggs","rice"],"locale":"en","count":1}
                """, RecipeGenerationRequestDto.class);

        assertThat(request.requestText()).isEqualTo("quick dinner with eggs");
        assertThat(request.fridgeItems()).extracting(FridgeIngredientDto::getName)
                .containsExactly("eggs", "rice");
        assertThat(request.fridgePolicy()).isEqualTo(FridgePolicy.SUGGEST);
        assertThat(request.shoppingPolicy()).isEqualTo(ShoppingPolicy.ALLOWED);
        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void rejectsMandatoryItemsThatAreMissingDuplicatedOrIgnored() {
        FridgeIngredientDto spinach = new FridgeIngredientDto(12L, "szpinak", null, 150D, "g");
        RecipeGenerationRequestDto request = new RecipeGenerationRequestDto(
                "quick dinner", List.of(spinach), "en", 1
        );
        request.setMustUseFridgeItemIds(List.of(12L, 12L, 99L));
        request.setFridgePolicy(FridgePolicy.IGNORE);

        assertThat(validator.validate(request))
                .extracting(violation -> violation.getMessage())
                .contains(
                        "Mandatory fridge items must be present and unique",
                        "Fridge items cannot be mandatory when fridge policy is IGNORE"
                );
    }

    @Test
    void validatesNestedFridgeItemsAndStructuredPreferences() {
        RecipeGenerationRequestDto request = new RecipeGenerationRequestDto();
        request.setRequestText("quick dinner");
        request.setFridgeItems(List.of(new FridgeIngredientDto(-1L, "spinach", null, -2D, "cups")));

        RecipeGenerationPreferencesDto preferences = new RecipeGenerationPreferencesDto();
        preferences.setEffort("EXTREME");
        request.setPreferences(preferences);

        assertThat(validator.validate(request))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("fridgeItems[0].id", "fridgeItems[0].amount", "fridgeItems[0].unit", "preferences.effort");
    }

    @Test
    void rejectsPromptsThatExceedTheAiInputBudget() {
        RecipeGenerationRequestDto request = new RecipeGenerationRequestDto("x".repeat(2_001), null, "en", 3);

        assertThat(validator.validate(request))
                .anyMatch(violation -> violation.getPropertyPath().toString().equals("prompt"));
    }

    @Test
    void acceptsAValidPromptAndRecipeCount() {
        RecipeGenerationRequestDto request = new RecipeGenerationRequestDto("quick dinner with eggs", java.util.List.of("eggs"), "pl", 3);

        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void rejectsRecipeCountsOutsideTheSupportedRange() {
        RecipeGenerationRequestDto request = new RecipeGenerationRequestDto("quick dinner", null, "en", 6);

        assertThat(validator.validate(request))
                .anyMatch(violation -> violation.getPropertyPath().toString().equals("count"));
    }

    @Test
    void rejectsUnsupportedLocalesAndBlankPrompts() {
        RecipeGenerationRequestDto request = new RecipeGenerationRequestDto(" ", null, "de", 1);

        assertThat(validator.validate(request))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("prompt", "locale");
    }
}
