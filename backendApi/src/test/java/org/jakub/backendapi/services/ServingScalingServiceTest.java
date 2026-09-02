package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.RecipeIngredientDto;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ServingScalingServiceTest {
    private final ServingScalingService service = new ServingScalingService();

    @Test
    void scalesAmountsWithoutMutatingTheOriginalList() {
        List<RecipeIngredientDto> original = List.of(new RecipeIngredientDto("rice", 180, "g"));

        List<RecipeIngredientDto> scaled = service.scale(original, 2, 4);

        assertThat(scaled).singleElement().satisfies(item -> assertThat(item.getAmount()).isEqualTo(360));
        assertThat(original).singleElement().satisfies(item -> assertThat(item.getAmount()).isEqualTo(180));
    }
}
