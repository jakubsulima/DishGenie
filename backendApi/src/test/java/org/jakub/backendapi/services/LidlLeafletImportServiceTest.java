package org.jakub.backendapi.services;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;
import java.time.Instant;
import static org.assertj.core.api.Assertions.*;

class LidlLeafletImportServiceTest {
    private final JsonMapper json = JsonMapper.builder().build();
    private final LidlLeafletImportService importer = new LidlLeafletImportService(json, true, "python3", "unused", "/tmp/unused");
    @Test void realReviewedSourcePreservesExactBundlesSeparatePermissionsAndIngredientIdentities() throws Exception {
        var source = json.readTree(getClass().getResourceAsStream("/offers/lidl-full-leaflet-reviewed.json"));
        var batch = importer.parse(source, Instant.parse("2026-11-11T12:00:00Z"));
        assertThat(batch.summary().pages()).isEqualTo(97);
        assertThat(batch.summary().reviewedCandidates()).isEqualTo(313);
        assertThat(batch.summary().products()).isEqualTo(50);
        assertThat(batch.prices()).hasSize(85);
        var kaki = batch.prices().stream().filter(p -> p.title().equals("Kaki") && p.variant().equals("promotion")).findFirst().orElseThrow();
        assertThat(kaki.price()).isNull(); assertThat(kaki.bundlePrice()).isEqualByComparingTo("4.99");
        assertThat(kaki.bundleSize()).isEqualTo(2); assertThat(kaki.minimum()).isEqualTo(2);
        assertThat(kaki.multiple()).isEqualTo(2); assertThat(kaki.maximum()).isEqualTo(6);
        assertThat(kaki.loyalty()).isTrue(); assertThat(kaki.coupon()).isTrue();
        assertThat(batch.prices().stream().filter(p -> p.ingredient().key().equals("chicken-mince"))).isNotEmpty();
        assertThat(batch.prices()).noneMatch(p -> p.title().contains("Dorsz") || p.title().contains("Kefir") || p.title().contains("Coca-Cola"));
        assertThat(PriceIngredientKeys.recipeKey("minced chicken")).isEqualTo("chicken-mince");
        assertThat(PriceIngredientKeys.recipeKey("split peas")).isEqualTo("split-peas");
        assertThat(PriceIngredientKeys.recipeKey("shrimp")).isNotEqualTo("cooked-whole-shrimp");
    }
    @Test void incompleteReviewDoesNotPublishAnyPricesAndExpiredOffersRemainExpired() throws Exception {
        var source = (ObjectNode) json.readTree(getClass().getResourceAsStream("/offers/lidl-full-leaflet-reviewed.json"));
        assertThat(importer.parse(source, Instant.parse("2026-12-01T12:00:00Z")).prices()).isEmpty();
        ((ObjectNode) source.path("summary")).put("reviewedCandidates", 312);
        assertThatThrownBy(() -> importer.parse(source, Instant.parse("2026-11-11T12:00:00Z")))
                .isInstanceOf(IllegalStateException.class).hasMessage("LEAFLET_INCOMPLETE_REVIEW");
    }
}
