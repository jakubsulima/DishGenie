package org.jakub.backendapi;

import org.jakub.backendapi.dto.*;
import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.entities.*;
import org.jakub.backendapi.entities.Enums.*;
import org.jakub.backendapi.repositories.*;
import org.jakub.backendapi.services.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import tools.jackson.databind.*;
import tools.jackson.databind.node.ObjectNode;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@org.springframework.context.annotation.Import(org.jakub.backendapi.OffersEnabledTestConfiguration.class)
@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:price-catalog-it", "security.jwt.token.secret-key=price-catalog-test-secret-key-at-least-32-characters",
        "posthog.enabled=false", "spring.jpa.show-sql=false", "app.planner.jobs-enabled=false", "app.offers.lidl-price-import-enabled=true", "app.offers.lidl-leaflet-import-enabled=false", "app.offers.initial-delay-ms=86400000"})
class PriceCatalogIntegrationTest {
    @Autowired LidlPriceCatalogService catalog;
    @Autowired StoreOfferService offers;
    @Autowired StoreOfferRepository offerRepository;
    @Autowired OfferSourceRunRepository runs;
    @Autowired MealPlanService plans;
    @Autowired MealPlanPricingService pricing;
    @Autowired UserRepository users;
    @Autowired ObjectMapper json;
    @Autowired org.jakub.backendapi.controllers.OfferCatalogController controller;
    @MockitoBean LidlReviewCaptureService source;
    private List<JsonNode> fixtureProducts;
    @BeforeEach void setup() throws Exception {
        runs.deleteAll(); offerRepository.deleteAll();
        List<JsonNode> products = new ArrayList<>();
        for (String fixture : List.of("/offers/lidl-prices-2026-11-06.json", "/offers/lidl-categories-2026-11-07.json", "/offers/lidl-prices-2026-11-11.json")) {
            try (var stream = getClass().getResourceAsStream(fixture)) {
                for (JsonNode item : json.readTree(stream)) {
                    ObjectNode product = (ObjectNode) item;
                    var today = LocalDate.now(ZoneId.of("Europe/Warsaw")).atStartOfDay(ZoneId.of("Europe/Warsaw")).toInstant();
                    product.put("storeStartDate", today.getEpochSecond()); product.put("storeEndDate", today.plusSeconds(172799).getEpochSecond());
                    for (String field : List.of("currentPrice", "currentLidlPlusPrice")) {
                        JsonNode value = product.path("regionsPrices").path("1").path(field);
                        if (field.equals("currentLidlPlusPrice")) value = value.path("price");
                        if (value instanceof ObjectNode price) { price.put("startDate", today.toString()); price.put("endDate", today.plusSeconds(172799).toString()); }
                    }
                    products.add(product);
                }
            }
        }
        var unique = new LinkedHashMap<String, JsonNode>();
        products.forEach(p -> unique.put(p.path("productId").asText(), p));
        products = new ArrayList<>(unique.values());
        fixtureProducts = products;
        when(source.fetchPricePage(0)).thenReturn(new LidlReviewCaptureService.PricePage(products.size(), products.size(), products));
    }
    @Test void followsPaginationBeyondTheFirstFortyEightProducts() {
        List<JsonNode> first = new ArrayList<>();
        for (int i = 0; i < 48; i++) {
            ObjectNode p = (ObjectNode) json.readTree(json.writeValueAsString(fixtureProducts.get(0)));
            p.put("productId", "page-one-" + i); first.add(p);
        }
        when(source.fetchPricePage(0)).thenReturn(new LidlReviewCaptureService.PricePage(49, 48, first));
        when(source.fetchPricePage(48)).thenReturn(new LidlReviewCaptureService.PricePage(49, 1, List.of(fixtureProducts.get(1))));
        var result = catalog.refresh(true);
        assertThat(result.candidates()).isEqualTo(49); assertThat(result.status()).isEqualTo("LIVE_PARTIAL");
        verify(source).fetchPricePage(48);
    }
    @Test void missingOrRepeatedLastPageCannotRetireThePreviousCatalog() {
        catalog.refresh(true); long before = offerRepository.findAll().stream().filter(StoreOffer::isActive).count(); runs.deleteAll();
        var repeated = Collections.nCopies(48, fixtureProducts.get(0));
        when(source.fetchPricePage(0)).thenReturn(new LidlReviewCaptureService.PricePage(49, 48, repeated));
        when(source.fetchPricePage(48)).thenThrow(new IllegalStateException("last page unavailable"));
        assertThat(catalog.refresh(true).status()).isEqualTo("LIVE_FETCH_INCOMPLETE");
        assertThat(offerRepository.findAll().stream().filter(StoreOffer::isActive).count()).isEqualTo(before);
        runs.deleteAll();
        doReturn(new LidlReviewCaptureService.PricePage(49, 1, List.of(fixtureProducts.get(0)))).when(source).fetchPricePage(48);
        assertThat(catalog.refresh(true).status()).isEqualTo("LIVE_FETCH_INCOMPLETE");
        assertThat(offerRepository.findAll().stream().filter(StoreOffer::isActive).count()).isEqualTo(before);
    }
    @Test void realPriceFormatsPopulateTheCatalogAndPriceADraftWithSeparateCardAndCouponPermissions() {
        var imported = catalog.refresh(true); assertThat(imported.published()).isPositive();
        assertThat(imported.status()).isEqualTo("LIVE_PARTIAL");
        catalog.refresh(false); verify(source, times(1)).fetchPricePage(0);
        var available = offers.eligible(Set.of(Store.LIDL), LocalDate.now(), Instant.now());
        assertThat(available).allMatch(o -> o.sourceType().equals("LIDL_PUBLIC"));
        assertThat(available.stream().map(StoreOfferDto.Offer::ingredientKey)).contains("smoked-pork-loin", "krakowska-sausage", "silesian-sausage",
                        "cucumber", "hokkaido-squash", "pointed-cabbage", "butter", "gouda", "nectarine")
                .doesNotContain("st-martin-croissant");
        var milkCoupon = available.stream().filter(o -> "milk".equals(o.ingredientKey()) && o.details().loyaltyRequired()).findFirst().orElseThrow();
        var user = new User(); user.setEmail(UUID.randomUUID() + "@example.com"); user.setRole(Role.USER); users.saveAndFlush(user);
        var settings = new Create(UUID.randomUUID(), LocalDate.now(), 1, 2, Set.of(MealType.DINNER), Set.of(Store.LIDL), null, "pl", 45,
                PlanningMode.DEALS, BudgetMode.NONE, new ShoppingOptions(LocalDate.now(), 1, Set.of(), Set.of(), Set.of(), false));
        var plan = plans.create(user.getEmail(), settings); var slot = plan.plan().slots().get(0); UUID request = UUID.randomUUID();
        var work = plans.beginGeneration(user.getEmail(), plan.id(), slot.id(), new Generate(plan.version(), request));
        var recipe = new RecipeDto(null, "Przepis testowy z mlekiem", List.of(new RecipeIngredientDto("mleko", 1000, "ml")), List.of("Podgrzej mleko."), "Dane testowe", "5 min", 2);
        recipe.setLocale(ContentLocale.pl);
        plan = plans.finishGeneration(user.getEmail(), plan.id(), slot.id(), request, work.view().version(), recipe);
        var quote = pricing.preview(user.getEmail(), plan.id(), new StoreOfferDto.QuoteRequest(plan.version(), LocalDate.now(), Set.of()));
        assertThat(quote.baskets().get(0).knownTotal()).isEqualByComparingTo("3.99");
        assertThat(quote.baskets().get(0).pricedItems()).isEqualTo(1); assertThat(quote.sources().get(0).status()).isEqualTo("LIVE_PARTIAL");
        plan = plans.change(user.getEmail(), plan.id(), slot.id(), new Change(plan.version(), Action.SERVINGS, 14));
        var cardOnly = pricing.preview(user.getEmail(), plan.id(), new StoreOfferDto.QuoteRequest(plan.version(), LocalDate.now(), Set.of(Store.LIDL)));
        assertThat(cardOnly.baskets().get(0).knownTotal()).isEqualByComparingTo("27.93");
        var coupon = pricing.preview(user.getEmail(), plan.id(), new StoreOfferDto.QuoteRequest(plan.version(), LocalDate.now(), Set.of(Store.LIDL), Set.of(milkCoupon.id())));
        // Six discounted cartons plus one regular carton cost less than buying a second whole promotional bundle.
        assertThat(coupon.baskets().get(0).knownTotal()).isEqualByComparingTo("15.93");
        assertThat(coupon.baskets().get(0).items().get(0).packages()).isEqualByComparingTo("7");
    }
    @Test void failedRefreshPreservesPreviouslyValidPricesAndReportsTheFailure() {
        catalog.refresh(true); long before = offerRepository.count(); runs.deleteAll();
        when(source.fetchPricePage(anyInt())).thenThrow(new IllegalStateException("offline"));
        var result = catalog.refresh(true);
        assertThat(result.status()).isEqualTo("LIVE_FETCH_INCOMPLETE"); assertThat(result.published()).isZero();
        assertThat(offerRepository.count()).isEqualTo(before);
        assertThat(offers.eligible(Set.of(Store.LIDL), LocalDate.now(), Instant.now())).isNotEmpty();
        assertThat(controller.catalog(new org.springframework.security.authentication.TestingAuthenticationToken("test@example.com", ""), Set.of(Store.LIDL), LocalDate.now()).sourceStatus()).isEqualTo("LIVE_FETCH_INCOMPLETE");
    }
    @Test void expandedSourceVersionRefreshesEvenWhenTheOldCatalogWasJustFetched() {
        var first = catalog.refresh(true);
        var old = runs.findById(first.id()).orElseThrow();
        old.setDocument(json.writeValueAsString(new LidlCatalogStore.Result(first.id(), first.fetchedAt(), first.status(), first.candidates(), first.published(), 0)));
        runs.saveAndFlush(old); clearInvocations(source);
        var refreshed = catalog.refresh(false);
        assertThat(refreshed.id()).isNotEqualTo(first.id());
        assertThat(refreshed.sourceVersion()).isEqualTo(LidlCatalogStore.SOURCE_VERSION);
        verify(source, times(1)).fetchPricePage(0);
    }
    @Test void previouslyImportedPastryIsExcludedEvenWhenTheNextRefreshFails() {
        catalog.refresh(true);
        var cached = offerRepository.findAll().get(0);
        var pastry = new StoreOffer(); pastry.setId(UUID.randomUUID()); pastry.setStore(cached.getStore());
        pastry.setValidFrom(cached.getValidFrom()); pastry.setValidTo(cached.getValidTo()); pastry.setVerifiedAt(cached.getVerifiedAt());
        pastry.setActive(true); pastry.setDocument(cached.getDocument()); pastry.setSourceType(LidlCatalogStore.SOURCE_TYPE);
        pastry.setIngredientKey("st-martin-croissant"); offerRepository.saveAndFlush(pastry);
        runs.deleteAll(); when(source.fetchPricePage(anyInt())).thenThrow(new IllegalStateException("offline"));
        assertThat(catalog.refresh(true).status()).isEqualTo("LIVE_FETCH_INCOMPLETE");
        var available = offers.eligible(Set.of(Store.LIDL), LocalDate.now(), Instant.now());
        assertThat(available).isNotEmpty().noneMatch(o -> o.id().equals(pastry.getId()));
        assertThat(offerRepository.findById(pastry.getId())).isPresent();
    }
}
