package org.jakub.backendapi.controllers;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.jakub.backendapi.dto.RecipeDto;
import org.jakub.backendapi.dto.RecipeGenerationRequestDto;
import org.jakub.backendapi.dto.RecipeResponseDto;
import org.jakub.backendapi.dto.UserDto;
import org.jakub.backendapi.dto.UserPreferencesDto;
import org.jakub.backendapi.dto.RecipeGenerationResponseDto;
import org.jakub.backendapi.dto.FridgeIngredientDto;
import org.jakub.backendapi.entities.FridgeIngredient;
import org.jakub.backendapi.entities.Enums.ContentLocale;
import org.jakub.backendapi.repositories.FridgeIngredientRepository;
import org.jakub.backendapi.services.GeneratedRecipeValidator;
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
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;


@RestController
public class RecipesController {
    private static final Logger log = LoggerFactory.getLogger(RecipesController.class);
    private static final int PUBLIC_RECIPE_PAGE_SIZE = 10;

    private final RecipeService recipeService;
    private final UserService userService;
    private final UserPreferencesService userPreferencesService;
    private final GeminiService geminiService;
    private final PostHogService postHogService;
    private final RateLimitService rateLimitService;
    private final MeterRegistry meterRegistry;
    private final FridgeIngredientRepository fridgeIngredientRepository;
    private final GeneratedRecipeValidator generatedRecipeValidator;

    @Value("${app.limits.generate-recipe-requests-per-minute:${GENERATE_RECIPE_LIMIT_PER_MINUTE:15}}")
    private int generateRecipeLimitPerMinute;

    @Value("${security.trusted-proxy-ips:}")
    private String trustedProxyIps;

    public RecipesController(RecipeService recipeService, UserService userService, UserPreferencesService userPreferencesService, GeminiService geminiService, PostHogService postHogService, RateLimitService rateLimitService, MeterRegistry meterRegistry) {
        this(recipeService, userService, userPreferencesService, geminiService, postHogService, rateLimitService, meterRegistry, null, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public RecipesController(RecipeService recipeService, UserService userService, UserPreferencesService userPreferencesService, GeminiService geminiService, PostHogService postHogService, RateLimitService rateLimitService, MeterRegistry meterRegistry, FridgeIngredientRepository fridgeIngredientRepository, GeneratedRecipeValidator generatedRecipeValidator) {
        this.recipeService = recipeService;
        this.userService = userService;
        this.userPreferencesService = userPreferencesService;
        this.geminiService = geminiService;
        this.postHogService = postHogService;
        this.rateLimitService = rateLimitService;
        this.meterRegistry = meterRegistry;
        this.fridgeIngredientRepository = fridgeIngredientRepository;
        this.generatedRecipeValidator = generatedRecipeValidator;
    }

    @PostMapping("/addRecipe")
    public ResponseEntity<RecipeDto> addRecipe(@Valid @RequestBody RecipeDto recipeDto) {
        String userEmail = getAuthenticatedUserEmail();
        RecipeDto savedRecipe = recipeService.saveRecipeDto(recipeDto, userEmail);
        captureUserEvent(userEmail, "recipe_saved", Map.of(
                "ingredientCount", recipeDto.getIngredients() != null ? recipeDto.getIngredients().size() : 0,
                "instructionCount", recipeDto.getInstructions() != null ? recipeDto.getInstructions().size() : 0
        ));
        return ResponseEntity.ok(savedRecipe);
    }

    @GetMapping("/getAllRecipes")
    public ResponseEntity<Page<RecipeDto>> getAllRecipes(
            Pageable p,
            @RequestParam(required = false) ContentLocale locale
    ) {
        Pageable effectivePageable = p;
        String authenticatedUserEmail = getAuthenticatedUserEmail();
        if (!StringUtils.hasText(authenticatedUserEmail)) {
            effectivePageable = publicRecipePageable();
        }

        Page<RecipeDto> recipes = recipeService.getAllRecipes(effectivePageable, authenticatedUserEmail, locale);
        return ResponseEntity.ok(recipes);
    }

    ResponseEntity<Page<RecipeDto>> getAllRecipes(Pageable p) {
        return getAllRecipes(p, null);
    }

    @GetMapping("/searchRecipes/{searchTerm}")
    public ResponseEntity<Page<RecipeDto>> searchRecipes(
            @PathVariable String searchTerm,
            Pageable p,
            @RequestParam(required = false) ContentLocale locale
    ) {
        String authenticatedUserEmail = getAuthenticatedUserEmail();
        Pageable effectivePageable = StringUtils.hasText(authenticatedUserEmail)
                ? p
                : publicRecipePageable();
        Page<RecipeDto> recipes = recipeService.searchRecipes(
                searchTerm,
                effectivePageable,
                authenticatedUserEmail,
                locale
        );
        return ResponseEntity.ok(recipes);
    }

    ResponseEntity<Page<RecipeDto>> searchRecipes(String searchTerm, Pageable p) {
        return searchRecipes(searchTerm, p, null);
    }

    @GetMapping("/getRecipe/{identifier}")
    public ResponseEntity<RecipeDto> getRecipe(@PathVariable String identifier) {
        RecipeDto recipe = recipeService.getRecipeByIdentifier(identifier, getAuthenticatedUserEmail());
        return ResponseEntity.ok(recipe);
    }

    @GetMapping("/getRecipeByName/{name}")
    public ResponseEntity<RecipeDto> getRecipeByName(@PathVariable String name) {
        RecipeDto recipe = recipeService.getRecipeByName(name, getAuthenticatedUserEmail());
        return ResponseEntity.ok(recipe);
    }

    @DeleteMapping("/deleteRecipe/{id}")
    public ResponseEntity<RecipeResponseDto> deleteRecipe(@PathVariable Long id) {
        RecipeResponseDto recipeResponseDto = recipeService.deleteRecipe(id, getAuthenticatedUserEmail());
        return ResponseEntity.ok(recipeResponseDto);
    }

    @GetMapping("/getUserRecipes/{userId}")
    public ResponseEntity<Page<RecipeDto>> getUserRecipes(
            @PathVariable long userId,
            Pageable p,
            @RequestParam(required = false) ContentLocale locale
    ) {
        Page<RecipeDto> recipes = recipeService.findRecipesByUserId(
                userId, p, getAuthenticatedUserEmail(), locale);
        return ResponseEntity.ok(recipes);
    }

    @PostMapping("/updateRecipe/{id}")
    public ResponseEntity<RecipeDto> updateRecipe(@PathVariable Long id, @Valid @RequestBody RecipeDto recipeDto) {
        RecipeDto updatedRecipe = recipeService.updateRecipe(id, recipeDto, getAuthenticatedUserEmail());
        return ResponseEntity.ok(updatedRecipe);
    }

    @PostMapping("/publishRecipe/{id}")
    public ResponseEntity<RecipeDto> publishRecipe(@PathVariable Long id) {
        return ResponseEntity.ok(recipeService.publishRecipe(id, getAuthenticatedUserEmail()));
    }

    @PostMapping("/unpublishRecipe/{id}")
    public ResponseEntity<RecipeDto> unpublishRecipe(@PathVariable Long id) {
        return ResponseEntity.ok(recipeService.unpublishRecipe(id, getAuthenticatedUserEmail()));
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

    @PostMapping("/v2/recipes/generate")
    public ResponseEntity<RecipeGenerationResponseDto> createRecipeV2(
            @Valid @RequestBody RecipeGenerationRequestDto recipeRequest,
            HttpServletRequest request
    ) {
        String userEmail = getAuthenticatedUserEmail();
        if (generatedRecipeValidator == null || fridgeIngredientRepository == null) {
            throw new org.jakub.backendapi.exceptions.AppException("Recipe generation v2 is not configured.", org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR);
        }

        String clientKey = resolveClientKey(request);
        rateLimitService.assertAllowed(
                "generateRecipe:" + clientKey,
                Math.max(1, generateRecipeLimitPerMinute),
                60_000L,
                "Too many recipe generation requests. Please try again in a minute."
        );

        UserDto currentUser = StringUtils.hasText(userEmail) ? userService.findByEmail(userEmail) : null;
        List<FridgeIngredient> serverItems = currentUser == null
                ? List.of()
                : fridgeIngredientRepository.findByUser_Id(currentUser.getId());
        List<FridgeIngredientDto> fridgeDtos = serverItems.stream().map(item -> new FridgeIngredientDto(
                item.getId(), item.getName(), item.getExpirationDate(), item.getAmount(),
                item.getUnit() == null ? null : item.getUnit().name())).toList();
        java.util.Map<Long, FridgeIngredientDto> itemsById = fridgeDtos.stream()
                .filter(item -> item.getId() != null)
                .collect(Collectors.toMap(FridgeIngredientDto::getId, item -> item));
        List<FridgeIngredientDto> requiredItems = recipeRequest.mustUseFridgeItemIds().stream()
                .map(itemsById::get)
                .toList();
        if (requiredItems.stream().anyMatch(java.util.Objects::isNull)) {
            throw new org.jakub.backendapi.exceptions.AppException("Mandatory fridge items must belong to the current user.", org.springframework.http.HttpStatus.FORBIDDEN);
        }
        recipeRequest.setFridgeItems(fridgeDtos);
        UserPreferencesDto preferences = resolvePromptPreferences(userEmail);
        int count = recipeRequest.count() == null ? 1 : recipeRequest.count();
        boolean generationReserved = StringUtils.hasText(userEmail);
        if (generationReserved) {
            userService.reserveRecipeGeneration(userEmail);
        }

        try {
            com.fasterxml.jackson.databind.JsonNode root = null;
            List<RecipeGenerationResponseDto.ConstraintCheckDto> checks = List.of();
            RuntimeException lastValidationError = null;
            for (int attempt = 0; attempt < 3; attempt++) {
                String generated = geminiService.generateRecipes(recipeRequest, preferences);
                try {
                    root = new com.fasterxml.jackson.databind.ObjectMapper().readTree(generated);
                    checks = generatedRecipeValidator.validate(
                            root, count, preferences, requiredItems,
                            recipeRequest.preferences() == null ? null : recipeRequest.preferences().getMaxMinutes(),
                            recipeRequest.shoppingPolicy(), recipeRequest.servings(), recipeRequest.locale());
                    lastValidationError = null;
                    break;
                } catch (java.io.IOException exception) {
                    lastValidationError = new org.jakub.backendapi.exceptions.AppException(
                            "Generated recipe response is invalid.", org.springframework.http.HttpStatus.BAD_GATEWAY);
                } catch (RuntimeException exception) {
                    lastValidationError = exception;
                }
            }
            if (lastValidationError != null || root == null) {
                throw lastValidationError != null ? lastValidationError
                        : new org.jakub.backendapi.exceptions.AppException(
                        "Generated recipe response is invalid.", org.springframework.http.HttpStatus.BAD_GATEWAY);
            }
            List<com.fasterxml.jackson.databind.JsonNode> recipeNodes = new java.util.ArrayList<>();
            if (count == 1) recipeNodes.add(root); else root.path("recipes").forEach(recipeNodes::add);
            List<RecipeGenerationResponseDto.GeneratedRecipeResultDto> results = new java.util.ArrayList<>();
            for (int index = 0; index < recipeNodes.size(); index++) {
                com.fasterxml.jackson.databind.JsonNode recipe = recipeNodes.get(index);
                if (recipe.isObject()) {
                    ((com.fasterxml.jackson.databind.node.ObjectNode) recipe).put(
                            "locale", "pl".equalsIgnoreCase(recipeRequest.locale()) ? "pl" : "en");
                }
                results.add(new RecipeGenerationResponseDto.GeneratedRecipeResultDto(
                        recipe,
                        recipe.path("fridgeCoverage"),
                        checks.get(index)));
            }
            return ResponseEntity.ok(new RecipeGenerationResponseDto(UUID.randomUUID().toString(), results, List.of()));
        } catch (RuntimeException exception) {
            if (generationReserved) {
                userService.releaseRecipeGeneration(userEmail);
            }
            throw exception;
        }
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

    private Pageable publicRecipePageable() {
        return PageRequest.of(
                0,
                PUBLIC_RECIPE_PAGE_SIZE,
                Sort.by(Sort.Direction.DESC, "id")
        );
    }

    private boolean isFromTrustedProxy(String remoteAddr) {
        Set<String> trusted = Arrays.stream(trustedProxyIps.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .collect(Collectors.toSet());

        return trusted.contains(remoteAddr);
    }
}
