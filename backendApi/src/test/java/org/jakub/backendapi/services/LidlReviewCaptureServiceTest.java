package org.jakub.backendapi.services;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import static org.assertj.core.api.Assertions.*;
class LidlReviewCaptureServiceTest {
    private final LidlReviewCaptureService source = new LidlReviewCaptureService(new ObjectMapper(), null, null);
    @Test void preservesEvidenceWithoutConvertingPriceBasisToPackage() {
        String html = "<script type='application/json' id='__NUXT_DATA__'>" +
                "[{\"productId\":1,\"price\":2,\"storeStartDate\":3,\"storeEndDate\":4,\"canonicalUrl\":5,\"fullTitle\":6},123,{\"price\":7,\"packaging\":8},100,200,\"/p/test/p123\",\"Synthetic fixture\",5.99,{\"text\":9},\"1 kg\"]</script>";
        var row = source.parse(html).get(0);
        assertThat(row.evidence()).contains("5.99", "1 kg", "storeStartDate").doesNotContain("verifiedAt", "packageAmount");
    }
    @Test void changedFormatAndEmptySourceCannotPublishAnEmptyCatalog() {
        assertThatThrownBy(() -> source.parse("<p>No data</p>")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> source.parse("<script id='__NUXT_DATA__'>[]</script>")).isInstanceOf(IllegalArgumentException.class);
    }
}
