package org.jakub.backendapi.controllers;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import jakarta.servlet.http.HttpServletRequest;
import org.jakub.backendapi.dto.RecipeGenerationRequestDto;
import org.jakub.backendapi.dto.RecipeGenerationResponseDto;
import org.jakub.backendapi.dto.UserDto;
import org.jakub.backendapi.dto.UserPreferencesDto;
import org.jakub.backendapi.entities.Enums.FridgePolicy;
import org.jakub.backendapi.entities.Enums.Role;
import org.jakub.backendapi.entities.Enums.ShoppingPolicy;
import org.jakub.backendapi.exceptions.AppException;
import org.jakub.backendapi.repositories.FridgeIngredientRepository;
import org.jakub.backendapi.services.GeneratedRecipeValidator;
import org.jakub.backendapi.services.GeminiService;
import org.jakub.backendapi.services.PostHogService;
import org.jakub.backendapi.services.RateLimitService;
import org.jakub.backendapi.services.RecipeService;
import org.jakub.backendapi.services.UserPreferencesService;
import org.jakub.backendapi.services.UserService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecipesControllerV2GenerationTest {
    @Mock private RecipeService recipeService;
    @Mock private UserService userService;
    @Mock private UserPreferencesService userPreferencesService;
    @Mock private GeminiService geminiService;
    @Mock private PostHogService postHogService;
    @Mock private RateLimitService rateLimitService;
    @Mock private FridgeIngredientRepository fridgeIngredientRepository;
    @Mock private GeneratedRecipeValidator generatedRecipeValidator;
    @Mock private HttpServletRequest request;

    private RecipesController controller;

    @BeforeEach
    void setUp() {
        controller = new RecipesController(
                recipeService,
                userService,
                userPreferencesService,
                geminiService,
                postHogService,
                rateLimitService,
                new SimpleMeterRegistry(),
                fridgeIngredientRepository,
                generatedRecipeValidator
        );
        UserDto user = new UserDto("cook@example.com", 7L, Role.USER, null);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, List.of())
        );
    }

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void rejectsRateLimitedRequestsBeforeQuotaReservationOrProviderCall() {
        doThrow(new AppException("Too many requests", HttpStatus.TOO_MANY_REQUESTS))
                .when(rateLimitService)
                .assertAllowed(anyString(), anyInt(), anyLong(), anyString());

        AppException exception = assertThrows(
                AppException.class,
                () -> controller.createRecipeV2(baseRequest(), request)
        );

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, exception.getCode());
        verify(userService, never()).reserveRecipeGeneration(anyString());
        verify(geminiService, never()).generateRecipes(
                any(RecipeGenerationRequestDto.class), any(UserPreferencesDto.class));
    }

    @Test
    void rejectsMandatoryFridgeIdsThatDoNotBelongToTheUser() {
        UserDto user = new UserDto("cook@example.com", 7L, Role.USER, null);
        when(userService.findByEmail("cook@example.com")).thenReturn(user);
        when(fridgeIngredientRepository.findByUser_Id(7L)).thenReturn(List.of());
        RecipeGenerationRequestDto payload = baseRequest();
        payload.setMustUseFridgeItemIds(List.of(99L));

        AppException exception = assertThrows(
                AppException.class,
                () -> controller.createRecipeV2(payload, request)
        );

        assertEquals(HttpStatus.FORBIDDEN, exception.getCode());
        verify(userService, never()).reserveRecipeGeneration(anyString());
        verify(geminiService, never()).generateRecipes(
                any(RecipeGenerationRequestDto.class), any(UserPreferencesDto.class));
    }

    @Test
    void reservesQuotaAndKeepsItForSuccessfulGeneration() {
        stubAuthenticatedUser();
        when(geminiService.generateRecipes(
                any(RecipeGenerationRequestDto.class), any(UserPreferencesDto.class)))
                .thenReturn("{\"servings\":2,\"ingredients\":[],\"fridgeCoverage\":{}}");
        when(generatedRecipeValidator.validate(
                any(), eq(1), any(), eq(List.of()), any(), eq(ShoppingPolicy.ALLOWED), eq(2), eq("en")))
                .thenReturn(List.of(new RecipeGenerationResponseDto.ConstraintCheckDto("PASSED", List.of())));

        var response = controller.createRecipeV2(baseRequest(), request);

        verify(rateLimitService).assertAllowed(
                eq("generateRecipe:cook@example.com"), eq(1), eq(60_000L), anyString());
        verify(userService).reserveRecipeGeneration("cook@example.com");
        verify(userService, never()).releaseRecipeGeneration(anyString());
        assertEquals("en", response.getBody().recipes().get(0).recipe().path("locale").asText());
    }

    @Test
    void releasesReservedQuotaWhenProviderFails() {
        stubAuthenticatedUser();
        when(geminiService.generateRecipes(
                any(RecipeGenerationRequestDto.class), any(UserPreferencesDto.class)))
                .thenThrow(new AppException("Provider failed", HttpStatus.BAD_GATEWAY));

        assertThrows(AppException.class, () -> controller.createRecipeV2(baseRequest(), request));

        verify(userService).reserveRecipeGeneration("cook@example.com");
        verify(userService).releaseRecipeGeneration("cook@example.com");
    }

    private void stubAuthenticatedUser() {
        UserDto user = new UserDto("cook@example.com", 7L, Role.USER, null);
        when(userService.findByEmail("cook@example.com")).thenReturn(user);
        when(fridgeIngredientRepository.findByUser_Id(7L)).thenReturn(List.of());
    }

    private RecipeGenerationRequestDto baseRequest() {
        RecipeGenerationRequestDto payload = new RecipeGenerationRequestDto();
        payload.setRequestText("quick dinner");
        payload.setCount(1);
        payload.setServings(2);
        payload.setFridgePolicy(FridgePolicy.SUGGEST);
        payload.setShoppingPolicy(ShoppingPolicy.ALLOWED);
        payload.setMustUseFridgeItemIds(List.of());
        return payload;
    }
}
