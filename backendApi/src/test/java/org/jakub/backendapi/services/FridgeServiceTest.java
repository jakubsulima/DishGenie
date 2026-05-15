package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.UserDto;
import org.jakub.backendapi.dto.FridgeIngredientDto;
import org.jakub.backendapi.entities.Enums.Unit;
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

import java.time.LocalDate;
import java.util.List;
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

    @Test
    void addFridgeIngredient_shouldMergeDuplicateWithSameNameUnitAndExpirationDate() {
        LocalDate expirationDate = LocalDate.of(2026, 5, 20);
        FridgeIngredientDto dto = new FridgeIngredientDto(null, " Tomatoes ", expirationDate, 3d, "GRAMS");

        User user = new User();
        user.setId(1L);
        user.setEmail("owner@example.com");

        FridgeIngredient existingIngredient = new FridgeIngredient();
        existingIngredient.setId(10L);
        existingIngredient.setName("tomatoes");
        existingIngredient.setExpirationDate(expirationDate);
        existingIngredient.setAmount(2d);
        existingIngredient.setUnit(Unit.GRAMS);
        existingIngredient.setUser(user);

        when(userRepository.findByEmail("owner@example.com")).thenReturn(Optional.of(user));
        when(fridgeIngredientRepository.findMergeCandidates(1L, "Tomatoes", expirationDate, Unit.GRAMS))
                .thenReturn(List.of(existingIngredient));
        when(fridgeIngredientRepository.save(existingIngredient)).thenReturn(existingIngredient);

        FridgeIngredient result = fridgeService.addFridgeIngredient(dto, "owner@example.com");

        assertEquals(5d, result.getAmount());
        verify(fridgeIngredientRepository).save(existingIngredient);
        verify(fridgeIngredientMapper, never()).toFridgeIngredientWithUser(dto, user);
    }

    @Test
    void addFridgeIngredient_shouldCreateNewItemWhenNoDuplicateExists() {
        FridgeIngredientDto dto = new FridgeIngredientDto(null, "Milk", null, null, null);

        User user = new User();
        user.setId(1L);
        user.setEmail("owner@example.com");

        FridgeIngredient mappedIngredient = new FridgeIngredient();
        mappedIngredient.setName("Milk");
        mappedIngredient.setUser(user);

        when(userRepository.findByEmail("owner@example.com")).thenReturn(Optional.of(user));
        when(fridgeIngredientRepository.findMergeCandidates(1L, "Milk", null, null)).thenReturn(List.of());
        when(fridgeIngredientMapper.toFridgeIngredientWithUser(dto, user)).thenReturn(mappedIngredient);
        when(fridgeIngredientRepository.save(mappedIngredient)).thenReturn(mappedIngredient);

        FridgeIngredient result = fridgeService.addFridgeIngredient(dto, "owner@example.com");

        assertEquals("Milk", result.getName());
        verify(fridgeIngredientRepository).save(mappedIngredient);
    }
}
