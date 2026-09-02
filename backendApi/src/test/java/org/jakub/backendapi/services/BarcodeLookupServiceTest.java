package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.BarcodeProductDto;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;

class BarcodeLookupServiceTest {
    @Test
    void returnsTheBestAvailableProductNameWithoutForwardingRawResponse() {
        RestTemplate restTemplate = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.bindTo(restTemplate).build();
        server.expect(requestTo("https://off.test/product/5901234123457.json"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withStatus(HttpStatus.OK)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("""
                                {"status":1,"product":{"product_name":"","product_name_en":"Oat Drink","generic_name":"Drink","brands":"Kitchen Brand"}}
                                """));

        BarcodeLookupService service = new BarcodeLookupService(restTemplate, "https://off.test/product");

        Optional<BarcodeProductDto> result = service.lookup(" 5901234123457 ");

        assertTrue(result.isPresent());
        assertEquals("5901234123457", result.get().getBarcode());
        assertEquals("Oat Drink", result.get().getName());
        assertEquals("Kitchen Brand", result.get().getBrand());
        server.verify();
    }

    @Test
    void treatsUnknownProductsAndProviderFailuresAsNotFound() {
        RestTemplate restTemplate = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.bindTo(restTemplate).build();
        server.expect(requestTo("https://off.test/product/0000000000000.json"))
                .andRespond(withStatus(HttpStatus.OK)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"status\":0}"));

        BarcodeLookupService service = new BarcodeLookupService(restTemplate, "https://off.test/product");

        assertTrue(service.lookup("0000000000000").isEmpty());
        assertTrue(service.lookup(" ").isEmpty());
        server.verify();
    }
}
