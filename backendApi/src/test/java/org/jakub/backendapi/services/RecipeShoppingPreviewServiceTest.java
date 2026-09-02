package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.RecipeDto;
import org.jakub.backendapi.dto.RecipeIngredientDto;
import org.jakub.backendapi.dto.RecipeShoppingPreviewResponseDto;
import org.jakub.backendapi.dto.ShoppingListGenerationItemDto;
import org.jakub.backendapi.entities.Ingredient;
import org.jakub.backendapi.entities.User;
import org.jakub.backendapi.repositories.FridgeIngredientRepository;
import org.jakub.backendapi.repositories.UserRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RecipeShoppingPreviewServiceTest {

    @Test
    void excludeStaplesRemovesStaplesFromRequirementsWithoutRemovingInventory() {
        RecipeService recipeService = mock(RecipeService.class);
        UserRepository userRepository = mock(UserRepository.class);
        FridgeIngredientRepository fridgeIngredientRepository = mock(FridgeIngredientRepository.class);
        IngredientNormalizationService normalizationService = mock(IngredientNormalizationService.class);
        RecipeShoppingPreviewService service = new RecipeShoppingPreviewService(
                recipeService,
                userRepository,
                fridgeIngredientRepository,
                new ServingScalingService(),
                new ShoppingListCoverageService(),
                normalizationService
        );

        RecipeDto recipe = new RecipeDto();
        recipe.setServings(2);
        recipe.setIngredients(List.of(
                new RecipeIngredientDto("Salt", 2, "g"),
                new RecipeIngredientDto("Rice", 200, "g")
        ));
        User user = new User();
        user.setId(7L);
        Ingredient salt = new Ingredient();
        salt.setStaple(true);

        when(recipeService.getRecipeByIdentifier("42", "cook@example.com")).thenReturn(recipe);
        when(userRepository.findByEmail("cook@example.com")).thenReturn(Optional.of(user));
        when(fridgeIngredientRepository.findByUser_Id(7L)).thenReturn(List.of());
        when(normalizationService.resolve("Salt", "en")).thenReturn(new IngredientNormalizationService.Resolution(
                IngredientNormalizationService.Status.EXACT_CANONICAL, salt, "Salt", List.of(salt)));
        when(normalizationService.resolve("Rice", "en")).thenReturn(new IngredientNormalizationService.Resolution(
                IngredientNormalizationService.Status.UNRESOLVED, null, "Rice", List.of()));

        RecipeShoppingPreviewResponseDto result = service.preview(42L, 4, true, "cook@example.com");

        assertEquals(List.of(new ShoppingListGenerationItemDto("Rice", 400d, "g")), result.missing());
        assertEquals(List.of(), result.available());
        assertEquals(List.of(), result.unresolved());
    }
}
