package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.RecipeDto;
import org.jakub.backendapi.dto.RecipeIngredientDto;
import org.jakub.backendapi.dto.RecipeNutritionDto;
import org.jakub.backendapi.entities.Enums.Role;
import org.jakub.backendapi.entities.Enums.RecipeVisibility;
import org.jakub.backendapi.entities.Ingredient;
import org.jakub.backendapi.entities.Recipe;
import org.jakub.backendapi.entities.RecipeIngredient;
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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;

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
    void getRecipeByIdentifier_shouldUseIdLookupForNumericIdentifier() {
        Recipe recipe = new Recipe();
        recipe.setId(42L);
        recipe.setName("Numeric Recipe");

        RecipeDto recipeDto = new RecipeDto();
        recipeDto.setId(42L);
        recipeDto.setName("Numeric Recipe");

        when(recipeRepository.findByIdWithIngredients(42L)).thenReturn(Optional.of(recipe));
        when(recipeMapper.toRecipeDto(recipe)).thenReturn(recipeDto);

        RecipeDto result = recipeService.getRecipeByIdentifier("42");

        assertEquals("Numeric Recipe", result.getName());
        verify(recipeRepository).findByIdWithIngredients(42L);
        verify(recipeRepository, never()).findBySlugWithIngredients("42");
    }

    @Test
    void getRecipeByIdentifier_shouldResolveSlugWithoutParsingItAsNumber() {
        Recipe recipe = new Recipe();
        recipe.setId(9L);
        recipe.setName("Berry Bliss Cottage Bowl");

        RecipeDto recipeDto = new RecipeDto();
        recipeDto.setId(9L);
        recipeDto.setName("Berry Bliss Cottage Bowl");

        when(recipeRepository.findBySlugWithIngredients("berry-bliss-cottage-bowl"))
                .thenReturn(Optional.of(recipe));
        when(recipeMapper.toRecipeDto(recipe)).thenReturn(recipeDto);

        RecipeDto result = recipeService.getRecipeByIdentifier("berry-bliss-cottage-bowl");

        assertEquals("Berry Bliss Cottage Bowl", result.getName());
        verify(recipeRepository).findBySlugWithIngredients("berry-bliss-cottage-bowl");
        verify(recipeRepository, never()).findByIdWithIngredients(9L);
    }

    @Test
    void getRecipeByIdentifier_shouldHidePrivateRecipeFromGuests() {
        when(recipeRepository.findByIdWithIngredientsAndVisibility(42L, RecipeVisibility.PUBLIC))
                .thenReturn(Optional.empty());

        AppException exception = assertThrows(
                AppException.class,
                () -> recipeService.getRecipeByIdentifier("42", null)
        );

        assertEquals("Recipe not found", exception.getMessage());
        assertEquals(HttpStatus.NOT_FOUND, exception.getCode());
        verify(recipeRepository, never()).findByIdWithIngredients(42L);
    }

    @Test
    void getRecipeByIdentifier_shouldAllowOwnerToReadPrivateRecipe() {
        User owner = new User();
        owner.setId(7L);
        owner.setEmail("owner@example.com");
        owner.setRole(Role.USER);

        Recipe recipe = new Recipe();
        recipe.setId(42L);
        recipe.setName("Private soup");
        recipe.setUser(owner);
        recipe.setVisibility(RecipeVisibility.PRIVATE);

        RecipeDto recipeDto = new RecipeDto();
        recipeDto.setId(42L);
        recipeDto.setName("Private soup");

        when(recipeRepository.findByIdWithIngredientsAndVisibility(42L, RecipeVisibility.PUBLIC))
                .thenReturn(Optional.empty());
        when(userRepository.findByEmail("owner@example.com")).thenReturn(Optional.of(owner));
        when(recipeRepository.findById(42L)).thenReturn(Optional.of(recipe));
        when(recipeRepository.findByIdWithIngredients(42L)).thenReturn(Optional.of(recipe));
        when(recipeMapper.toRecipeDto(recipe)).thenReturn(recipeDto);

        RecipeDto result = recipeService.getRecipeByIdentifier("42", "owner@example.com");

        assertEquals("Private soup", result.getName());
        assertTrue(result.isCanManage());
    }

    @Test
    void getRecipeByIdentifier_shouldHidePrivateRecipeFromAnotherUser() {
        User owner = new User();
        owner.setId(7L);
        owner.setEmail("owner@example.com");
        owner.setRole(Role.USER);

        User requester = new User();
        requester.setId(8L);
        requester.setEmail("requester@example.com");
        requester.setRole(Role.USER);

        Recipe recipe = new Recipe();
        recipe.setId(42L);
        recipe.setUser(owner);
        recipe.setVisibility(RecipeVisibility.PRIVATE);

        when(recipeRepository.findByIdWithIngredientsAndVisibility(42L, RecipeVisibility.PUBLIC))
                .thenReturn(Optional.empty());
        when(userRepository.findByEmail("requester@example.com")).thenReturn(Optional.of(requester));
        when(recipeRepository.findById(42L)).thenReturn(Optional.of(recipe));

        AppException exception = assertThrows(
                AppException.class,
                () -> recipeService.getRecipeByIdentifier("42", "requester@example.com")
        );

        assertEquals(HttpStatus.NOT_FOUND, exception.getCode());
        verify(recipeRepository, never()).findByIdWithIngredients(42L);
    }

    @Test
    void getRecipeByIdentifier_shouldAllowAdminToReadPrivateRecipe() {
        User admin = new User();
        admin.setId(1L);
        admin.setEmail("admin@example.com");
        admin.setRole(Role.ADMIN);

        Recipe recipe = new Recipe();
        recipe.setId(42L);
        recipe.setVisibility(RecipeVisibility.PRIVATE);

        RecipeDto recipeDto = new RecipeDto();
        recipeDto.setId(42L);

        when(recipeRepository.findByIdWithIngredientsAndVisibility(42L, RecipeVisibility.PUBLIC))
                .thenReturn(Optional.empty());
        when(userRepository.findByEmail("admin@example.com")).thenReturn(Optional.of(admin));
        when(recipeRepository.findByIdWithIngredients(42L)).thenReturn(Optional.of(recipe));
        when(recipeMapper.toRecipeDto(recipe)).thenReturn(recipeDto);

        RecipeDto result = recipeService.getRecipeByIdentifier("42", "admin@example.com");

        assertEquals(42L, result.getId());
        assertTrue(result.isCanManage());
    }

    @Test
    void getRecipeByIdentifier_shouldNotGrantManagementForAnotherUsersPublicRecipe() {
        User owner = new User();
        owner.setId(7L);
        owner.setEmail("owner@example.com");

        User requester = new User();
        requester.setId(8L);
        requester.setEmail("requester@example.com");
        requester.setRole(Role.USER);

        Recipe recipe = new Recipe();
        recipe.setId(42L);
        recipe.setUser(owner);
        recipe.setVisibility(RecipeVisibility.PUBLIC);

        RecipeDto recipeDto = new RecipeDto();
        recipeDto.setId(42L);
        when(recipeRepository.findByIdWithIngredientsAndVisibility(42L, RecipeVisibility.PUBLIC))
                .thenReturn(Optional.of(recipe));
        when(userRepository.findByEmail("requester@example.com")).thenReturn(Optional.of(requester));
        when(recipeMapper.toRecipeDto(recipe)).thenReturn(recipeDto);

        RecipeDto result = recipeService.getRecipeByIdentifier("42", "requester@example.com");

        assertEquals(42L, result.getId());
        assertFalse(result.isCanManage());
    }

    @Test
    void publishRecipe_shouldRequireOwnerAndSetPublicVisibility() {
        User owner = new User();
        owner.setId(7L);
        owner.setEmail("owner@example.com");
        owner.setRole(Role.USER);
        Recipe recipe = new Recipe();
        recipe.setId(42L);
        recipe.setUser(owner);
        recipe.setVisibility(RecipeVisibility.PRIVATE);
        RecipeDto result = new RecipeDto();

        when(recipeRepository.findById(42L)).thenReturn(Optional.of(recipe));
        when(userRepository.findByEmail("owner@example.com")).thenReturn(Optional.of(owner));
        when(recipeRepository.save(recipe)).thenReturn(recipe);
        when(recipeMapper.toRecipeDto(recipe)).thenReturn(result);

        recipeService.publishRecipe(42L, "owner@example.com");

        assertEquals(RecipeVisibility.PUBLIC, recipe.getVisibility());
        verify(recipeRepository).save(recipe);
    }

    @Test
    void publishRecipe_shouldRejectAnotherUser() {
        User owner = new User();
        owner.setId(7L);
        owner.setEmail("owner@example.com");
        owner.setRole(Role.USER);
        User requester = new User();
        requester.setId(8L);
        requester.setEmail("requester@example.com");
        requester.setRole(Role.USER);

        Recipe recipe = new Recipe();
        recipe.setId(42L);
        recipe.setUser(owner);
        recipe.setVisibility(RecipeVisibility.PRIVATE);

        when(recipeRepository.findById(42L)).thenReturn(Optional.of(recipe));
        when(userRepository.findByEmail("requester@example.com")).thenReturn(Optional.of(requester));

        AppException exception = assertThrows(
                AppException.class,
                () -> recipeService.publishRecipe(42L, "requester@example.com")
        );

        assertEquals(HttpStatus.FORBIDDEN, exception.getCode());
        assertEquals(RecipeVisibility.PRIVATE, recipe.getVisibility());
        verify(recipeRepository, never()).save(recipe);
    }

    @Test
    void publishRecipe_shouldAllowAdmin() {
        User admin = new User();
        admin.setId(1L);
        admin.setEmail("admin@example.com");
        admin.setRole(Role.ADMIN);

        Recipe recipe = new Recipe();
        recipe.setId(42L);
        recipe.setVisibility(RecipeVisibility.PRIVATE);

        when(recipeRepository.findById(42L)).thenReturn(Optional.of(recipe));
        when(userRepository.findByEmail("admin@example.com")).thenReturn(Optional.of(admin));
        when(recipeRepository.save(recipe)).thenReturn(recipe);
        when(recipeMapper.toRecipeDto(recipe)).thenReturn(new RecipeDto());

        recipeService.publishRecipe(42L, "admin@example.com");

        assertEquals(RecipeVisibility.PUBLIC, recipe.getVisibility());
        verify(recipeRepository).save(recipe);
    }

    @Test
    void saveRecipeDto_shouldReturnPersistedPrivateVisibility() {
        User owner = new User();
        owner.setId(7L);
        owner.setEmail("owner@example.com");
        owner.setRole(Role.USER);

        RecipeDto request = new RecipeDto();
        request.setName("Private recipe");
        request.setVisibility(RecipeVisibility.PUBLIC);
        request.setIngredients(List.of(new RecipeIngredientDto("Egg", 2, "PIECES")));
        request.setInstructions(List.of("Cook"));

        Recipe recipe = new Recipe();
        recipe.setId(42L);
        recipe.setUser(owner);
        RecipeDto persistedDto = new RecipeDto();
        persistedDto.setId(42L);
        persistedDto.setVisibility(RecipeVisibility.PRIVATE);

        Ingredient egg = new Ingredient(9L, "Egg", List.of());
        when(userRepository.findByEmailForUpdate("owner@example.com")).thenReturn(Optional.of(owner));
        when(recipeRepository.findByNameAndUser("Private recipe", owner)).thenReturn(Optional.empty());
        when(recipeMapper.toRecipeWithUser(request, owner)).thenReturn(recipe);
        when(ingredientRepository.findAllByLowerNameIn(any())).thenReturn(List.of(egg));
        when(recipeRepository.save(recipe)).thenReturn(recipe);
        when(recipeMapper.toRecipeDto(recipe)).thenReturn(persistedDto);

        RecipeDto result = recipeService.saveRecipeDto(request, "owner@example.com");

        assertEquals(RecipeVisibility.PRIVATE, recipe.getVisibility());
        assertEquals(RecipeVisibility.PRIVATE, result.getVisibility());
        assertEquals(42L, result.getId());
    }

    @Test
    void getAllRecipes_shouldReturnOnlyPublicRecipesForRegularUsers() {
        PageRequest pageable = PageRequest.of(0, 10);
        User user = new User();
        user.setRole(Role.USER);
        user.setEmail("user@example.com");
        Page<Long> recipeIds = new PageImpl<>(List.of(3L), pageable, 1);

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(recipeRepository.findRecipeIdsByVisibility(RecipeVisibility.PUBLIC, pageable)).thenReturn(recipeIds);

        recipeService.getAllRecipes(pageable, "user@example.com");

        verify(recipeRepository).findRecipeIdsByVisibility(RecipeVisibility.PUBLIC, pageable);
        verify(recipeRepository, never()).findRecipeIds(pageable);
    }

    @Test
    void getAllRecipes_shouldReturnAllRecipesForAdmins() {
        PageRequest pageable = PageRequest.of(0, 10);
        User admin = new User();
        admin.setRole(Role.ADMIN);
        admin.setEmail("admin@example.com");
        Page<Long> recipeIds = new PageImpl<>(List.of(), pageable, 0);

        when(userRepository.findByEmail("admin@example.com")).thenReturn(Optional.of(admin));
        when(recipeRepository.findRecipeIds(pageable)).thenReturn(recipeIds);

        recipeService.getAllRecipes(pageable, "admin@example.com");

        verify(recipeRepository).findRecipeIds(pageable);
        verify(recipeRepository, never()).findRecipeIdsByVisibility(RecipeVisibility.PUBLIC, pageable);
    }

    @Test
    void searchRecipes_shouldSearchTheRegularUsersOwnCollection() {
        PageRequest pageable = PageRequest.of(0, 10);
        User user = new User();
        user.setId(7L);
        user.setRole(Role.USER);
        user.setEmail("user@example.com");
        Page<Long> recipeIds = new PageImpl<>(List.of(), pageable, 0);

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(recipeRepository.searchRecipeIdsByUser("pasta", user, pageable)).thenReturn(recipeIds);

        recipeService.searchRecipes("pasta", pageable, "user@example.com");

        verify(recipeRepository).searchRecipeIdsByUser("pasta", user, pageable);
        verify(recipeRepository, never()).searchRecipeIdsByVisibility(
                "pasta",
                RecipeVisibility.PUBLIC,
                pageable
        );
        verify(recipeRepository, never()).searchRecipeIds("pasta", pageable);
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

    @Test
    void adminUpdateRecipe_shouldUpdateEditableRecipeFields() {
        Recipe recipe = new Recipe();
        recipe.setId(1L);
        recipe.setName("Old name");
        recipe.setDescription("Old description");
        recipe.setTimeToPrepare("10 min");
        recipe.setInstructions(List.of("Old instruction"));
        recipe.setRecipeIngredients(List.of(new RecipeIngredient()));

        RecipeDto update = new RecipeDto();
        update.setName("New name");
        update.setDescription("New description");
        update.setTimeToPrepare("25 min");
        update.setInstructions(List.of("Prep", "Cook"));
        update.setNutrition(new RecipeNutritionDto(400.0, 20.0, 30.0, 10.0));
        update.setIngredients(List.of(new RecipeIngredientDto("Rice", 100.0, "GRAMS")));

        RecipeDto mappedResult = new RecipeDto();
        mappedResult.setName("New name");

        when(recipeRepository.findById(1L)).thenReturn(Optional.of(recipe));
        when(ingredientRepository.findAllByLowerNameIn(any())).thenReturn(List.of());
        when(ingredientRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(recipeRepository.save(recipe)).thenReturn(recipe);
        when(recipeMapper.toRecipeDto(recipe)).thenReturn(mappedResult);

        RecipeDto result = recipeService.adminUpdateRecipe(1L, update);

        assertEquals("New name", result.getName());
        assertEquals("New name", recipe.getName());
        assertEquals("New description", recipe.getDescription());
        assertEquals("25 min", recipe.getTimeToPrepare());
        assertEquals(List.of("Prep", "Cook"), recipe.getInstructions());
        assertEquals(400.0, recipe.getNutritionCalories());
        assertEquals(20.0, recipe.getNutritionProtein());
        assertEquals(30.0, recipe.getNutritionCarbs());
        assertEquals(10.0, recipe.getNutritionFats());
        assertEquals(2, recipe.getServings());
    }
}
