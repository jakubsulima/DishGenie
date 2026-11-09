package org.jakub.backendapi.services;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import static org.assertj.core.api.Assertions.*;
class LidlReviewCaptureServiceTest {
    private final LidlReviewCaptureService source = new LidlReviewCaptureService(new ObjectMapper(), null, null);
    @Test void publicJsonPagesPreserveAllProductsAndRejectUnexpectedPagination() {
        String body = "{\"assortment\":\"PL\",\"locale\":\"pl_PL\",\"numFound\":49,\"offset\":48,\"items\":[{\"type\":\"product\",\"gridbox\":{\"data\":{\"productId\":123}}}]}";
        var page = source.pricePage(body, 48);
        assertThat(page.total()).isEqualTo(49); assertThat(page.items()).isEqualTo(1);
        assertThat(page.products().get(0).path("productId").asInt()).isEqualTo(123);
        assertThatThrownBy(() -> source.pricePage(body, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> source.pricePage("{}", 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> LidlReviewCaptureService.pricePageUrl(1)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> source.fetchHtml("https://www.lidl.pl/q/api/search?offset=0&url=https://example.com"))
                .isInstanceOf(IllegalArgumentException.class);
    }
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
