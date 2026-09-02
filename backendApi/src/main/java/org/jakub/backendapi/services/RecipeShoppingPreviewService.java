package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.RecipeDto;
import org.jakub.backendapi.dto.RecipeIngredientDto;
import org.jakub.backendapi.dto.RecipeShoppingPreviewResponseDto;
import org.jakub.backendapi.entities.FridgeIngredient;
import org.jakub.backendapi.entities.User;
import org.jakub.backendapi.exceptions.AppException;
import org.jakub.backendapi.repositories.FridgeIngredientRepository;
import org.jakub.backendapi.repositories.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class RecipeShoppingPreviewService {
    private final RecipeService recipeService;
    private final UserRepository userRepository;
    private final FridgeIngredientRepository fridgeIngredientRepository;
    private final ServingScalingService servingScalingService;
    private final ShoppingListCoverageService coverageService;
    private final IngredientNormalizationService ingredientNormalizationService;

    public RecipeShoppingPreviewService(RecipeService recipeService, UserRepository userRepository,
                                        FridgeIngredientRepository fridgeIngredientRepository,
                                        ServingScalingService servingScalingService,
                                        ShoppingListCoverageService coverageService,
                                        IngredientNormalizationService ingredientNormalizationService) {
        this.recipeService = recipeService;
        this.userRepository = userRepository;
        this.fridgeIngredientRepository = fridgeIngredientRepository;
        this.servingScalingService = servingScalingService;
        this.coverageService = coverageService;
        this.ingredientNormalizationService = ingredientNormalizationService;
    }

    @Transactional(readOnly = true)
    public RecipeShoppingPreviewResponseDto preview(Long recipeId, int targetServings,
                                                    boolean excludeStaples, String email) {
        RecipeDto recipe = recipeService.getRecipeByIdentifier(String.valueOf(recipeId), email);
        List<RecipeIngredientDto> scaled = servingScalingService.scale(
                recipe.getIngredients(), recipe.getServings(), targetServings);
        List<RecipeIngredientDto> requiredIngredients = excludeStaples
                ? scaled.stream().filter(item -> isNotStaple(item, recipe.getLocale().name())).toList()
                : scaled;
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException("User not found", HttpStatus.NOT_FOUND));
        List<org.jakub.backendapi.dto.FridgeIngredientDto> fridgeItems = fridgeIngredientRepository.findByUser_Id(user.getId())
                .stream()
                .map(this::toDto)
                .toList();

        ShoppingListCoverageService.Coverage coverage = coverageService.findCoverage(requiredIngredients, fridgeItems);
        return new RecipeShoppingPreviewResponseDto(
                coverage.missing(), coverage.available(), coverage.unresolved(), targetServings);
    }

    private org.jakub.backendapi.dto.FridgeIngredientDto toDto(FridgeIngredient item) {
        return new org.jakub.backendapi.dto.FridgeIngredientDto(
                item.getId(), item.getName(), item.getExpirationDate(), item.getAmount(),
                item.getUnit() == null ? null : item.getUnit().name());
    }

    private boolean isNotStaple(RecipeIngredientDto item, String locale) {
        IngredientNormalizationService.Resolution resolution = ingredientNormalizationService.resolve(item.getName(), locale);
        return !resolution.isResolved() || !resolution.ingredient().isStaple();
    }
}
