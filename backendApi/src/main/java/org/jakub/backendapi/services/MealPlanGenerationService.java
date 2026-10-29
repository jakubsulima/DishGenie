package org.jakub.backendapi.services;

import jakarta.validation.Validator;
import org.jakub.backendapi.dto.*;
import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.entities.Enums.*;
import org.jakub.backendapi.exceptions.AppException;
import org.jakub.backendapi.repositories.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.JsonNode;
import java.util.*;

/** Provider work runs outside transactions; each result is committed independently. */
@Service
public class MealPlanGenerationService {
    private final MealPlanService plans;
    private final UserService users;
    private final UserPreferencesService preferences;
    private final FridgeIngredientRepository fridge;
    private final UserRepository userRepository;
    private final GeminiService gemini;
    private final GeneratedRecipeValidator generatedValidator;
    private final Validator validator;
    private final RateLimitService rateLimit;
    private final ObjectMapper json;

    public MealPlanGenerationService(MealPlanService plans, UserService users, UserPreferencesService preferences,
            FridgeIngredientRepository fridge, UserRepository userRepository, GeminiService gemini,
            GeneratedRecipeValidator generatedValidator, Validator validator, RateLimitService rateLimit, ObjectMapper json) {
        this.plans = plans; this.users = users; this.preferences = preferences; this.fridge = fridge;
        this.userRepository = userRepository; this.gemini = gemini; this.generatedValidator = generatedValidator;
        this.validator = validator; this.rateLimit = rateLimit; this.json = json;
    }

    public View generate(String email, UUID id, UUID slotId, Generate input) {
        GenerationWork work = plans.beginGeneration(email, id, slotId, input);
        if (!work.execute()) return work.view();
        boolean reserved = false;
        try {
            var user = userRepository.findByEmail(email).orElseThrow();
            rateLimit.assertAllowed("mealPlanGeneration:" + user.getId(), 15, 60_000L,
                    "Too many recipe generation requests. Please try again in a minute.");
            users.reserveRecipeGeneration(email);
            reserved = true;
            Create settings = work.view().plan().settings();
            var request = new RecipeGenerationRequestDto();
            String otherMeals = work.view().plan().slots().stream().filter(s -> s.recipe() != null)
                    .map(s -> s.recipe().getName()).reduce((a, b) -> a + ", " + b).orElse("");
            request.setRequestText("Plan one practical " + work.slot().mealType() + " meal. "
                    + "Prefer variety and shared ingredients. Do not repeat these existing meals: " + otherMeals);
            request.setLocale(settings.locale()); request.setCount(1); request.setServings(work.slot().servings());
            request.setFridgePolicy(FridgePolicy.PRIORITIZE); request.setShoppingPolicy(ShoppingPolicy.MINIMIZE);
            var options = new RecipeGenerationPreferencesDto();
            options.setMealType(work.slot().mealType().name()); options.setMaxMinutes(settings.maxMinutes());
            request.setPreferences(options);
            request.setFridgeItems(fridge.findByUser_Id(user.getId()).stream()
                    .filter(item -> item.getExpirationDate() == null || !item.getExpirationDate().isBefore(work.slot().date()))
                    .map(item -> new FridgeIngredientDto(item.getId(), item.getName(), item.getExpirationDate(), item.getAmount(),
                            item.getUnit() == null ? null : item.getUnit().name())).toList());
            UserPreferencesDto restrictions = preferences.getPreferences(email);
            RecipeDto recipe = null;
            for (int attempt = 0; attempt < 3; attempt++) {
                String response = gemini.generateRecipes(request, restrictions);
                try {
                    JsonNode root = json.readTree(response);
                    generatedValidator.validate(root, 1, restrictions, List.of(), settings.maxMinutes(),
                            ShoppingPolicy.MINIMIZE, work.slot().servings(), settings.locale());
                    recipe = snapshot(root, settings.locale());
                    if (!validator.validate(recipe).isEmpty()) throw new IllegalArgumentException("Invalid recipe snapshot");
                    break;
                } catch (RuntimeException invalid) {
                    recipe = null;
                    if (attempt == 2) throw new AppException("Could not generate a valid meal. Please try again.", HttpStatus.BAD_GATEWAY);
                }
            }
            return plans.finishGeneration(email, id, slotId, input.requestId(), work.view().version(), recipe);
        } catch (RuntimeException failure) {
            if (reserved) users.releaseRecipeGeneration(email);
            plans.failGeneration(email, id, slotId, input.requestId());
            throw failure;
        }
    }

    private RecipeDto snapshot(JsonNode node, String locale) {
        List<RecipeIngredientDto> ingredients = new ArrayList<>();
        node.path("ingredients").forEach(i -> ingredients.add(new RecipeIngredientDto(
                i.path("name").asText(), i.path("amount").asDouble(), i.path("unit").asText())));
        List<String> instructions = new ArrayList<>();
        node.path("instructions").forEach(i -> instructions.add(i.asText()));
        RecipeDto recipe = new RecipeDto(null, node.path("name").asText(), ingredients, instructions,
                node.path("description").asText(), node.path("timeToPrepare").asText(), node.path("servings").asInt());
        recipe.setLocale(ContentLocale.valueOf(locale));
        recipe.setVisibility(RecipeVisibility.PRIVATE);
        return recipe;
    }
}
