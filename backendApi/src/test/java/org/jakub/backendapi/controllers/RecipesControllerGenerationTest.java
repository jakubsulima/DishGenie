package org.jakub.backendapi.controllers;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.jakub.backendapi.dto.FridgeIngredientDto;
import org.jakub.backendapi.dto.RecipeDto;
import org.jakub.backendapi.dto.RecipeGenerationRequestDto;
import org.jakub.backendapi.dto.UserDto;
import org.jakub.backendapi.dto.UserPreferencesDto;
import org.jakub.backendapi.entities.Enums.FridgePolicy;
import org.jakub.backendapi.entities.Enums.Role;
import org.jakub.backendapi.entities.Enums.ShoppingPolicy;
import org.jakub.backendapi.services.GeminiService;
import org.jakub.backendapi.services.PostHogService;
import org.jakub.backendapi.services.RateLimitService;
import org.jakub.backendapi.services.RecipeService;
import org.jakub.backendapi.services.UserPreferencesService;
import org.jakub.backendapi.services.UserService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class RecipesControllerGenerationTest {

    private final CapturingRecipeService recipeService = new CapturingRecipeService();
    private final UserService userService = new UserService(null, null, null, null);
    private final UserPreferencesService userPreferencesService = new UserPreferencesService(null, null);
    private final AtomicReference<RecipeGenerationRequestDto> generatedRequest = new AtomicReference<>();
    private final GeminiService geminiService = new GeminiService(new ObjectMapper()) {
        @Override
        public String generateRecipes(RecipeGenerationRequestDto request, UserPreferencesDto hardConstraints) {
            generatedRequest.set(request);
            return "{}";
        }
    };
    private final PostHogService postHogService = new PostHogService(
            new RestTemplateBuilder(), false, "https://example.test", "", 2_000L, 5_000L
    );
    private final RateLimitService rateLimitService = new RateLimitService(null, null) {
        @Override
        public void assertAllowed(String key, int maxRequests, long windowMillis, String errorMessage) {
        }
    };
    private final RecipesController controller = new RecipesController(
            recipeService,
            userService,
            userPreferencesService,
            geminiService,
            postHogService,
            rateLimitService,
            new SimpleMeterRegistry()
    );

    @AfterEach
    void clearAuthentication() {
        org.springframework.security.core.context.SecurityContextHolder.clearContext();
    }

    @Test
    void sendsTheStructuredRequestToTheStructuredGeneratorOverload() {
        RecipeGenerationRequestDto request = new RecipeGenerationRequestDto();
        request.setRequestText("quick dinner");
        request.setFridgePolicy(FridgePolicy.PRIORITIZE);
        request.setShoppingPolicy(ShoppingPolicy.NONE);
        request.setFridgeItems(List.of(new FridgeIngredientDto(12L, "spinach", null, 150D, "g")));
        request.setMustUseFridgeItemIds(List.of(12L));
        HttpServletRequest servletRequest = mock(HttpServletRequest.class);

        assertThat(controller.createRecipe(request, servletRequest).getBody()).isEqualTo("{}");

        assertThat(generatedRequest.get()).isSameAs(request);
    }

    @Test
    void boundsAnonymousRecipeSearchBeforeCallingTheService() {
        Pageable requested = PageRequest.of(7, 2_000, Sort.by(Sort.Direction.ASC, "name"));

        controller.searchRecipes("pasta", requested);

        assertThat(recipeService.searchTerm).isEqualTo("pasta");
        assertThat(recipeService.requesterEmail).isNull();
        Pageable effective = recipeService.pageable;
        assertThat(effective.getPageNumber()).isZero();
        assertThat(effective.getPageSize()).isEqualTo(10);
        assertThat(effective.getSort()).isEqualTo(Sort.by(Sort.Direction.DESC, "id"));
    }

    @Test
    void preservesAuthenticatedRecipeSearchPagination() {
        UserDto admin = new UserDto("admin@example.com", 1L, Role.ADMIN, null);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(admin, null, List.of())
        );
        Pageable requested = PageRequest.of(3, 20, Sort.by(Sort.Direction.ASC, "name"));

        controller.searchRecipes("pasta", requested);

        assertThat(recipeService.searchTerm).isEqualTo("pasta");
        assertThat(recipeService.pageable).isSameAs(requested);
        assertThat(recipeService.requesterEmail).isEqualTo("admin@example.com");
    }

    private static final class CapturingRecipeService extends RecipeService {
        private String searchTerm;
        private Pageable pageable;
        private String requesterEmail;

        private CapturingRecipeService() {
            super(null, null, null, null, null);
        }

        @Override
        public Page<RecipeDto> searchRecipes(
                String searchTerm,
                Pageable pageable,
                String requesterEmail
        ) {
            this.searchTerm = searchTerm;
            this.pageable = pageable;
            this.requesterEmail = requesterEmail;
            return Page.empty(pageable);
        }
    }
}
