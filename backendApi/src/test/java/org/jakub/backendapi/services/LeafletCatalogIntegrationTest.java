package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.*;
import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.entities.*;
import org.jakub.backendapi.entities.Enums.*;
import org.jakub.backendapi.repositories.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@org.springframework.context.annotation.Import(org.jakub.backendapi.OffersEnabledTestConfiguration.class)
@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:leaflet-catalog-it",
        "security.jwt.token.secret-key=leaflet-catalog-test-secret-key-at-least-32-characters",
        "posthog.enabled=false", "spring.jpa.show-sql=false", "app.planner.jobs-enabled=false",
        "app.offers.lidl-price-import-enabled=true", "app.offers.initial-delay-ms=86400000"})
class LeafletCatalogIntegrationTest {
    @Autowired LidlPriceCatalogService catalog;
    @Autowired StoreOfferService offers;
    @Autowired StoreOfferRepository repository;
    @Autowired OfferSourceRunRepository runs;
    @Autowired MealPlanService plans;
    @Autowired MealPlanPricingService pricing;
    @Autowired MealPlanCandidateService candidates;
    @Autowired UserRepository users;
    @Autowired ObjectMapper json;
    @MockitoBean LidlLeafletImportService source;
    private final LocalDate today = LocalDate.now(ZoneId.of("Europe/Warsaw"));
    @BeforeEach void setup() throws Exception {
        runs.deleteAll(); repository.deleteAll();
        var fixture = json.readTree(getClass().getResourceAsStream("/offers/lidl-full-leaflet-reviewed.json"));
        long shift = ChronoUnit.DAYS.between(LocalDate.of(2026, 11, 11), today);
        for (var row : fixture.path("applicationOffers")) {
            for (String field : List.of("validFrom", "validTo"))
                ((ObjectNode) row).put(field, LocalDate.parse(row.path(field).asText()).plusDays(shift).toString());
        }
        var parser = new LidlLeafletImportService(json, true, "unused", "unused", "/tmp/unused");
        when(source.enabled()).thenReturn(true);
        when(source.fetch(anyBoolean())).thenReturn(parser.parse(fixture, Instant.now()));
    }
    @Test void fullLeafletFeedsTheSamePlannerAndQuoteWithoutRoundingTheFreeItemBundle() {
        var imported = catalog.refresh(true);
        assertThat(imported.status()).isEqualTo("LIVE_LEAFLET_REVIEWED");
        assertThat(imported.published()).isEqualTo(85); assertThat(imported.leaflet().products()).isEqualTo(50);
        catalog.refresh(true); assertThat(repository.count()).isEqualTo(85);
        verify(source, times(1)).fetch(true);
        var available = offers.eligible(Set.of(Store.LIDL), today.plusDays(1), Instant.now());
        assertThat(available).anyMatch(o -> "chicken-mince".equals(o.ingredientKey()));
        assertThat(available).anyMatch(o -> "split-peas".equals(o.ingredientKey()));
        var coupon = available.stream().filter(o -> o.details().productName().equals("Kaki") && o.details().bundlePrice() != null).findFirst().orElseThrow();
        var user = new User(); user.setEmail(UUID.randomUUID()+"@example.com"); user.setRole(Role.USER); users.saveAndFlush(user);
        var settings = new Create(UUID.randomUUID(), today.plusDays(1), 1, 2, Set.of(MealType.DINNER), Set.of(Store.LIDL), null,
                "pl", 45, PlanningMode.DEALS, BudgetMode.NONE,
                new ShoppingOptions(today.plusDays(1), 1, Set.of(Store.LIDL), Set.of(), Set.of(), false));
        assertThat(candidates.deals(user.getEmail(), settings)).noneMatch(o -> o.id().equals(coupon.id()));
        var plan = plans.create(user.getEmail(), settings); var slot = plan.plan().slots().get(0); var request = UUID.randomUUID();
        var work = plans.beginGeneration(user.getEmail(), plan.id(), slot.id(), new Generate(plan.version(), request));
        var recipe = new RecipeDto(null, "Kontrola dokładnej ceny zestawu", List.of(new RecipeIngredientDto("kaki", 2, "pcs")),
                List.of("Pokrój owoce."), "Kontrola ceny", "5 min", 2); recipe.setLocale(ContentLocale.pl);
        plan = plans.finishGeneration(user.getEmail(), plan.id(), slot.id(), request, work.view().version(), recipe);
        var cardOnly = pricing.preview(user.getEmail(), plan.id(), new StoreOfferDto.QuoteRequest(plan.version(), today.plusDays(1), Set.of(Store.LIDL)));
        assertThat(cardOnly.baskets().get(0).knownTotal()).isEqualByComparingTo("9.98");
        var confirmed = pricing.preview(user.getEmail(), plan.id(), new StoreOfferDto.QuoteRequest(plan.version(), today.plusDays(1), Set.of(Store.LIDL), Set.of(coupon.id())));
        assertThat(confirmed.baskets().get(0).knownTotal()).isEqualByComparingTo("4.99");
        assertThat(confirmed.sources().get(0).status()).isEqualTo("LIVE_LEAFLET_REVIEWED");
    }
    @Test void failedOrChangedLeafletPreservesTheLastValidCatalogAndReportsFailure() {
        catalog.refresh(true); var ids = repository.findAll().stream().map(StoreOffer::getId).toList(); runs.deleteAll();
        when(source.fetch(true)).thenThrow(new IllegalStateException("UNREVIEWED_LEAFLET"));
        assertThat(catalog.refresh(true).status()).isEqualTo("LIVE_LEAFLET_REVIEW_REQUIRED");
        assertThat(repository.findAll()).extracting(StoreOffer::getId).containsExactlyInAnyOrderElementsOf(ids);
        assertThat(offers.eligible(Set.of(Store.LIDL), today.plusDays(1), Instant.now())).isNotEmpty();
    }
}
