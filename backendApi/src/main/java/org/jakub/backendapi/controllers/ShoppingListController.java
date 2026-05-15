package org.jakub.backendapi.controllers;

import jakarta.servlet.http.HttpServletRequest;
import org.jakub.backendapi.dto.GenerateShoppingListFromRecipeRequestDto;
import org.jakub.backendapi.dto.ShoppingListGenerationItemDto;
import org.jakub.backendapi.dto.ShoppingListItemDto;
import org.jakub.backendapi.services.ShoppingListGenerationService;
import org.jakub.backendapi.services.ShoppingListService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static org.jakub.backendapi.config.JwtUtils.getLoginFromToken;

@RestController
public class ShoppingListController {

    private final ShoppingListService shoppingListService;
    private final ShoppingListGenerationService shoppingListGenerationService;

    public ShoppingListController(
            ShoppingListService shoppingListService,
            ShoppingListGenerationService shoppingListGenerationService
    ) {
        this.shoppingListService = shoppingListService;
        this.shoppingListGenerationService = shoppingListGenerationService;
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
}
