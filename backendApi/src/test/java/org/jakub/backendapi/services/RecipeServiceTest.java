package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.RecipeDto;
import org.jakub.backendapi.entities.Enums.Role;
import org.jakub.backendapi.entities.Recipe;
import org.jakub.backendapi.entities.User;
import org.jakub.backendapi.exceptions.AppException;
import org.jakub.backendapi.mappers.RecipeMapper;
import org.jakub.backendapi.repositories.IngredientRepository;
import org.jakub.backendapi.repositories.RecipeIngredientRepository;
import org.jakub.backendapi.repositories.RecipeRepository;
import org.jakub.backendapi.repositories.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecipeServiceTest {

    @Mock
    private RecipeRepository recipeRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private IngredientRepository ingredientRepository;

    @Mock
    private RecipeIngredientRepository recipeIngredientRepository;

    @Mock
    private RecipeMapper recipeMapper;

    @InjectMocks
    private RecipeService recipeService;

    @Test
    void getRecipeById_shouldUseDetailedRecipeLookup() {
        Recipe recipe = new Recipe();
        recipe.setId(1L);
        recipe.setName("Pasta");

        RecipeDto recipeDto = new RecipeDto();
        recipeDto.setId(1L);
        recipeDto.setName("Pasta");

        when(recipeRepository.findByIdWithIngredients(1L)).thenReturn(Optional.of(recipe));
        when(recipeMapper.toRecipeDto(recipe)).thenReturn(recipeDto);

        RecipeDto result = recipeService.getRecipeById(1L);

        assertEquals("Pasta", result.getName());
        verify(recipeRepository).findByIdWithIngredients(1L);
    }

    @Test
    void getRecipeById_shouldThrowWhenRecipeDoesNotExist() {
        when(recipeRepository.findByIdWithIngredients(1L)).thenReturn(Optional.empty());

        AppException exception = assertThrows(AppException.class, () -> recipeService.getRecipeById(1L));

        assertEquals("Recipe not found", exception.getMessage());
        assertEquals(HttpStatus.NOT_FOUND, exception.getCode());
    }

    @Test
    void getAllRecipes_shouldPreservePagedIdOrderingWhenMappingDetails() {
        PageRequest pageable = PageRequest.of(0, 2);
        Page<Long> recipeIds = new PageImpl<>(List.of(5L, 2L), pageable, 2);

        Recipe laterRecipe = new Recipe();
        laterRecipe.setId(5L);
        laterRecipe.setName("Later");

        Recipe earlierRecipe = new Recipe();
        earlierRecipe.setId(2L);
        earlierRecipe.setName("Earlier");

        RecipeDto laterRecipeDto = new RecipeDto();
        laterRecipeDto.setId(5L);
        laterRecipeDto.setName("Later");

        RecipeDto earlierRecipeDto = new RecipeDto();
        earlierRecipeDto.setId(2L);
        earlierRecipeDto.setName("Earlier");

        when(recipeRepository.findRecipeIds(pageable)).thenReturn(recipeIds);
        when(recipeRepository.findAllWithIngredientsByIdIn(List.of(5L, 2L)))
                .thenReturn(List.of(earlierRecipe, laterRecipe));
        when(recipeMapper.toRecipeDto(laterRecipe)).thenReturn(laterRecipeDto);
        when(recipeMapper.toRecipeDto(earlierRecipe)).thenReturn(earlierRecipeDto);

        Page<RecipeDto> result = recipeService.getAllRecipes(pageable);

        assertEquals(List.of("Later", "Earlier"), result.getContent().stream().map(RecipeDto::getName).toList());
        verify(recipeRepository).findAllWithIngredientsByIdIn(List.of(5L, 2L));
    }

    @Test
    void findRecipesByUserId_shouldUsePagedDetailedLookup() {
        PageRequest pageable = PageRequest.of(1, 1);
        User user = new User();
        user.setId(7L);
        user.setEmail("test@example.com");

        Recipe recipe = new Recipe();
        recipe.setId(11L);
        recipe.setName("Soup");

        RecipeDto recipeDto = new RecipeDto();
        recipeDto.setId(11L);
        recipeDto.setName("Soup");

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(recipeRepository.findRecipeIdsByUser(user, pageable))
                .thenReturn(new PageImpl<>(List.of(11L), pageable, 1));
        when(recipeRepository.findAllWithIngredientsByIdIn(List.of(11L))).thenReturn(List.of(recipe));
        when(recipeMapper.toRecipeDto(recipe)).thenReturn(recipeDto);

        Page<RecipeDto> result = recipeService.findRecipesByUserId(7L, pageable, "test@example.com");

        assertEquals(1, result.getContent().size());
        assertEquals("Soup", result.getContent().get(0).getName());
    }

    @Test
    void findRecipesByUserId_shouldRejectNonOwnerNonAdminRequester() {
        PageRequest pageable = PageRequest.of(0, 10);
        User requester = new User();
        requester.setId(3L);
        requester.setEmail("requester@example.com");
        requester.setRole(Role.USER);

        when(userRepository.findByEmail("requester@example.com")).thenReturn(Optional.of(requester));

        AppException exception = assertThrows(
                AppException.class,
                () -> recipeService.findRecipesByUserId(7L, pageable, "requester@example.com")
        );

        assertEquals("You do not have permission to view this user's recipes", exception.getMessage());
        assertEquals(HttpStatus.FORBIDDEN, exception.getCode());
        verifyNoInteractions(recipeRepository);
    }

    @Test
    void searchRecipes_shouldReturnEmptyPageForBlankSearch() {
        Page<RecipeDto> result = recipeService.searchRecipes("   ", PageRequest.of(0, 10));

        assertTrue(result.isEmpty());
        verifyNoInteractions(recipeRepository);
    }
}
