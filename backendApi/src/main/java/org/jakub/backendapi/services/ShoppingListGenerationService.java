package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.FridgeIngredientDto;
import org.jakub.backendapi.dto.RecipeIngredientDto;
import org.jakub.backendapi.dto.ShoppingListGenerationItemDto;
import org.jakub.backendapi.entities.User;
import org.jakub.backendapi.exceptions.AppException;
import org.jakub.backendapi.repositories.FridgeIngredientRepository;
import org.jakub.backendapi.repositories.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class ShoppingListGenerationService {

    private final UserRepository userRepository;
    private final FridgeIngredientRepository fridgeIngredientRepository;
    private final GeminiService geminiService;
    private final ShoppingListIngredientMatcher shoppingListIngredientMatcher;

    public ShoppingListGenerationService(
            UserRepository userRepository,
            FridgeIngredientRepository fridgeIngredientRepository,
            GeminiService geminiService,
            ShoppingListIngredientMatcher shoppingListIngredientMatcher
    ) {
        this.userRepository = userRepository;
        this.fridgeIngredientRepository = fridgeIngredientRepository;
        this.geminiService = geminiService;
        this.shoppingListIngredientMatcher = shoppingListIngredientMatcher;
    }

    @Transactional(readOnly = true)
    public List<ShoppingListGenerationItemDto> generateMissingItems(String email, List<RecipeIngredientDto> recipeIngredients) {
        User user = resolveUser(email);
        List<RecipeIngredientDto> safeRecipeIngredients = recipeIngredients == null ? List.of() : recipeIngredients;
        List<FridgeIngredientDto> fridgeItems = fridgeIngredientRepository.findByUser_Id(user.getId()).stream()
                .map(this::toFridgeIngredientDto)
                .toList();

        List<ShoppingListGenerationItemDto> deterministicMissingIngredients =
                shoppingListIngredientMatcher.findDeterministicMissingIngredients(safeRecipeIngredients, fridgeItems);

        if (deterministicMissingIngredients.isEmpty()) {
            return List.of();
        }

        try {
            Set<String> aiMissingIngredientNames =
                    geminiService.resolveStillMissingIngredientNames(deterministicMissingIngredients, fridgeItems);

            if (aiMissingIngredientNames.isEmpty()) {
                return List.of();
            }

            return deterministicMissingIngredients.stream()
                    .filter(item -> aiMissingIngredientNames.contains(normalizeName(item.getName())))
                    .toList();
        } catch (RuntimeException exception) {
            return deterministicMissingIngredients;
        }
    }

    private User resolveUser(String email) {
        if (!StringUtils.hasText(email)) {
            throw new AppException("Unauthorized", HttpStatus.UNAUTHORIZED);
        }

        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException("User not found", HttpStatus.NOT_FOUND));
    }

    private FridgeIngredientDto toFridgeIngredientDto(org.jakub.backendapi.entities.FridgeIngredient entity) {
        return new FridgeIngredientDto(
                entity.getId(),
                entity.getName(),
                entity.getExpirationDate(),
                entity.getAmount(),
                entity.getUnit() != null ? entity.getUnit().name() : null
        );
    }

    private String normalizeName(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }
}
