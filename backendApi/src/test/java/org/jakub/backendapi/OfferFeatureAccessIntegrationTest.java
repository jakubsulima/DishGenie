package org.jakub.backendapi;

import org.jakub.backendapi.dto.*;
import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.entities.*;
import org.jakub.backendapi.entities.Enums.*;
import org.jakub.backendapi.repositories.*;
import org.jakub.backendapi.services.*;
import org.jakub.backendapi.exceptions.AppException;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:offer-feature-it",
        "security.jwt.token.secret-key=offer-feature-test-secret-at-least-32-characters",
        "app.planner.jobs-enabled=false", "posthog.enabled=false", "spring.jpa.show-sql=false"})
@AutoConfigureMockMvc
class OfferFeatureAccessIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired OfferFeatureService feature;
    @Autowired OfferFeatureSettingRepository settings;
    @Autowired UserRepository users;
    @Autowired IngredientRepository ingredients;
    @Autowired StoreOfferService offers;
    @Autowired StoreOfferRepository catalog;
    @Autowired MealPlanService plans;
    @Autowired MealPlanPricingService pricing;
    @Autowired MealPlanItemPriceService manualPrices;
    @Autowired MealPlanCandidateService candidates;
    @Autowired MealPlanJobService jobs;
    @Autowired org.jakub.backendapi.config.UserAuthProvider tokens;
    String admin, member;
    LocalDate today = LocalDate.now(ZoneId.of("Europe/Warsaw"));
    @BeforeEach void setup() {
        settings.deleteAll(); catalog.deleteAll();
        admin = owner(Role.ADMIN); member = owner(Role.USER);
        feature.update(admin, new OfferFeatureService.Update(0, true));
    }
    String owner(Role role) {
        var user = new User(); user.setEmail(UUID.randomUUID()+"@example.test"); user.setRole(role);
        return users.saveAndFlush(user).getEmail();
    }
    void disable() { feature.update(admin, new OfferFeatureService.Update(feature.get().version(), false)); }
    Create create(PlanningMode mode) {
        return new Create(UUID.randomUUID(), today, 1, 2, Set.of(MealType.DINNER), Set.of(Store.LIDL), null, "pl", 45,
                mode, BudgetMode.NONE, new ShoppingOptions(today, 1, Set.of(), Set.of(), Set.of(), false));
    }
    @Test void usersCannotChangeTheFlagAndAdminWritesRequireCsrfAndTheCurrentVersion() throws Exception {
        String body = "{\"version\":"+feature.get().version()+",\"enabledForUsers\":false}";
        mvc.perform(put("/admin/features/store-offers").with(user(member).roles("USER")).with(csrf()).contentType("application/json").content(body)).andExpect(status().isForbidden());
        mvc.perform(put("/admin/features/store-offers").with(user(admin).roles("ADMIN")).contentType("application/json").content(body)).andExpect(status().isForbidden());
        mvc.perform(put("/admin/features/store-offers").with(user(admin).roles("ADMIN")).with(csrf()).contentType("application/json").content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.enabledForUsers").value(false));
        mvc.perform(put("/admin/features/store-offers").with(user(admin).roles("ADMIN")).with(csrf()).contentType("application/json").content(body)).andExpect(status().isConflict());
        assertThat(feature.get().updatedBy()).isEqualTo(admin);
        assertThat(new OfferFeatureService(settings, users).available(member)).isFalse();
        assertThat(new OfferFeatureService(settings, users).available(admin)).isTrue();
    }
    @Test void disabledAccessBlocksDirectCatalogAndRefreshRequestsButAdminsCanStillTest() throws Exception {
        disable();
        mvc.perform(get("/v2/offers/access").with(user(member))).andExpect(status().isOk()).andExpect(jsonPath("$.available").value(false));
        mvc.perform(get("/v2/offers").param("stores","LIDL").param("shoppingDate",today.toString()).with(user(member))).andExpect(status().isForbidden());
        mvc.perform(post("/v2/offers/reload-prices").with(user(member)).with(csrf())).andExpect(status().isForbidden());
        mvc.perform(get("/v2/offers/access").with(user(admin).roles("ADMIN"))).andExpect(status().isOk()).andExpect(jsonPath("$.available").value(true));
        mvc.perform(get("/v2/offers").param("stores","LIDL").param("shoppingDate",today.toString()).with(user(admin).roles("ADMIN"))).andExpect(status().isOk());
        mvc.perform(post("/v2/offers/reload-prices").with(user(admin).roles("ADMIN")).with(csrf())).andExpect(status().isOk());
    }
    @Test void actualJwtCookiesResolveTheAdminEmailForAccessAndSettingChanges() throws Exception {
        disable();
        var adminCookie = new jakarta.servlet.http.Cookie("access_token", tokens.createToken(admin));
        var userCookie = new jakarta.servlet.http.Cookie("access_token", tokens.createToken(member));
        mvc.perform(get("/v2/offers/access").cookie(userCookie)).andExpect(status().isOk()).andExpect(jsonPath("$.available").value(false));
        mvc.perform(get("/v2/offers/access").cookie(adminCookie)).andExpect(status().isOk()).andExpect(jsonPath("$.available").value(true));
        mvc.perform(get("/v2/offers").param("stores","LIDL").param("shoppingDate",today.toString()).cookie(adminCookie)).andExpect(status().isOk());
        String body = "{\"version\":"+feature.get().version()+",\"enabledForUsers\":true}";
        mvc.perform(put("/admin/features/store-offers").cookie(adminCookie).with(csrf()).contentType("application/json").content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.updatedBy").value(admin));
    }
    @Test void cachedOffersCannotEnterUserPlansOrQuotesButPrivatePricesAndPracticalPlanningRemainAvailable() {
        var ingredient = ingredients.findByNameIgnoreCase("ryż").orElseGet(() -> ingredients.saveAndFlush(new Ingredient(null,"ryż",List.of())));
        var id = UUID.randomUUID();
        offers.publish(id, new StoreOfferDto.Publish(0,Store.LIDL,ingredient.getId(),"Ryż",new BigDecimal("500"),"g",new BigDecimal("4.00"),1,1,null,false,today,today,"https://www.lidl.pl/p/test","Test",Instant.now(),true,true,true));
        var row = catalog.findById(id).orElseThrow(); row.setSourceType(LidlCatalogStore.SOURCE_TYPE); row.setIngredientKey("rice"); catalog.saveAndFlush(row);
        var plan = plans.create(member, create(PlanningMode.PRACTICAL)); var slot = plan.plan().slots().get(0); var request = UUID.randomUUID();
        var work = plans.beginGeneration(member,plan.id(),slot.id(),new Generate(plan.version(),request));
        var recipe = new RecipeDto(null,"Ryż",List.of(new RecipeIngredientDto("ryż",500,"g")),List.of("Ugotuj ryż."),"Test","10 min",2); recipe.setLocale(ContentLocale.pl);
        plan = plans.finishGeneration(member,plan.id(),slot.id(),request,work.view().version(),recipe);
        assertThat(pricing.preview(member,plan.id(),new StoreOfferDto.QuoteRequest(plan.version(),today,Set.of())).baskets().get(0).knownTotal()).isEqualByComparingTo("4.00");
        disable();
        assertThat(candidates.deals(member,plan.plan().settings())).isEmpty();
        assertThat(offers.eligibleForUser(member,Set.of(Store.LIDL),today,Instant.now())).isEmpty();
        assertThat(offers.eligibleForUser(admin,Set.of(Store.LIDL),today,Instant.now())).hasSize(1);
        var disabledQuote = pricing.preview(member,plan.id(),new StoreOfferDto.QuoteRequest(plan.version(),today,Set.of()));
        assertThat(disabledQuote.baskets().get(0).pricedItems()).isZero();
        assertThat(disabledQuote.sources().get(0).status()).isEqualTo("FEATURE_DISABLED");
        String key = plans.previewShopping(member,plan.id(),plan.plan().slots()).items().get(0).key();
        plan = manualPrices.save(member,plan.id(),new StoreOfferDto.PriceInput(plan.version(),key,Store.LIDL,today,new BigDecimal("500"),new BigDecimal("3.25")));
        assertThat(pricing.preview(member,plan.id(),new StoreOfferDto.QuoteRequest(plan.version(),today,Set.of())).baskets().get(0).knownTotal()).isEqualByComparingTo("3.25");
        var ownedPlan = plan;
        assertThatThrownBy(() -> jobs.replanFromOffers(member,ownedPlan.id(),new Generate(ownedPlan.version(),UUID.randomUUID())))
                .isInstanceOf(AppException.class).satisfies(e -> assertThat(((AppException)e).getCode()).isEqualTo(org.springframework.http.HttpStatus.FORBIDDEN));
        assertThat(plans.create(member, create(PlanningMode.PRACTICAL))).isNotNull();
        assertThatThrownBy(() -> plans.create(member, create(PlanningMode.PROMOTIONS_FIRST))).isInstanceOf(AppException.class);
        feature.update(admin,new OfferFeatureService.Update(feature.get().version(),true));
        assertThat(candidates.deals(member,plan.plan().settings())).isNotEmpty();
    }
}
