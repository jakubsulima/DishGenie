package org.jakub.backendapi.controllers;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.jakub.backendapi.dto.RecipeDto;
import org.jakub.backendapi.dto.RecipeGenerationRequestDto;
import org.jakub.backendapi.dto.RecipeResponseDto;
import org.jakub.backendapi.dto.UserDto;
import org.jakub.backendapi.dto.UserPreferencesDto;
import org.jakub.backendapi.services.GeminiService;
import org.jakub.backendapi.services.PostHogService;
import org.jakub.backendapi.services.RateLimitService;
import org.jakub.backendapi.services.RecipeService;
import org.jakub.backendapi.services.UserPreferencesService;
import org.jakub.backendapi.services.UserService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;


@RestController
public class RecipesController {
    private static final Logger log = LoggerFactory.getLogger(RecipesController.class);

    private final RecipeService recipeService;
    private final UserService userService;
    private final UserPreferencesService userPreferencesService;
    private final GeminiService geminiService;
    private final PostHogService postHogService;
    private final RateLimitService rateLimitService;
    private final MeterRegistry meterRegistry;

    @Value("${app.limits.generate-recipe-requests-per-minute:${GENERATE_RECIPE_LIMIT_PER_MINUTE:15}}")
    private int generateRecipeLimitPerMinute;

    @Value("${security.trusted-proxy-ips:}")
    private String trustedProxyIps;

    public RecipesController(RecipeService recipeService, UserService userService, UserPreferencesService userPreferencesService, GeminiService geminiService, PostHogService postHogService, RateLimitService rateLimitService, MeterRegistry meterRegistry) {
        this.recipeService = recipeService;
        this.userService = userService;
        this.userPreferencesService = userPreferencesService;
        this.geminiService = geminiService;
        this.postHogService = postHogService;
        this.rateLimitService = rateLimitService;
        this.meterRegistry = meterRegistry;
    }

    @PostMapping("/addRecipe")
    public ResponseEntity<RecipeDto> addRecipe(@Valid @RequestBody RecipeDto recipeDto) {
        String userEmail = getAuthenticatedUserEmail();
        recipeService.saveRecipe(recipeDto, userEmail);
        captureUserEvent(userEmail, "recipe_saved", Map.of(
                "ingredientCount", recipeDto.getIngredients() != null ? recipeDto.getIngredients().size() : 0,
                "instructionCount", recipeDto.getInstructions() != null ? recipeDto.getInstructions().size() : 0
        ));
        return ResponseEntity.ok(recipeDto);
    }

    @GetMapping("/getAllRecipes")
    public ResponseEntity<Page<RecipeDto>> getAllRecipes(Pageable p) {
        Pageable effectivePageable = p;
        String authenticatedUserEmail = getAuthenticatedUserEmail();
        if (!StringUtils.hasText(authenticatedUserEmail)) {
            effectivePageable = PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "id"));
        }

        Page<RecipeDto> recipes = recipeService.getAllRecipes(effectivePageable);
        return ResponseEntity.ok(recipes);
    }

    @GetMapping("/searchRecipes/{searchTerm}")
    public ResponseEntity<Page<RecipeDto>> searchRecipes(@PathVariable String searchTerm, Pageable p) {
        Page<RecipeDto> recipes = recipeService.searchRecipes(searchTerm, p);
        return ResponseEntity.ok(recipes);
    }

    @GetMapping("/getRecipe/{identifier}")
    public ResponseEntity<RecipeDto> getRecipe(@PathVariable String identifier) {
        RecipeDto recipe = recipeService.getRecipeByIdentifier(identifier);
        return ResponseEntity.ok(recipe);
    }

    @GetMapping("/getRecipeByName/{name}")
    public ResponseEntity<RecipeDto> getRecipeByName(@PathVariable String name) {
        RecipeDto recipe = recipeService.getRecipeByName(name);
        return ResponseEntity.ok(recipe);
    }

    @DeleteMapping("/deleteRecipe/{id}")
    public ResponseEntity<RecipeResponseDto> deleteRecipe(@PathVariable Long id) {
        RecipeResponseDto recipeResponseDto = recipeService.deleteRecipe(id, getAuthenticatedUserEmail());
        return ResponseEntity.ok(recipeResponseDto);
    }

    @GetMapping("/getUserRecipes/{userId}")
    public ResponseEntity<Page<RecipeDto>> getUserRecipes(@PathVariable long userId, Pageable p) {
        Page<RecipeDto> recipes = recipeService.findRecipesByUserId(userId, p, getAuthenticatedUserEmail());
        return ResponseEntity.ok(recipes);
    }

    @PostMapping("/updateRecipe/{id}")
    public ResponseEntity<RecipeDto> updateRecipe(@PathVariable Long id, @Valid @RequestBody RecipeDto recipeDto) {
        RecipeDto updatedRecipe = recipeService.updateRecipe(id, recipeDto, getAuthenticatedUserEmail());
        return ResponseEntity.ok(updatedRecipe);
    }

    // Admin Recipe Endpoints
    @PutMapping("/admin/recipes/{id}")
    public ResponseEntity<RecipeDto> adminUpdateRecipe(@PathVariable Long id, @Valid @RequestBody RecipeDto recipeDto) {
        RecipeDto updatedRecipe = recipeService.adminUpdateRecipe(id, recipeDto);
        return ResponseEntity.ok(updatedRecipe);
    }

    @DeleteMapping("/admin/deleteRecipe/{id}")
    public ResponseEntity<RecipeResponseDto> adminDeleteRecipe(@PathVariable Long id) {
        RecipeResponseDto recipeResponseDto = recipeService.adminDeleteRecipe(id);
        return ResponseEntity.ok(recipeResponseDto);
    }

    @PostMapping("/generateRecipe")
    public ResponseEntity<String> createRecipe(@Valid @RequestBody RecipeGenerationRequestDto recipeRequest, HttpServletRequest request) {
        String recipePrompt = recipeRequest != null ? recipeRequest.prompt() : null;
        String userEmail = getAuthenticatedUserEmail();
        int recipeCount = recipeRequest != null && recipeRequest.count() != null ? recipeRequest.count() : 1;

        if (!StringUtils.hasText(recipePrompt)) {
            return ResponseEntity.badRequest().body("Missing prompt. Provide 'prompt' in request body.");
        }

        String clientKey = resolveClientKey(request);
        rateLimitService.assertAllowed(
            "generateRecipe:" + clientKey,
            Math.max(1, generateRecipeLimitPerMinute),
            60_000L,
            "Too many recipe generation requests. Please try again in a minute."
        );

        boolean generationReserved = StringUtils.hasText(userEmail);
        if (generationReserved) {
            userService.reserveRecipeGeneration(userEmail);
        }

        UserPreferencesDto preferences = resolvePromptPreferences(userEmail);

        String generatedRecipe;
        Timer.Sample generationTimer = Timer.start(meterRegistry);
        String generationOutcome = "success";
        try {
            if (recipeRequest.isLegacyPayload()) {
                generatedRecipe = geminiService.generateRecipes(
                        appendPreferencesToPrompt(recipePrompt, preferences),
                        recipeRequest.legacyFridgeItemNames(),
                        recipeRequest.locale(),
                        recipeCount
                );
            } else {
                generatedRecipe = geminiService.generateRecipes(recipeRequest, preferences);
            }
        } catch (RuntimeException exception) {
            generationOutcome = "failure";
            meterRegistry.counter("dish_genie.recipe.generation.failures").increment();
            if (generationReserved) {
                userService.releaseRecipeGeneration(userEmail);
            }
            throw exception;
        } finally {
            generationTimer.stop(meterRegistry.timer(
                    "dish_genie.recipe.generation.duration",
                    "outcome",
                    generationOutcome
            ));
        }

        if (StringUtils.hasText(userEmail)) {
            captureUserEvent(userEmail, "recipe_generation_succeeded", Map.of(
                    "generatedRecipeCount", recipeCount,
                    "hasDietPreferences", preferences != null && preferences.getDiets() != null && preferences.getDiets().length > 0,
                    "hasDislikedIngredients", preferences != null && preferences.getDislikedIngredients() != null && preferences.getDislikedIngredients().length > 0
            ));
        }
        return ResponseEntity.ok(generatedRecipe);
    }

    private void captureUserEvent(String userEmail, String eventName, Map<String, Object> properties) {
        UserDto user = userService.findByEmail(userEmail);
        postHogService.captureIdentifiedEvent(String.valueOf(user.getId()), eventName, properties);
    }

    private String appendPreferencesToPrompt(String recipePrompt, UserPreferencesDto preferences) {
        String diets = "none";
        String dislikedIngredients = "none";

        if (preferences != null) {
            diets = formatDiets(preferences.getDiets(), preferences.getDiet());
            dislikedIngredients = formatDislikedIngredients(preferences.getDislikedIngredients());
        }

        return recipePrompt
                + "\n\nUser Preferences:\n"
                + "- Diets: " + diets + "\n"
                + "- Disliked ingredients: " + dislikedIngredients + "\n"
                + "- Follow these preferences strictly when creating the recipe.";
    }

    private UserPreferencesDto resolvePromptPreferences(String userEmail) {
        UserPreferencesDto fallbackPreferences = new UserPreferencesDto();

        if (!StringUtils.hasText(userEmail)) {
            return fallbackPreferences;
        }

        try {
            UserPreferencesDto preferences = userPreferencesService.getPreferences(userEmail);
            return preferences != null ? preferences : fallbackPreferences;
        } catch (Exception e) {
            log.warn("Could not retrieve user preferences for {}: {}", userEmail, e.getMessage());
            return fallbackPreferences;
        }
    }

    private String formatDislikedIngredients(String[] dislikedIngredients) {
        if (dislikedIngredients == null || dislikedIngredients.length == 0) {
            return "none";
        }

        String formatted = Arrays.stream(dislikedIngredients)
                .filter(StringUtils::hasText)
                .map(String::trim)
                .collect(Collectors.joining(", "));

        return StringUtils.hasText(formatted) ? formatted : "none";
    }

    private String formatDiets(String[] diets, String fallbackDiet) {
        if (diets != null && diets.length > 0) {
            String formatted = Arrays.stream(diets)
                    .filter(StringUtils::hasText)
                    .map(String::trim)
                    .collect(Collectors.joining(", "));
            if (StringUtils.hasText(formatted)) {
                return formatted;
            }
        }

        if (StringUtils.hasText(fallbackDiet)) {
            return fallbackDiet;
        }

        return "none";
    }

    private String resolveClientKey(HttpServletRequest request) {
        String userEmail = getAuthenticatedUserEmail();
        if (StringUtils.hasText(userEmail)) {
            return userEmail;
        }

        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(forwardedFor) && isFromTrustedProxy(request.getRemoteAddr())) {
            return forwardedFor.split(",")[0].trim();
        }

        return request.getRemoteAddr();
    }

    private String getAuthenticatedUserEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof UserDto userDto) {
            return userDto.getEmail();
        }

        return null;
    }

    private boolean isFromTrustedProxy(String remoteAddr) {
        Set<String> trusted = Arrays.stream(trustedProxyIps.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .collect(Collectors.toSet());

        return trusted.contains(remoteAddr);
    }
}
