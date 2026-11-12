package org.jakub.backendapi;

import org.jakub.backendapi.dto.*;
import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.dto.StoreOfferDto.*;
import org.jakub.backendapi.entities.*;
import org.jakub.backendapi.entities.Enums.*;
import org.jakub.backendapi.exceptions.AppException;
import org.jakub.backendapi.repositories.*;
import org.jakub.backendapi.services.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import tools.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@org.springframework.context.annotation.Import(org.jakub.backendapi.OffersEnabledTestConfiguration.class)
@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:promotion-first-it", "security.jwt.token.secret-key=promotion-first-integration-test-secret-32-characters",
        "posthog.enabled=false", "spring.jpa.show-sql=false", "app.planner.jobs-enabled=false"})
class PromotionFirstPlannerIntegrationTest {
    @Autowired MealPlanService plans;
    @Autowired MealPlanGenerationService generation;
    @Autowired MealPlanCandidateService candidates;
    @Autowired MealPlanPricingService pricing;
    @Autowired MealPlanJobService jobs;
    @Autowired MealPlanGenerationRepository jobRepository;
    @Autowired UserRepository users;
    @Autowired IngredientRepository ingredients;
    @Autowired FridgeIngredientRepository fridge;
    @Autowired StoreOfferRepository offerRepository;
    @Autowired StoreOfferService offers;
    @Autowired RecipeService recipes;
    @Autowired ObjectMapper json;
    @MockitoBean GeminiService gemini;
    String email;
    @BeforeEach void setup() {
        offerRepository.deleteAll();
        var owner = new User(); owner.setEmail(UUID.randomUUID() + "@example.com"); owner.setRole(Role.USER); users.saveAndFlush(owner); email = owner.getEmail();
    }
    @Test void ignoresAnUnpricedLibraryMealAndRetriesAiUntilTheShoppingListHasRealPriceCoverage() {
        publish("ryż", "500", "g", "3.99", false, null);
        publish("marchew", "1000", "g", "2.99", false, null);
        recipes.saveRecipe(recipe("Niepowiązane tofu", "tofu", "sos sojowy", "imbir"), email);
        var plan = plans.create(email, settings(1)); var slot = plan.plan().slots().get(0);
        when(gemini.generateRecipes(any(RecipeGenerationRequestDto.class), any())).thenReturn(
                json.writeValueAsString(recipe("Nadal bez cen", "tofu", "sos sojowy", "imbir")),
                json.writeValueAsString(recipe("Ryż z marchewką", "ryż", "marchew", "sól")));
        var result = generation.generate(email, plan.id(), slot.id(), new Generate(plan.version(), UUID.randomUUID()));
        assertThat(result.plan().slots().get(0).recipe().getName()).isEqualTo("Ryż z marchewką");
        var quote = pricing.preview(email, plan.id(), new QuoteRequest(result.version(), LocalDate.now(), Set.of()));
        assertThat(quote.baskets().get(0).pricedItems()).isEqualTo(2);
        assertThat(quote.baskets().get(0).missingItems()).isEqualTo(1);
        assertThat(quote.baskets().get(0).knownTotal()).isEqualByComparingTo("6.98");
        var requests = org.mockito.ArgumentCaptor.forClass(RecipeGenerationRequestDto.class);
        verify(gemini, times(2)).generateRecipes(requests.capture(), any());
        assertThat(requests.getValue().getRequestText()).contains("ranked, verified store products FIRST", "canonical ingredient names exactly", "marchew", "At least half");
        assertThat(requests.getValue().getPlanningIngredients()).extracting(RecipeGenerationRequestDto.PricedIngredient::name).contains("ryż", "marchew");
        assertThat(requests.getValue().getFridgePolicy()).isEqualTo(FridgePolicy.IGNORE);
        assertThat(requests.getValue().getFridgeItems()).isEmpty();
    }
    @Test void refusesAPlanWithNoEligiblePricesBeforeCallingAiAndPreservesAnExistingMeal() {
        var plan = plans.create(email, settings(1)); var slot = plan.plan().slots().get(0);
        var work = plans.beginGeneration(email, plan.id(), slot.id(), new Generate(plan.version(), UUID.randomUUID()));
        plan = plans.finishGeneration(email, plan.id(), slot.id(), work.slot().generationId(), work.view().version(), recipe("Oryginał", "tofu"));
        var original = plan;
        assertThatThrownBy(() -> generation.generate(email, original.id(), slot.id(), new Generate(original.version(), UUID.randomUUID())))
                .isInstanceOf(AppException.class).hasMessageContaining("No current priced products");
        verifyNoInteractions(gemini);
        assertThat(plans.get(email, plan.id()).plan().slots().get(0).recipe().getName()).isEqualTo("Oryginał");
    }
    @Test void aSingleTokenPricedIngredientCannotMakeAnOtherwiseUnpricedRecipePass() {
        publish("ryż", "500", "g", "3.99", false, null);
        when(gemini.generateRecipes(any(RecipeGenerationRequestDto.class), any())).thenReturn(json.writeValueAsString(recipe("Mało ryżu", "ryż", "tofu", "imbir", "sos sojowy")));
        var plan = plans.create(email, settings(1)); var slot = plan.plan().slots().get(0);
        assertThatThrownBy(() -> generation.generate(email, plan.id(), slot.id(), new Generate(plan.version(), UUID.randomUUID())))
                .isInstanceOf(AppException.class).hasMessageContaining("enough confirmed prices");
        assertThat(plans.get(email, plan.id()).plan().slots().get(0).recipe()).isNull();
        verify(gemini, times(3)).generateRecipes(any(RecipeGenerationRequestDto.class), any());
    }
    @Test void halfCoverageAloneDoesNotAllowAiToIgnoreTheSecondChosenPromotion() {
        publish("ryż", "500", "g", "3.99", false, null);
        publish("marchew", "1000", "g", "2.99", false, null);
        when(gemini.generateRecipes(any(RecipeGenerationRequestDto.class), any())).thenReturn(
                json.writeValueAsString(recipe("Brak drugiej okazji", "ryż", "sól")),
                json.writeValueAsString(recipe("Obie okazje", "ryż", "marchew", "sól")));
        var plan = plans.create(email, settings(1));
        var result = generation.generate(email, plan.id(), plan.plan().slots().get(0).id(), new Generate(plan.version(), UUID.randomUUID()));
        assertThat(result.plan().slots().get(0).recipe().getName()).isEqualTo("Obie okazje");
        verify(gemini, times(2)).generateRecipes(any(RecipeGenerationRequestDto.class), any());
    }
    @Test void pricedMealStillDeductsFridgeStockWithoutChangingTheInventory() {
        publish("jabłko", "1000", "g", "2.49", false, null);
        var stock = new FridgeIngredient(null, "ryż", null, 200d, Unit.GRAMS, users.findByEmail(email).orElseThrow());
        stock.setQuantityAccuracy(QuantityAccuracy.EXACT); stock = fridge.saveAndFlush(stock);
        when(gemini.generateRecipes(any(RecipeGenerationRequestDto.class), any())).thenReturn(json.writeValueAsString(recipe("Ryż z jabłkiem", "jabłko", "ryż", "sól")));
        var plan = plans.create(email, settings(1)); var slot = plan.plan().slots().get(0);
        var result = generation.generate(email, plan.id(), slot.id(), new Generate(plan.version(), UUID.randomUUID()));
        var shopping = plans.previewShopping(email, plan.id(), result.plan().slots());
        assertThat(shopping.items().stream().filter(i -> i.name().equals("ryż")).findFirst().orElseThrow().usedFromFridge()).isEqualTo(100d);
        assertThat(fridge.findById(stock.getId()).orElseThrow().getAmount()).isEqualTo(200d);
    }
    @Test void ranksConfirmedSavingsAndKeepsRegularAlternativesWhileExcludingUnconfirmedCoupons() {
        var regular = publish("ryż", "500", "g", "5.00", false, null);
        var deal = publish("marchew", "1000", "g", "2.00", false, "4.00");
        var coupon = publish("brokuł", "500", "g", "1.00", true, "5.00");
        var available = candidates.deals(email, settings(1));
        assertThat(available).extracting(Offer::id).containsExactly(deal.id(), regular.id()).doesNotContain(coupon.id());
        var selectedFirst = candidates.rank(available, Set.of(regular.id()));
        assertThat(selectedFirst.get(0).id()).isEqualTo(regular.id());
    }
    @Test void replanningReplacesOnlyUnlockedMealsIsIdempotentAndUsesPricesInTheDurableWorker() {
        publish("ryż", "500", "g", "3.99", false, null);
        var plan = plans.create(email, settings(2));
        for (var slot : plan.plan().slots()) {
            var work = plans.beginGeneration(email, plan.id(), slot.id(), new Generate(plan.version(), UUID.randomUUID()));
            plan = plans.finishGeneration(email, plan.id(), slot.id(), work.slot().generationId(), work.view().version(), recipe("Stare " + slot.id(), "tofu"));
        }
        var locked = plan.plan().slots().get(0);
        plan = plans.change(email, plan.id(), locked.id(), new Change(plan.version(), Action.LOCK, null));
        var input = new Generate(plan.version(), UUID.randomUUID()); var job = jobs.replanFromOffers(email, plan.id(), input);
        assertThat(job.total()).isEqualTo(1); assertThat(jobs.replanFromOffers(email, plan.id(), input).id()).isEqualTo(job.id());
        when(gemini.generateRecipes(any(RecipeGenerationRequestDto.class), any())).thenReturn(json.writeValueAsString(recipe("Ryż z okazji", "ryż")));
        new MealPlanJobWorker(jobs, jobRepository, plans, generation).execute(jobs.claim(job.id()));
        assertThat(jobs.latest(email, plan.id()).status()).isEqualTo("COMPLETED");
        var result = plans.get(email, plan.id());
        assertThat(result.plan().slots().get(0).recipe()).isEqualTo(locked.recipe());
        assertThat(result.plan().slots().get(1).recipe().getName()).isEqualTo("Ryż z okazji");
        assertThat(result.plan().settings().planningMode()).isEqualTo(PlanningMode.PROMOTIONS_FIRST);
    }
    private Create settings(int days) {
        return new Create(UUID.randomUUID(), LocalDate.now(), days, 2, Set.of(MealType.DINNER), Set.of(Store.LIDL), null, "pl", 45,
                PlanningMode.PROMOTIONS_FIRST, BudgetMode.NONE, new ShoppingOptions(LocalDate.now(), 1, Set.of(), Set.of(), Set.of(), false));
    }
    private RecipeDto recipe(String title, String... names) {
        var r = new RecipeDto(null, title, Arrays.stream(names).map(n -> new RecipeIngredientDto(n, n.equals("sól") ? 2 : 100, "g")).toList(),
                List.of("Przygotuj i ugotuj składniki."), "Kontrolowane dane testowe", "20 min", 2); r.setLocale(ContentLocale.pl); r.setVisibility(RecipeVisibility.PRIVATE); return r;
    }
    private Offer publish(String name, String amount, String unit, String price, boolean coupon, String regular) {
        var ingredient = ingredients.findByNameIgnoreCase(name).orElseGet(() -> ingredients.saveAndFlush(new Ingredient(null, name, List.of())));
        return offers.publish(UUID.randomUUID(), new Publish(0, Store.LIDL, ingredient.getId(), name, new BigDecimal(amount), unit, new BigDecimal(price),
                1, 1, null, coupon, LocalDate.now(), LocalDate.now().plusDays(2), "https://www.lidl.pl/p/controlled-price-fixture", "Kontrolowane dane testowe", Instant.now(),
                true, true, true, coupon, null, null, regular == null ? null : new BigDecimal(regular), "DRY", false, null, null));
    }
}
