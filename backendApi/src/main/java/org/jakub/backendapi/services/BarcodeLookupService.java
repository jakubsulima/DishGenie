package org.jakub.backendapi.services;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.jakub.backendapi.dto.BarcodeProductDto;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Optional;

@Service
public class BarcodeLookupService {
    private final RestTemplate restTemplate;
    private final String apiUrl;

    @Autowired
    public BarcodeLookupService(
            RestTemplateBuilder restTemplateBuilder,
            @Value("${openfoodfacts.api-url:https://world.openfoodfacts.org/api/v0/product}") String apiUrl,
            @Value("${openfoodfacts.connect-timeout-ms:1500}") long connectTimeoutMs,
            @Value("${openfoodfacts.read-timeout-ms:3000}") long readTimeoutMs
    ) {
        this(
                restTemplateBuilder
                        .setConnectTimeout(Duration.ofMillis(connectTimeoutMs))
                        .setReadTimeout(Duration.ofMillis(readTimeoutMs))
                        .build(),
                apiUrl
        );
    }

    BarcodeLookupService(RestTemplate restTemplate, String apiUrl) {
        this.restTemplate = restTemplate;
        this.apiUrl = apiUrl.replaceAll("/+$", "");
    }

    public Optional<BarcodeProductDto> lookup(String barcode) {
        if (!StringUtils.hasText(barcode)) {
            return Optional.empty();
        }

        String normalizedBarcode = barcode.trim();
        try {
            String url = apiUrl + "/" + UriUtils.encodePathSegment(normalizedBarcode, StandardCharsets.UTF_8) + ".json";
            OpenFoodFactsResponse response = restTemplate.getForObject(url, OpenFoodFactsResponse.class);
            if (response == null || response.status != 1 || response.product == null) {
                return Optional.empty();
            }

            String name = firstText(
                    response.product.productName,
                    response.product.productNameEn,
                    response.product.genericName
            );
            if (!StringUtils.hasText(name)) {
                return Optional.empty();
            }

            return Optional.of(new BarcodeProductDto(
                    normalizedBarcode,
                    name,
                    clean(response.product.brands)
            ));
        } catch (RestClientException exception) {
            return Optional.empty();
        }
    }

    private String firstText(String... values) {
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value.trim();
            }
        }
        return null;
    }

    private String clean(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private static class OpenFoodFactsResponse {
        private int status;
        private OpenFoodFactsProduct product;

        public int getStatus() { return status; }
        public void setStatus(int status) { this.status = status; }
        public OpenFoodFactsProduct getProduct() { return product; }
        public void setProduct(OpenFoodFactsProduct product) { this.product = product; }
    }

    private static class OpenFoodFactsProduct {
        @JsonProperty("product_name")
        private String productName;

        @JsonProperty("product_name_en")
        private String productNameEn;

        @JsonProperty("generic_name")
        private String genericName;

        private String brands;

        public String getProductName() { return productName; }
        public void setProductName(String productName) { this.productName = productName; }
        public String getProductNameEn() { return productNameEn; }
        public void setProductNameEn(String productNameEn) { this.productNameEn = productNameEn; }
        public String getGenericName() { return genericName; }
        public void setGenericName(String genericName) { this.genericName = genericName; }
        public String getBrands() { return brands; }
        public void setBrands(String brands) { this.brands = brands; }
    }
}
