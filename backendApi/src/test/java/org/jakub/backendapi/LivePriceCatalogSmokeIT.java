package org.jakub.backendapi;

import org.jakub.backendapi.dto.*;
import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.entities.*;
import org.jakub.backendapi.entities.Enums.*;
import org.jakub.backendapi.repositories.*;
import org.jakub.backendapi.services.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

@EnabledIfEnvironmentVariable(named = "RUN_LIVE_PRICE_SMOKE", matches = "1")
@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:live-price-smoke", "security.jwt.token.secret-key=live-price-smoke-secret-key-at-least-32-characters",
        "posthog.enabled=false", "spring.jpa.show-sql=false", "app.planner.jobs-enabled=false", "app.offers.lidl-price-import-enabled=true", "app.offers.lidl-leaflet-import-enabled=false", "app.offers.initial-delay-ms=86400000"})
class LivePriceCatalogSmokeIT {
    @Autowired LidlPriceCatalogService catalog;
    @Autowired StoreOfferService offers;
    @Autowired IngredientRepository ingredients;
    @Autowired UserRepository users;
    @Autowired MealPlanService plans;
    @Autowired MealPlanPricingService pricing;
    @Test void officialPricesArePersistedAndUsedInARealDraftQuote() {
        var imported = catalog.refresh(true); assertThat(imported.published()).isPositive();
        assertThat(imported.status()).isEqualTo("LIVE_PARTIAL");
        LocalDate today = LocalDate.now(ZoneId.of("Europe/Warsaw"));
        var catalogOffers = java.util.stream.IntStream.rangeClosed(0, 7).boxed()
                .flatMap(day -> offers.eligible(Set.of(Store.LIDL), today.plusDays(day), Instant.now()).stream())
                .collect(java.util.stream.Collectors.toMap(StoreOfferDto.Offer::id, o -> o, (a, b) -> a)).values();
        System.out.println("LIVE_PRICE_COVERAGE: products=" + catalogOffers.stream().map(o -> o.details().sourceUrl()).distinct().count()
                + ", categories=" + catalogOffers.stream().map(o -> o.details().category()).collect(java.util.stream.Collectors.toSet()));
        var offer = java.util.stream.IntStream.rangeClosed(0, 7).boxed()
                .flatMap(day -> offers.eligible(Set.of(Store.LIDL), today.plusDays(day), Instant.now()).stream())
                .filter(o -> !o.details().loyaltyRequired() && !Boolean.TRUE.equals(o.details().couponRequired())).findFirst().orElseThrow();
        LocalDate shoppingDate = offer.details().validFrom().isAfter(today) ? offer.details().validFrom() : today;
        var ingredient = ingredients.findById(offer.details().ingredientId()).orElseThrow();
        var owner = new User(); owner.setEmail(UUID.randomUUID() + "@example.com"); owner.setRole(Role.USER); users.saveAndFlush(owner);
        var settings = new Create(UUID.randomUUID(), shoppingDate, 1, 2, Set.of(MealType.DINNER), Set.of(Store.LIDL), null, "pl", 45,
                PlanningMode.DEALS, BudgetMode.NONE, new ShoppingOptions(shoppingDate, 1, Set.of(), Set.of(), Set.of(), false));
        var plan = plans.create(owner.getEmail(), settings); var slot = plan.plan().slots().get(0); UUID request = UUID.randomUUID();
        var work = plans.beginGeneration(owner.getEmail(), plan.id(), slot.id(), new Generate(plan.version(), request));
        var recipe = new RecipeDto(null, "Kontrolowany przepis do sprawdzenia rzeczywistej ceny", List.of(new RecipeIngredientDto(ingredient.getName(), offer.details().packageAmount().doubleValue(), offer.details().unit())), List.of("Sprawdź produkt."), "Test integracji ceny", "5 min", 2);
        recipe.setLocale(ContentLocale.pl);
        plan = plans.finishGeneration(owner.getEmail(), plan.id(), slot.id(), request, work.view().version(), recipe);
        var quote = pricing.preview(owner.getEmail(), plan.id(), new StoreOfferDto.QuoteRequest(plan.version(), shoppingDate, Set.of()));
        assertThat(quote.baskets().get(0).pricedItems()).isEqualTo(1); assertThat(quote.baskets().get(0).knownTotal()).isPositive();
        System.out.println("LIVE_PRICE_CATALOG: candidates=" + imported.candidates() + ", imported=" + imported.published() + ", shoppingDate=" + shoppingDate + ", priced=" + quote.baskets().get(0).pricedItems() + ", total=" + quote.baskets().get(0).knownTotal());
    }
}
