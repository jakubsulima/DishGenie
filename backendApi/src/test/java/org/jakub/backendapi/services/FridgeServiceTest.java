package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.UserDto;
import org.jakub.backendapi.entities.FridgeIngredient;
import org.jakub.backendapi.entities.User;
import org.jakub.backendapi.exceptions.AppException;
import org.jakub.backendapi.mappers.FridgeIngredientMapper;
import org.jakub.backendapi.repositories.FridgeIngredientRepository;
import org.jakub.backendapi.repositories.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FridgeServiceTest {

    @Mock
    private FridgeIngredientRepository fridgeIngredientRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private FridgeIngredientMapper fridgeIngredientMapper;

    private FridgeService fridgeService;
    private UserDto currentUser;

    @BeforeEach
    void setUp() {
        UserService userService = new UserService(null, null, null, null) {
            @Override
            public UserDto findByEmail(String email) {
                return currentUser;
            }
        };

        fridgeService = new FridgeService(
                fridgeIngredientRepository,
                userRepository,
                fridgeIngredientMapper,
                userService
        );
    }

    @Test
    void changeFridgeIngredientAmount_shouldDeleteOnlyAfterOwnershipCheck() {
        currentUser = new UserDto();
        currentUser.setId(1L);
        currentUser.setEmail("owner@example.com");

        User owner = new User();
        owner.setId(1L);

        FridgeIngredient ingredient = new FridgeIngredient();
        ingredient.setId(3L);
        ingredient.setUser(owner);

        when(fridgeIngredientRepository.findById(3L)).thenReturn(Optional.of(ingredient));

        fridgeService.changeFridgeIngredientAmount(3L, 0, "owner@example.com");

        verify(fridgeIngredientRepository).findById(3L);
        verify(fridgeIngredientRepository).deleteById(3L);
    }

    @Test
    void changeFridgeIngredientAmount_shouldRejectDeletingAnotherUsersIngredient() {
        currentUser = new UserDto();
        currentUser.setId(1L);
        currentUser.setEmail("owner@example.com");

        User otherUser = new User();
        otherUser.setId(9L);

        FridgeIngredient ingredient = new FridgeIngredient();
        ingredient.setId(4L);
        ingredient.setUser(otherUser);

        when(fridgeIngredientRepository.findById(4L)).thenReturn(Optional.of(ingredient));

        AppException exception = assertThrows(
                AppException.class,
                () -> fridgeService.changeFridgeIngredientAmount(4L, 0, "owner@example.com")
        );

        assertEquals("You do not have permission to change this fridge ingredient", exception.getMessage());
        assertEquals(HttpStatus.FORBIDDEN, exception.getCode());
        verify(fridgeIngredientRepository, never()).deleteById(4L);
    }

    @Test
    void changeFridgeIngredientAmount_shouldRejectNegativeAmounts() {
        AppException exception = assertThrows(
                AppException.class,
                () -> fridgeService.changeFridgeIngredientAmount(4L, -1, "owner@example.com")
        );

        assertEquals("Amount must be positive", exception.getMessage());
        assertEquals(HttpStatus.BAD_REQUEST, exception.getCode());
        verify(fridgeIngredientRepository, never()).findById(4L);
    }
}
