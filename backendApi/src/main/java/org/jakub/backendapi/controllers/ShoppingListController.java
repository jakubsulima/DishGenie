package org.jakub.backendapi.controllers;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.jakub.backendapi.dto.GenerateShoppingListFromRecipeRequestDto;
import org.jakub.backendapi.dto.ShoppingListGenerationItemDto;
import org.jakub.backendapi.dto.ShoppingListItemDto;
import org.jakub.backendapi.services.ShoppingListGenerationService;
import org.jakub.backendapi.services.ShoppingListService;
import org.jakub.backendapi.services.RecipeShoppingPreviewService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static org.jakub.backendapi.config.JwtUtils.getLoginFromToken;

@RestController
public class ShoppingListController {

    private final ShoppingListService shoppingListService;
    private final ShoppingListGenerationService shoppingListGenerationService;
    private final RecipeShoppingPreviewService recipeShoppingPreviewService;

    public ShoppingListController(
            ShoppingListService shoppingListService,
            ShoppingListGenerationService shoppingListGenerationService,
            RecipeShoppingPreviewService recipeShoppingPreviewService
    ) {
        this.shoppingListService = shoppingListService;
        this.shoppingListGenerationService = shoppingListGenerationService;
        this.recipeShoppingPreviewService = recipeShoppingPreviewService;
    }

    public record ReplaceShoppingListRequest(List<ShoppingListItemDto> items) {
    }

    @GetMapping("/shoppingList")
    public ResponseEntity<List<ShoppingListItemDto>> getShoppingList(HttpServletRequest request) {
        return ResponseEntity.ok(shoppingListService.getShoppingList(getLoginFromToken(request)));
    }

    @PutMapping("/shoppingList")
    public ResponseEntity<List<ShoppingListItemDto>> replaceShoppingList(
            @RequestBody(required = false) ReplaceShoppingListRequest payload,
            HttpServletRequest request
    ) {
        List<ShoppingListItemDto> items = payload != null && payload.items() != null ? payload.items() : List.of();
        return ResponseEntity.ok(shoppingListService.replaceShoppingList(getLoginFromToken(request), items));
    }

    @PostMapping("/shoppingList/generate-from-recipe")
    public ResponseEntity<List<ShoppingListGenerationItemDto>> generateShoppingListFromRecipe(
            @RequestBody(required = false) GenerateShoppingListFromRecipeRequestDto payload,
            HttpServletRequest request
    ) {
        List<ShoppingListGenerationItemDto> items = shoppingListGenerationService.generateMissingItems(
                getLoginFromToken(request),
                payload != null ? payload.getIngredients() : List.of()
        );
        return ResponseEntity.ok(items);
    }

    @PostMapping("/v2/shopping-list/preview-from-recipe")
    public ResponseEntity<org.jakub.backendapi.dto.RecipeShoppingPreviewResponseDto> previewFromRecipe(
            @Valid @RequestBody org.jakub.backendapi.dto.RecipeShoppingPreviewRequestDto payload,
            HttpServletRequest request
    ) {
        return ResponseEntity.ok(recipeShoppingPreviewService.preview(
                payload.getRecipeId(), payload.getTargetServings(), payload.isExcludeStaples(),
                getLoginFromToken(request)));
    }
}
