package org.jakub.backendapi.controllers;
import org.jakub.backendapi.dto.*;
import org.jakub.backendapi.dto.MealPlanDto.Store;
import org.jakub.backendapi.services.StoreOfferService;
import org.jakub.backendapi.services.LidlPriceCatalogService;
import org.jakub.backendapi.services.RateLimitService;
import org.jakub.backendapi.exceptions.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.time.*;
import java.util.*;
@RestController
@RequestMapping("/v2")
public class OfferCatalogController {
    private final StoreOfferService offers;
    private final LidlPriceCatalogService catalog;
    private final RateLimitService limits;
    public OfferCatalogController(StoreOfferService offers, LidlPriceCatalogService catalog, RateLimitService limits) { this.offers = offers; this.catalog = catalog; this.limits = limits; }
    @GetMapping("/stores") public List<Map<String, String>> stores(org.springframework.security.core.Authentication user) {
        return catalog.statusForUser(email(user), Set.of(Store.values()), LocalDate.now(ZoneId.of("Europe/Warsaw"))).stream()
                .map(s -> Map.of("store", s.store().name(), "sourceStatus", s.status())).toList();
    }
    @PostMapping("/offers/reload-prices") public List<StoreOfferDto.SourceStatus> refresh(org.springframework.security.core.Authentication user) {
        offers.requireAvailableTo(email(user));
        limits.assertAllowed("price-refresh:" + email(user), 2, 60_000, "Please wait before refreshing store prices again.");
        catalog.refresh(true);
        return catalog.status(Set.of(Store.values()), LocalDate.now(ZoneId.of("Europe/Warsaw")));
    }
    @GetMapping("/offers") public StoreOfferDto.Catalog catalog(org.springframework.security.core.Authentication user, @RequestParam Set<Store> stores, @RequestParam LocalDate shoppingDate) {
        offers.requireAvailableTo(email(user));
        LocalDate today = LocalDate.now(ZoneId.of("Europe/Warsaw"));
        if (stores.isEmpty() || shoppingDate.isBefore(today) || shoppingDate.isAfter(today.plusDays(7)))
            throw new AppException("Choose stores and a shopping date within seven days.", HttpStatus.BAD_REQUEST);
        catalog.ensureFresh(stores);
        String status = catalog.status(stores, shoppingDate).stream().filter(s -> s.store() == Store.LIDL && catalog.enabled())
                .map(StoreOfferDto.SourceStatus::status).findFirst().orElse("MANUAL_REVIEW_ONLY");
        return new StoreOfferDto.Catalog(shoppingDate, offers.eligible(stores, shoppingDate, Instant.now()), status,
                stores.contains(Store.LIDL) ? catalog.importSummary() : null);
    }
    private String email(org.springframework.security.core.Authentication user) {
        return user.getPrincipal() instanceof UserDto dto ? dto.getEmail() : user.getName();
    }
}
