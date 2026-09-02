package org.jakub.backendapi.dto;

import java.util.List;

public record RecipeShoppingPreviewResponseDto(
        List<ShoppingListGenerationItemDto> missing,
        List<String> available,
        List<ShoppingListGenerationItemDto> unresolved,
        int targetServings
) {}
