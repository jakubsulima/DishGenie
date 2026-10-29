package org.jakub.backendapi;

import org.jakub.backendapi.dto.*;
import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.entities.*;
import org.jakub.backendapi.entities.Enums.*;
import org.jakub.backendapi.exceptions.AppException;
import org.jakub.backendapi.repositories.*;
import org.jakub.backendapi.services.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "security.jwt.token.secret-key=meal-plan-integration-test-secret-key-at-least-32",
        "posthog.enabled=false", "spring.jpa.show-sql=false"
})
@AutoConfigureMockMvc
class MealPlanIntegrationTest {
    @Autowired MealPlanService plans;
    @Autowired MealPlanGenerationService generation;
    @Autowired UserRepository users;
    @Autowired FridgeIngredientRepository fridge;
    @Autowired MealPlanRepository repository;
    @Autowired MockMvc mvc;
    @Autowired StoreOfferService offers;
    @Autowired MealPlanPricingService pricing;
    @Autowired IngredientRepository ingredients;
    @Autowired ObjectMapper json;
    @MockitoBean GeminiService gemini;
    private User owner;
    private String email;

    @BeforeEach
    void setUp() {
        email = UUID.randomUUID() + "@example.com";
        owner = new User(); owner.setEmail(email); owner.setRole(Role.USER);
        owner = users.saveAndFlush(owner);
        when(gemini.generateRecipes(any(RecipeGenerationRequestDto.class), any())).thenReturn("""
            {"name":"Ryż z warzywami","description":"Prosty obiad","servings":2,"timeToPrepare":"20 min",
             "ingredients":[{"name":"ryż","amount":300,"unit":"g"}],"instructions":["Ugotuj ryż."]}
            """);
    }

    @Test
    void completeFlowIsPersistentIdempotentAndDeductsStockOnlyOnce() {
        Create input = settings();
        View plan = plans.create(email, input);
        assertThat(plans.create(email, input).id()).isEqualTo(plan.id());
        assertThat(plans.list(email)).hasSize(1);
        UUID first = plan.plan().slots().get(0).id();
        UUID second = plan.plan().slots().get(1).id();
        Generate request = new Generate(plan.version(), UUID.randomUUID());
        plan = generation.generate(email, plan.id(), first, request);
        assertThat(generation.generate(email, plan.id(), first, request).version()).isEqualTo(plan.version());
        verify(gemini, times(1)).generateRecipes(any(RecipeGenerationRequestDto.class), any());
        plan = generation.generate(email, plan.id(), second, new Generate(plan.version(), UUID.randomUUID()));
        var stock = new FridgeIngredient(null, "ryż", null, 400d, Unit.GRAMS, owner);
        stock.setQuantityAccuracy(org.jakub.backendapi.entities.Enums.QuantityAccuracy.EXACT);
        fridge.saveAndFlush(stock);
        plan = plans.accept(email, plan.id(), new Version(plan.version()));
        assertThat(plan.plan().shopping().items().get(0).amount()).isEqualTo(200d);
        String key = plan.plan().shopping().items().get(0).key();
        plan = plans.checkShopping(email, plan.id(), new Check(plan.version(), key, true));
        plan = plans.refreshShopping(email, plan.id(), new Version(plan.version()));
        assertThat(plans.get(email, plan.id()).plan().shopping().checkedKeys()).contains(key);
        assertThat(users.findByEmail(email).orElseThrow().getDailyRecipeCount()).isEqualTo(2);
    }

    @Test
    void locksConflictsAndOwnershipProtectSavedPlans() {
        View initial = plans.create(email, settings());
        UUID slot = initial.plan().slots().get(0).id();
        View generated = generation.generate(email, initial.id(), slot, new Generate(initial.version(), UUID.randomUUID()));
        View locked = plans.change(email, initial.id(), slot, new Change(generated.version(), Action.LOCK, null));
        assertThatThrownBy(() -> plans.change(email, locked.id(), slot, new Change(locked.version(), Action.SKIP, null)))
                .isInstanceOf(AppException.class);
        assertThatThrownBy(() -> plans.change(email, locked.id(), slot, new Change(initial.version(), Action.UNLOCK, null)))
                .isInstanceOf(AppException.class).extracting("code").isEqualTo(HttpStatus.CONFLICT);
        assertThatThrownBy(() -> plans.get("other@example.com", initial.id()))
                .isInstanceOf(AppException.class).extracting("code").isEqualTo(HttpStatus.NOT_FOUND);
        assertThatThrownBy(() -> plans.accept("other@example.com", initial.id(), new Version(locked.version())))
                .isInstanceOf(AppException.class).extracting("code").isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void failureKeepsPreviousMealAndReleasesQuota() {
        View initial = plans.create(email, settings());
        UUID slot = initial.plan().slots().get(0).id();
        View generated = generation.generate(email, initial.id(), slot, new Generate(initial.version(), UUID.randomUUID()));
        when(gemini.generateRecipes(any(RecipeGenerationRequestDto.class), any()))
                .thenThrow(new AppException("Provider unavailable", HttpStatus.BAD_GATEWAY));
        assertThatThrownBy(() -> generation.generate(email, initial.id(), slot, new Generate(generated.version(), UUID.randomUUID())))
                .isInstanceOf(AppException.class);
        var saved = plans.get(email, initial.id()).plan().slots().get(0);
        assertThat(saved.recipe().getName()).isEqualTo("Ryż z warzywami");
        assertThat(saved.generationStatus()).isEqualTo(GenerationStatus.FAILED);
        assertThat(users.findByEmail(email).orElseThrow().getDailyRecipeCount()).isEqualTo(1);
    }

    @Test
    void staleGenerationCannotOverwriteNewerEdits() {
        View initial = plans.create(email, settings());
        UUID slot = initial.plan().slots().get(0).id();
        var work = plans.beginGeneration(email, initial.id(), slot, new Generate(initial.version(), UUID.randomUUID()));
        plans.failGeneration(email, initial.id(), slot, work.slot().generationId());
        assertThatThrownBy(() -> plans.finishGeneration(email, initial.id(), slot, work.slot().generationId(),
                work.view().version(), new RecipeDto())).isInstanceOf(AppException.class);
    }

    @Test
    void routesUseAuthenticatedDtoAndValidateInputsAndCsrf() throws Exception {
        var auth = new UsernamePasswordAuthenticationToken(new UserDto(email, owner.getId(), Role.USER, null), null,
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
        mvc.perform(get("/v2/meal-plans")).andExpect(status().isUnauthorized());
        mvc.perform(post("/v2/meal-plans").with(authentication(auth)).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(settings()))).andExpect(status().isForbidden());
        mvc.perform(post("/v2/meal-plans").with(authentication(auth)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(settings()))).andExpect(status().isOk()).andExpect(jsonPath("$.plan.slots.length()").value(2));
        Create bad = new Create(UUID.randomUUID(), LocalDate.now(), 8, 0, Set.of(MealType.DINNER), Set.of(Store.LIDL),
                new BigDecimal("-1"), "pl", 45);
        mvc.perform(post("/v2/meal-plans").with(authentication(auth)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(bad))).andExpect(status().isBadRequest());
    }

    @Test
    void verifiedOffersPriceAnOwnedPlanAndCanBeWithdrawn() throws Exception {
        Ingredient rice = ingredients.findByNameIgnoreCase("ryż").orElseGet(() -> ingredients.saveAndFlush(new Ingredient(null, "ryż", List.of())));
        var input = offerInput(rice.getId(), "https://www.lidl.pl/p/test-fixture");
        UUID offerId = UUID.randomUUID();
        var admin = new UsernamePasswordAuthenticationToken("staff@example.com", null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        var auth = new UsernamePasswordAuthenticationToken(new UserDto(email, owner.getId(), Role.USER, null), null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
        mvc.perform(put("/admin/store-offers/" + offerId).with(authentication(auth)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input))).andExpect(status().isForbidden());
        mvc.perform(put("/admin/store-offers/" + offerId).with(authentication(admin)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input))).andExpect(status().isOk());
        View plan = plans.create(email, settings());
        UUID slot = plan.plan().slots().get(0).id();
        plan = generation.generate(email, plan.id(), slot, new Generate(plan.version(), UUID.randomUUID()));
        plan = plans.accept(email, plan.id(), new Version(plan.version()));
        var request = new org.jakub.backendapi.dto.StoreOfferDto.QuoteRequest(plan.version(), LocalDate.now(), Set.of());
        var result = pricing.quote(email, plan.id(), request);
        assertThat(result.baskets().get(0).knownTotal()).isEqualByComparingTo("3.99");
        assertThat(result.baskets().get(0).items().get(0).purchasedAmount()).isEqualByComparingTo("400");
        assertThat(result.baskets().get(1).missingItems()).isEqualTo(1);
        mvc.perform(post("/v2/meal-plans/" + plan.id() + "/quote").with(authentication(auth)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.baskets[0].knownTotal").value(3.99));
        UUID planId = plan.id();
        assertThatThrownBy(() -> pricing.quote("other@example.com", planId, request)).isInstanceOf(AppException.class)
                .extracting("code").isEqualTo(HttpStatus.NOT_FOUND);
        assertThatThrownBy(() -> pricing.quote(email, planId, new org.jakub.backendapi.dto.StoreOfferDto.QuoteRequest(0, LocalDate.now(), Set.of())))
                .isInstanceOf(AppException.class).extracting("code").isEqualTo(HttpStatus.CONFLICT);
        offers.withdraw(offerId, 0);
        assertThat(pricing.quote(email, planId, request).baskets().get(0).missingItems()).isEqualTo(1);
        assertThatThrownBy(() -> offers.publish(offerId, input)).isInstanceOf(AppException.class)
                .extracting("code").isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void offerPublicationRejectsUnsupportedSourcesDatesAndConditions() throws Exception {
        Ingredient rice = ingredients.findByNameIgnoreCase("ryż").orElseGet(() -> ingredients.saveAndFlush(new Ingredient(null, "ryż", List.of())));
        assertThatThrownBy(() -> offers.publish(UUID.randomUUID(), offerInput(rice.getId(), "https://www.lidl.pl.attacker.example/test")))
                .isInstanceOf(AppException.class).extracting("code").isEqualTo(HttpStatus.BAD_REQUEST);
        var admin = new UsernamePasswordAuthenticationToken("staff@example.com", null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        String valid = json.writeValueAsString(offerInput(rice.getId(), "https://www.lidl.pl/p/test-fixture"));
        for (String invalid : List.of(valid.replace("\"nationwide\":true", "\"nationwide\":false"),
                valid.replace("\"minimumPackages\":1", "\"minimumPackages\":0"),
                valid.replace("\"conditionsVerified\":true", "\"conditionsVerified\":false"))) {
            mvc.perform(put("/admin/store-offers/" + UUID.randomUUID()).with(authentication(admin)).with(csrf())
                    .contentType(MediaType.APPLICATION_JSON).content(invalid)).andExpect(status().isBadRequest());
        }
    }

    private org.jakub.backendapi.dto.StoreOfferDto.Publish offerInput(Long ingredientId, String source) {
        return new org.jakub.backendapi.dto.StoreOfferDto.Publish(0, Store.LIDL, ingredientId, "Rice test fixture", new BigDecimal("400"), "g",
                new BigDecimal("3.99"), 1, 1, null, false, LocalDate.now(), LocalDate.now().plusDays(1), source,
                "Synthetic test data, not a real promotion", java.time.Instant.now().minusSeconds(1), true, true, true);
    }

    private Create settings() {
        return new Create(UUID.randomUUID(), LocalDate.now(), 1, 2, Set.of(MealType.LUNCH, MealType.DINNER),
                Set.of(Store.LIDL, Store.BIEDRONKA), new BigDecimal("300.00"), "pl", 45);
    }
}
