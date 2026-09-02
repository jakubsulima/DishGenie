package org.jakub.backendapi.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

public record RecipeGenerationResponseDto(
        String generationId,
        List<GeneratedRecipeResultDto> recipes,
        List<String> warnings
) {
    public record GeneratedRecipeResultDto(
            JsonNode recipe,
            JsonNode fridgeCoverage,
            ConstraintCheckDto constraintCheck
    ) {}

    public record ConstraintCheckDto(String status, List<String> warnings) {}
}
