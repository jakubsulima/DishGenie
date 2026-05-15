package org.jakub.backendapi.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.jakub.backendapi.dto.ShoppingListGenerationItemDto;
import org.jakub.backendapi.dto.FridgeIngredientDto;
import org.jakub.backendapi.entities.Enums.Unit;
import org.jakub.backendapi.entities.FridgeIngredient;
import org.jakub.backendapi.entities.User;
import org.jakub.backendapi.exceptions.AppException;
import org.jakub.backendapi.repositories.FridgeIngredientRepository;
import org.jakub.backendapi.repositories.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ShoppingListGenerationServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private FridgeIngredientRepository fridgeIngredientRepository;

    @Test
    void generateMissingItems_shouldLetAiRemoveFuzzyMatches() {
        ShoppingListGenerationService shoppingListGenerationService = createService(new GeminiService(new ObjectMapper()) {
            @Override
            public Set<String> resolveStillMissingIngredientNames(
                    List<ShoppingListGenerationItemDto> candidateMissingIngredients,
                    List<FridgeIngredientDto> fridgeItems
            ) {
                return Set.of();
            }
        });

        User user = user(7L);
        when(userRepository.findByEmail("cook@example.com")).thenReturn(Optional.of(user));
        when(fridgeIngredientRepository.findByUser_Id(7L))
                .thenReturn(List.of(fridge("scallion", 1d, Unit.PIECES, user)));

        List<ShoppingListGenerationItemDto> result = shoppingListGenerationService.generateMissingItems(
                "cook@example.com",
                List.of(new org.jakub.backendapi.dto.RecipeIngredientDto("Green onion", 2, "pcs"))
        );

        assertEquals(List.of(), result);
    }

    @Test
    void generateMissingItems_shouldFallbackToDeterministicResultWhenAiFails() {
        ShoppingListGenerationService shoppingListGenerationService = createService(new GeminiService(new ObjectMapper()) {
            @Override
            public Set<String> resolveStillMissingIngredientNames(
                    List<ShoppingListGenerationItemDto> candidateMissingIngredients,
                    List<FridgeIngredientDto> fridgeItems
            ) {
                throw new AppException("AI unavailable", HttpStatus.BAD_GATEWAY);
            }
        });

        User user = user(9L);
        when(userRepository.findByEmail("cook@example.com")).thenReturn(Optional.of(user));
        when(fridgeIngredientRepository.findByUser_Id(9L)).thenReturn(List.of());

        List<ShoppingListGenerationItemDto> result = shoppingListGenerationService.generateMissingItems(
                "cook@example.com",
                List.of(new org.jakub.backendapi.dto.RecipeIngredientDto("Green onion", 2, "pcs"))
        );

        assertEquals(List.of(new ShoppingListGenerationItemDto("Green onion", 2d, "pcs")), result);
    }

    private User user(Long id) {
        User user = new User();
        user.setId(id);
        user.setEmail("cook@example.com");
        return user;
    }

    private ShoppingListGenerationService createService(GeminiService geminiService) {
        return new ShoppingListGenerationService(
                userRepository,
                fridgeIngredientRepository,
                geminiService,
                new ShoppingListIngredientMatcher()
        );
    }

    private FridgeIngredient fridge(String name, Double amount, Unit unit, User user) {
        FridgeIngredient ingredient = new FridgeIngredient();
        ingredient.setName(name);
        ingredient.setAmount(amount);
        ingredient.setUnit(unit);
        ingredient.setUser(user);
        return ingredient;
    }
}
