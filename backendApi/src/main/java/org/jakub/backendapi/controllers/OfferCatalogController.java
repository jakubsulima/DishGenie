package org.jakub.backendapi.controllers;
import org.jakub.backendapi.dto.*;
import org.jakub.backendapi.dto.MealPlanDto.Store;
import org.jakub.backendapi.services.StoreOfferService;
import org.jakub.backendapi.exceptions.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.time.*;
import java.util.*;
@RestController
@RequestMapping("/v2")
public class OfferCatalogController {
    private final StoreOfferService offers;
    public OfferCatalogController(StoreOfferService offers) { this.offers = offers; }
    @GetMapping("/stores") public List<Map<String, String>> stores() {
        return Arrays.stream(Store.values()).map(s -> Map.of("store", s.name(), "sourceStatus", "MANUAL_REVIEW_ONLY")).toList();
    }
    @GetMapping("/offers") public StoreOfferDto.Catalog catalog(@RequestParam Set<Store> stores, @RequestParam LocalDate shoppingDate) {
        LocalDate today = LocalDate.now(ZoneId.of("Europe/Warsaw"));
        if (stores.isEmpty() || shoppingDate.isBefore(today) || shoppingDate.isAfter(today.plusDays(7)))
            throw new AppException("Choose stores and a shopping date within seven days.", HttpStatus.BAD_REQUEST);
        return new StoreOfferDto.Catalog(shoppingDate, offers.eligible(stores, shoppingDate, Instant.now()), "MANUAL_REVIEW_ONLY");
    }
}
