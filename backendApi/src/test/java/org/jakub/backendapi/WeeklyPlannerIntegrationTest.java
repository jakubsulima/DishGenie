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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.http.MediaType;
import tools.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@SpringBootTest(properties = {"security.jwt.token.secret-key=weekly-plan-test-secret-key-at-least-32-characters", "posthog.enabled=false", "spring.jpa.show-sql=false", "app.planner.jobs-enabled=false"})
@AutoConfigureMockMvc
class WeeklyPlannerIntegrationTest {
    @Autowired MealPlanShoppingIssueService shoppingIssues;
    @Autowired MealPlanService plans;
    @Autowired MealPlanGenerationService generation;
    @Autowired MealPlanJobService jobs;
    @Autowired MealPlanGenerationRepository jobRepository;
    @Autowired MealPlanRevisionService revisions;
    @Autowired MealPlanRevisionStore revisionStore;
    @Autowired ShoppingPreferencesService preferences;
    @Autowired MealPlanPricingService pricing;
    @Autowired OfferImportService imports;
    @Autowired RecipeGenerationQuotaService quota;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired RecipeService recipes;
    @Autowired RecipeRepository recipeRepository;
    @Autowired IngredientRepository ingredients;
    @Autowired IngredientAliasRepository aliases;
    @Autowired IngredientNormalizationService normalization;
    @Autowired StoreOfferService storeOffers;
    @Autowired ShoppingListService manualShopping;
    @Autowired FridgeIngredientRepository fridge;
    @Autowired MealPlanItemPriceService itemPrices;
    @Autowired StoreOfferRepository offerRepository;
    @Autowired ObjectMapper json;
    @Autowired MockMvc mvc;
    @MockitoBean GeminiService gemini;
    String email;
    User owner;
    @BeforeEach void setup() {
        // Store offers are global, unlike the per-test user; keep each planner scenario's catalog isolated.
        offerRepository.deleteAll();
        email = UUID.randomUUID() + "@example.com"; owner = new User(); owner.setEmail(email); owner.setRole(Role.USER); owner = users.saveAndFlush(owner);
        AtomicInteger count = new AtomicInteger();
        when(gemini.generateRecipes(any(RecipeGenerationRequestDto.class), any())).thenAnswer(call -> json.writeValueAsString(recipe("Danie " + count.incrementAndGet(), 100)));
    }
    @Test void savedPlanHistoryOrdersEqualCreationTimesDeterministically() {
        var first = plans.create(email, settings(1));
        var second = plans.create(email, settings(1));
        var timestamp = java.sql.Timestamp.from(Instant.parse("2026-11-06T12:00:00Z"));
        jdbc.update("update meal_plan set created_at = ? where id = ?", timestamp, first.id());
        jdbc.update("update meal_plan set created_at = ? where id = ?", timestamp, second.id());
        var expected = java.util.stream.Stream.of(first.id(), second.id())
                .sorted(Comparator.comparing(UUID::toString).reversed()).toList();
        assertThat(plans.list(email)).extracting(Summary::id).containsExactlyElementsOf(expected);
    }

    @Test void savedPlanHistoryCanReachTheCurrentWeekBeyondTheFirstTwenty() throws Exception {
        var current = plans.create(email, settings(1));
        jdbc.update("update meal_plan set created_at = ? where id = ?",
                java.sql.Timestamp.from(Instant.now().minusSeconds(60)), current.id());
        for (int index = 0; index < 20; index++) plans.create(email, settings(1));
        assertThat(plans.list(email)).hasSize(20).noneMatch(summary -> summary.id().equals(current.id()));
        assertThat(plans.list(email, 1)).extracting(Summary::id).containsExactly(current.id());
        mvc.perform(get("/v3/meal-plans?page=1").with(authentication(auth())))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(current.id().toString()));
        mvc.perform(get("/v3/meal-plans?page=-1").with(authentication(auth())))
                .andExpect(status().isBadRequest());
    }

    @Test void optionalBudgetDraftPricingPreferencesAndV2Protection() throws Exception {
        var plan = plans.create(email, settings(2));
        assertThat(plan.plan().settings().budget()).isNull();
        assertThat(preferences.get(email).shopping().maxStores()).isEqualTo(1);
        var quote = pricing.preview(email, plan.id(), new StoreOfferDto.QuoteRequest(plan.version(), LocalDate.now(), Set.of()));
        assertThat(quote.budget()).isNull(); assertThat(quote.baskets()).hasSize(2);
        var auth = auth();
        mvc.perform(get("/v2/meal-plans/" + plan.id()).with(authentication(auth))).andExpect(status().isConflict());
        mvc.perform(get("/v3/meal-plans/" + plan.id()).with(authentication(auth))).andExpect(status().isOk()).andExpect(jsonPath("$.plan.settings.budget").isEmpty());
        mvc.perform(post("/v3/meal-plans").with(authentication(auth)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(settings(1))))
                .andExpect(status().isOk());
        mvc.perform(get("/v3/meal-plans/" + plan.id()).with(authentication(new UsernamePasswordAuthenticationToken("someone-else", null, List.of(new SimpleGrantedAuthority("ROLE_USER"))))))
                .andExpect(status().isNotFound());
    }
    @Test void newPlannerUsesPolishContentRegardlessOfTheInterfaceLocale() throws Exception {
        var base = settings(1);
        var input = new Create(base.requestId(), base.startDate(), base.dayCount(), base.servings(), base.mealTypes(), base.stores(),
                base.budget(), "en", base.maxMinutes(), base.planningMode(), base.budgetMode(), base.shopping());
        var response = mvc.perform(post("/v3/meal-plans").with(authentication(auth())).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(input))).andExpect(status().isOk()).andExpect(jsonPath("$.plan.settings.locale").value("pl"))
                .andReturn().getResponse().getContentAsString();
        var plan = json.readValue(response, View.class);
        var rice = ingredient("ryż");
        storeOffers.publish(UUID.randomUUID(), new StoreOfferDto.Publish(0, Store.LIDL, rice.getId(), "Ryż — kontrolowane dane testowe", new java.math.BigDecimal("400"), "g", new java.math.BigDecimal("3.99"),
                1, 1, null, false, LocalDate.now(), LocalDate.now().plusDays(1), "https://www.lidl.pl/p/test-rice-language", "Kontrolowane dane testowe", Instant.now(), true, true, true));
        var slotId = plan.plan().slots().get(0).id();
        plan = generation.generate(email, plan.id(), slotId, new Generate(plan.version(), UUID.randomUUID()));
        var preview = revisions.preview(email, plan.id(), slotId, new RevisionRequest(plan.version(), UUID.randomUUID(),
                RevisionIntent.SIMPLIFY, "Uprość danie", null, null, null, null, null));
        assertThat(plan.plan().slots().get(0).recipe().getLocale()).isEqualTo(ContentLocale.pl);
        assertThat(preview.after().getLocale()).isEqualTo(ContentLocale.pl);
        var requests = org.mockito.ArgumentCaptor.forClass(RecipeGenerationRequestDto.class);
        verify(gemini, times(2)).generateRecipes(requests.capture(), any());
        assertThat(requests.getAllValues()).extracting(RecipeGenerationRequestDto::getLocale).containsExactly("pl", "pl");
    }
    @Test void durableQueueSurvivesReentryAndStopsOnConflictingEdit() {
        var plan = plans.create(email, settings(2));
        var input = new Generate(plan.version(), UUID.randomUUID());
        var progress = jobs.start(email, plan.id(), input);
        assertThat(jobs.start(email, plan.id(), input).id()).isEqualTo(progress.id());
        var worker = new MealPlanJobWorker(jobs, jobRepository, plans, generation);
        worker.execute(jobs.claim(progress.id()));
        assertThat(jobs.latest(email, plan.id()).completed()).isEqualTo(1);
        var current = plans.get(email, plan.id());
        plans.change(email, current.id(), current.plan().slots().get(0).id(), new Change(current.version(), Action.LOCK, null));
        worker.execute(jobs.claim(progress.id()));
        assertThat(jobs.latest(email, plan.id()).status()).isEqualTo("FAILED");
        verify(gemini, times(1)).generateRecipes(any(RecipeGenerationRequestDto.class), any());
        assertThatThrownBy(() -> jobs.latest("other", plan.id())).isInstanceOf(AppException.class);
    }
    @Test void settingsRemainEditableAfterTheWeekStartsWithoutChangingHistoricalShoppingDates() {
        var plan = plans.create(email, settings(7));
        var before = plan.plan().settings();
        LocalDate yesterday = LocalDate.now(ZoneId.of("Europe/Warsaw")).minusDays(1);
        var shopping = new ShoppingOptions(yesterday, 1, Set.of(), Set.of(), Set.of(), false);
        var historical = new Create(before.requestId(), yesterday, before.dayCount(), before.servings(), before.mealTypes(),
                before.stores(), null, before.locale(), before.maxMinutes(), PlanningMode.DEALS, BudgetMode.NONE, shopping);
        var slots = plan.plan().slots().stream().map(s -> new Slot(s.id(), s.date().minusDays(1), s.mealType(), s.servings(),
                s.locked(), s.skipped(), s.recipe(), s.generationId(), s.generationStatus(), s.generationStartedAt())).toList();
        jdbc.update("update meal_plan set document = ? where id = ?", json.writeValueAsString(new Document(2, historical, Status.DRAFT, slots, null)), plan.id());
        var updatedSettings = new Create(before.requestId(), yesterday, before.dayCount(), before.servings(), before.mealTypes(),
                before.stores(), new java.math.BigDecimal("100.00"), before.locale(), before.maxMinutes(), PlanningMode.DEALS, BudgetMode.SOFT, shopping);
        var updated = plans.settings(email, plan.id(), new SettingsChange(plan.version(), updatedSettings));
        assertThat(updated.plan().settings().budget()).isEqualByComparingTo("100.00");
        assertThat(updated.plan().settings().shopping().shoppingDate()).isEqualTo(yesterday);
        var invalid = new Create(before.requestId(), yesterday, before.dayCount(), before.servings(), before.mealTypes(),
                before.stores(), null, before.locale(), before.maxMinutes(), PlanningMode.DEALS, BudgetMode.NONE,
                new ShoppingOptions(yesterday.minusDays(1), 1, Set.of(), Set.of(), Set.of(), false));
        assertThatThrownBy(() -> plans.settings(email, updated.id(), new SettingsChange(updated.version(), invalid)))
                .isInstanceOf(AppException.class).extracting("code").isEqualTo(org.springframework.http.HttpStatus.BAD_REQUEST);
    }
    @Test void committedResultIsRecoveredWithoutCallingAiTwice() {
        var plan = plans.create(email, settings(1)); var progress = jobs.start(email, plan.id(), new Generate(plan.version(), UUID.randomUUID()));
        var work = jobs.claim(progress.id()); var request = UUID.randomUUID(); jobs.request(work, request, plan.version());
        generation.generate(email, plan.id(), plan.plan().slots().get(0).id(), new Generate(plan.version(), request));
        var entity = jobRepository.findById(progress.id()).orElseThrow(); entity.setLeaseUntil(Instant.now().minusSeconds(1)); jobRepository.saveAndFlush(entity);
        var recovered = jobs.claim(progress.id()); new MealPlanJobWorker(jobs, jobRepository, plans, generation).execute(recovered);
        assertThat(jobs.latest(email, plan.id()).status()).isEqualTo("COMPLETED");
        verify(gemini, times(1)).generateRecipes(any(RecipeGenerationRequestDto.class), any());
    }
    @Test void crashAfterQuotaReservationResumesWithoutChargingTwice() {
        var plan = plans.create(email, settings(1)); var job = jobs.start(email, plan.id(), new Generate(plan.version(), UUID.randomUUID()));
        var work = jobs.claim(job.id()); var slot = plan.plan().slots().get(0); UUID request = UUID.randomUUID(); jobs.request(work, request, plan.version());
        quota.reserve(email, MealPlanJobWorker.operationId(job.id(), slot.id()));
        plans.beginGeneration(email, plan.id(), slot.id(), new Generate(plan.version(), request));
        var stale = new Slot(slot.id(), slot.date(), slot.mealType(), slot.servings(), false, false, null, request, GenerationStatus.RUNNING, Instant.now().minusSeconds(700));
        var document = new Document(2, plan.plan().settings(), Status.DRAFT, List.of(stale), null);
        jdbc.update("update meal_plan set document = ? where id = ?", json.writeValueAsString(document), plan.id());
        var entity = jobRepository.findById(job.id()).orElseThrow(); entity.setLeaseUntil(Instant.now().minusSeconds(1)); jobRepository.saveAndFlush(entity);
        new MealPlanJobWorker(jobs, jobRepository, plans, generation).execute(jobs.claim(job.id()));
        assertThat(jobs.latest(email, plan.id()).status()).isEqualTo("COMPLETED");
        assertThat(users.findByEmail(email).orElseThrow().getDailyRecipeCount()).isEqualTo(1);
        verify(gemini, times(1)).generateRecipes(any(RecipeGenerationRequestDto.class), any());
    }
    @Test void fullSevenDayWeekProducesFourteenDistinctMealsAndOneSharedBasket() {
        var base = settings(7);
        var input = new Create(base.requestId(), base.startDate(), 7, 2, Set.of(MealType.LUNCH, MealType.DINNER), base.stores(), null, "pl", 45, base.planningMode(), base.budgetMode(), base.shopping());
        var plan = plans.create(email, input); var job = jobs.start(email, plan.id(), new Generate(plan.version(), UUID.randomUUID()));
        var worker = new MealPlanJobWorker(jobs, jobRepository, plans, generation);
        for (int i = 0; i < 14; i++) worker.execute(jobs.claim(job.id()));
        var result = plans.get(email, plan.id());
        assertThat(result.plan().slots()).hasSize(14).allMatch(s -> s.recipe() != null);
        assertThat(result.plan().slots().stream().map(s -> s.recipe().getName()).distinct()).hasSize(14);
        assertThat(jobs.latest(email, plan.id()).status()).isEqualTo("COMPLETED");
        var accepted = plans.accept(email, plan.id(), new Version(result.version()));
        assertThat(accepted.plan().shopping().items()).hasSize(1);
        assertThat(accepted.plan().shopping().items().get(0).amount()).isEqualTo(1400d);
    }
    @Test void cancellationKeepsCompletedSlotsAndDoesNotStartNextMeal() {
        var plan = plans.create(email, settings(2)); var progress = jobs.start(email, plan.id(), new Generate(plan.version(), UUID.randomUUID()));
        jobs.cancel(email, plan.id(), progress.id()); assertThat(jobs.claim(progress.id())).isNull();
        verifyNoInteractions(gemini);
    }
    @Test void manualRevisionPreviewApplyRetryUndoAndShoppingAreIsolated() {
        var plan = generated(2); var first = plan.plan().slots().get(0); var second = plan.plan().slots().get(1);
        plan = plans.accept(email, plan.id(), new Version(plan.version()));
        String key = plan.plan().shopping().items().get(0).key(); plan = plans.checkShopping(email, plan.id(), new Check(plan.version(), key, true));
        var unchanged = preview(plan, first.id(), recipe("Poprawiona nazwa", 100));
        var result = revisionStore.apply(email, plan.id(), first.id(), new ApplyRevision(plan.version(), unchanged.id()));
        assertThat(result.plan().shopping().checkedKeys()).contains(key);
        assertThat(result.plan().slots().get(1).recipe()).isEqualTo(second.recipe());
        assertThat(revisionStore.apply(email, result.id(), first.id(), new ApplyRevision(plan.version(), unchanged.id())).version()).isEqualTo(result.version());
        var changed = preview(result, first.id(), recipe("Więcej ryżu", 200));
        var changedPlan = revisionStore.apply(email, result.id(), first.id(), new ApplyRevision(result.version(), changed.id()));
        assertThat(changedPlan.plan().shopping().checkedKeys()).doesNotContain(key);
        var undo = revisions.undo(email, result.id(), first.id(), new ApplyRevision(changedPlan.version(), changed.id()));
        assertThat(undo.after().getName()).isEqualTo("Poprawiona nazwa");
        var undone = revisionStore.apply(email, result.id(), first.id(), new ApplyRevision(changedPlan.version(), undo.id()));
        assertThat(undone.plan().slots().get(1).recipe()).isEqualTo(second.recipe()); verify(gemini, times(2)).generateRecipes(any(RecipeGenerationRequestDto.class), any());
    }
    @Test void repeatedShoppingSyncAfterRevisionPreservesTheSameVersion() {
        var plan = generated(1); plan = plans.accept(email, plan.id(), new Version(plan.version()));
        var request = new Generate(plan.version(), UUID.randomUUID());
        var synced = plans.syncShopping(email, plan.id(), request);
        assertThat(plans.syncShopping(email, plan.id(), request).version()).isEqualTo(synced.version());
    }
    @Test void outdatedPreviewAndForeignPreviewCannotChangeThePlan() {
        var plan = generated(1); UUID slot = plan.plan().slots().get(0).id(); var preview = preview(plan, slot, recipe("Korekta", 100));
        var changed = plans.change(email, plan.id(), slot, new Change(plan.version(), Action.SERVINGS, 3));
        assertThatThrownBy(() -> revisionStore.apply(email, plan.id(), slot, new ApplyRevision(plan.version(), preview.id()))).isInstanceOf(AppException.class);
        assertThatThrownBy(() -> revisionStore.apply("other", plan.id(), slot, new ApplyRevision(changed.version(), preview.id()))).isInstanceOf(AppException.class);
    }
    @Test void libraryIsUsedBeforeAiAndForeignPrivateRecipesStayPrivate() {
        var own = recipe("Własny przepis " + UUID.randomUUID(), 100); recipes.saveRecipe(own, email);
        var plan = generated(1); assertThat(plan.plan().slots().get(0).recipe().getName()).isEqualTo(own.getName()); verifyNoInteractions(gemini);
        var other = new User(); other.setEmail("other-" + email); other.setRole(Role.USER); users.saveAndFlush(other);
        var foreign = recipe("Cudzy prywatny " + UUID.randomUUID(), 100); recipes.saveRecipe(foreign, other.getEmail());
        var initial = plans.create(other.getEmail(), settings(1));
        var result = generation.generate(other.getEmail(), initial.id(), initial.plan().slots().get(0).id(), new Generate(initial.version(), UUID.randomUUID()));
        assertThat(result.plan().slots().get(0).recipe().getName()).isEqualTo(foreign.getName());
        assertThat(recipeRepository.findByName(own.getName()).orElseThrow().getName()).isEqualTo(own.getName());
    }
    @Test void plannerReusesTheLibraryAndRefreshesFridgeAmountsWithoutChangingManualShoppingOrTheOriginalRecipe() {
        var source = recipe("Zapisany ryż " + UUID.randomUUID(), 300);
        recipes.saveRecipe(source, email);
        var stock = new FridgeIngredient(null, "ryż", null, 100d, Unit.GRAMS, owner);
        stock.setQuantityAccuracy(QuantityAccuracy.EXACT); stock = fridge.saveAndFlush(stock);
        var manual = manualShopping.replaceShoppingList(email, List.of(new ShoppingListItemDto(
                "manual", "Kawa", 2d, "pcs", true, "2026-11-10T12:00:00.123456789Z")));
        var plan = generated(1);
        assertThat(plan.plan().slots().get(0).recipe().getName()).isEqualTo(source.getName());
        verifyNoInteractions(gemini);
        plan = plans.accept(email, plan.id(), new Version(plan.version()));
        assertThat(plan.plan().shopping().items().get(0).amount()).isEqualTo(200d);
        var slotId = plan.plan().slots().get(0).id();
        var correction = preview(plan, slotId, recipe("Większe danie", 500));
        plan = revisionStore.apply(email, plan.id(), slotId, new ApplyRevision(plan.version(), correction.id()));
        assertThat(plan.plan().shopping().items().get(0).amount()).isEqualTo(400d);
        stock.setAmount(350d); fridge.saveAndFlush(stock);
        plan = plans.syncShopping(email, plan.id(), new Generate(plan.version(), UUID.randomUUID()));
        assertThat(plan.plan().shopping().items().get(0).amount()).isEqualTo(150d);
        assertThat(fridge.findById(stock.getId()).orElseThrow().getAmount()).isEqualTo(350d);
        assertThat(manualShopping.getShoppingList(email)).containsExactlyElementsOf(manual);
        assertThat(recipes.getRecipeByName(source.getName(), email).getIngredients().get(0).getAmount()).isEqualTo(300d);
    }
    @Test void aPrivatePriceFillsAnUnpricedPlanAndIsScopedToOwnerPlanDateStoreAndQuantity() throws Exception {
        var plan = generated(1); var id = plan.id();
        var item = plans.previewShopping(email, id, plan.plan().slots()).items().get(0);
        var input = new StoreOfferDto.PriceInput(plan.version(), item.key(), Store.LIDL, LocalDate.now(),
                new java.math.BigDecimal("400"), new java.math.BigDecimal("4.25"));
        long offerCount = offerRepository.count();
        mvc.perform(post("/v3/meal-plans/" + id + "/prices").with(authentication(auth())).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(input))).andExpect(status().isForbidden());
        var priced = itemPrices.save(email, id, input);
        assertThat(priced.version()).isGreaterThan(plan.version());
        var quote = pricing.preview(email, id, new StoreOfferDto.QuoteRequest(priced.version(), LocalDate.now(), Set.of()));
        var ownRow = quote.baskets().stream().filter(b -> b.option().equals("LIDL")).findFirst().orElseThrow().items().get(0);
        assertThat(ownRow.manualPrice()).isNotNull(); assertThat(ownRow.cost()).isEqualByComparingTo("4.25");
        assertThat(ownRow.packages()).isEqualByComparingTo("1"); assertThat(ownRow.leftoverAmount()).isEqualByComparingTo("300");
        assertThat(offerRepository.count()).isEqualTo(offerCount);
        assertThat(itemPrices.prices(email, id, LocalDate.now().plusDays(1), Set.of(Store.LIDL))).isEmpty();
        assertThat(itemPrices.prices(email, id, LocalDate.now(), Set.of(Store.BIEDRONKA))).isEmpty();
        assertThatThrownBy(() -> itemPrices.prices("other", id, LocalDate.now(), Set.of(Store.LIDL))).isInstanceOf(AppException.class);
        var otherPlan = generated(1);
        assertThat(itemPrices.prices(email, otherPlan.id(), LocalDate.now(), Set.of(Store.LIDL))).isEmpty();
        assertThatThrownBy(() -> itemPrices.save(email, id, input)).isInstanceOf(AppException.class);
        var changed = plans.change(email, id, priced.plan().slots().get(0).id(), new Change(priced.version(), Action.SERVINGS, 4));
        var changedQuote = pricing.preview(email, id, new StoreOfferDto.QuoteRequest(changed.version(), LocalDate.now(), Set.of()));
        assertThat(changedQuote.baskets().stream().flatMap(b -> b.items().stream())).noneMatch(i -> i.manualPrice() != null);
        var removed = itemPrices.remove(email, id, ownRow.manualPrice().id(), changed.version());
        assertThat(removed.version()).isGreaterThan(changed.version());
        assertThat(itemPrices.prices(email, id, LocalDate.now(), Set.of(Store.LIDL))).isEmpty();
    }
    @Test void ongoingPlanCanUseTodaysPrivatePriceWithoutChangingHistoryOrAcceptingThePlan() {
        var plan = generated(1); var before = plan.plan(); var settings = before.settings();
        LocalDate today = LocalDate.now(ZoneId.of("Europe/Warsaw")), yesterday = today.minusDays(1);
        var historical = new Create(settings.requestId(), yesterday, settings.dayCount(), settings.servings(), settings.mealTypes(),
                settings.stores(), settings.budget(), settings.locale(), settings.maxMinutes(), settings.planningMode(), settings.budgetMode(),
                new ShoppingOptions(yesterday, 1, Set.of(), Set.of(), Set.of(), false));
        var slots = before.slots().stream().map(s -> new Slot(s.id(), yesterday, s.mealType(), s.servings(), s.locked(), s.skipped(),
                s.recipe(), s.generationId(), s.generationStatus(), s.generationStartedAt())).toList();
        jdbc.update("update meal_plan set document = ? where id = ?", json.writeValueAsString(new Document(2, historical, before.status(), slots, null)), plan.id());
        var item = plans.previewShopping(email, plan.id(), slots).items().get(0);
        var priced = itemPrices.save(email, plan.id(), new StoreOfferDto.PriceInput(plan.version(), item.key(), Store.LIDL, today,
                new java.math.BigDecimal("400"), new java.math.BigDecimal("4.25")));
        var quote = pricing.preview(email, plan.id(), new StoreOfferDto.QuoteRequest(priced.version(), today, Set.of()));
        assertThat(quote.baskets().get(0).pricedItems()).isEqualTo(1);
        assertThat(quote.baskets().get(0).knownTotal()).isEqualByComparingTo("4.25");
        assertThat(priced.plan().status()).isEqualTo(before.status());
        assertThat(priced.plan().settings().shopping().shoppingDate()).isEqualTo(yesterday);
        assertThat(priced.plan().slots()).isEqualTo(slots);
        assertThat(priced.plan().shopping()).isNull();
    }
    @Test void importIsIdempotentIncompleteBatchCannotPublishAndFailedReviewDoesNotVerify() {
        var candidate = new OfferImportDto.Candidate("source-123", "https://www.lidl.pl/p/test", "Controlled source evidence");
        var input = new OfferImportDto.Input("fixture-v1", UUID.randomUUID().toString(), Store.LIDL, Instant.now().minusSeconds(1), null, false, 2, List.of(candidate));
        var batch = imports.ingest(input); assertThat(imports.ingest(input)).isEqualTo(batch);
        assertThat(batch.batch().status()).isEqualTo("INCOMPLETE");
        assertThatThrownBy(() -> imports.review(batch.batch().id(), new OfferImportDto.Review(0, 0, false, null, null))).isInstanceOf(AppException.class);
        assertThat(imports.recent().get(0).batch().rows().get(0).published()).isNull();
    }
    @Test void aShoppingReportIsPrivateIdempotentAndDoesNotChangePricesOrThePlan() {
        var plan = generated(1); plan = plans.accept(email, plan.id(), new Version(plan.version()));
        var key = plan.plan().shopping().items().get(0).key();
        var input = new MealPlanShoppingIssueService.Input(UUID.randomUUID(), plan.version(), key, MealPlanShoppingIssueService.Reason.PRICE_DIFFERENT, null);
        var issue = shoppingIssues.report(email, plan.id(), input);
        assertThat(shoppingIssues.report(email, plan.id(), input).id()).isEqualTo(issue.id());
        assertThat(shoppingIssues.list(email, plan.id())).hasSize(1);
        assertThat(plans.get(email, plan.id()).version()).isEqualTo(plan.version());
        UUID id = plan.id();
        assertThatThrownBy(() -> shoppingIssues.list("other", id)).isInstanceOf(AppException.class);
    }
    @Test void completeReviewedBatchPublishesAnExactBundleWithoutInventedUnitPrice() {
        var ingredient = ingredients.findByNameIgnoreCase("ryż").orElseGet(() -> ingredients.saveAndFlush(new Ingredient(null, "ryż", List.of())));
        var source = new OfferImportDto.Candidate("bundle-test", "https://www.lidl.pl/p/test-bundle", "Two packs for 7.99; synthetic test evidence");
        var batch = imports.ingest(new OfferImportDto.Input("fixture-v1", UUID.randomUUID().toString(), Store.LIDL, Instant.now().minusSeconds(1), null, true, 1, List.of(source)));
        var offer = new StoreOfferDto.Publish(0, Store.LIDL, ingredient.getId(), "Kontrolowany zestaw ryżu", new java.math.BigDecimal("500"), "g", null, 2, 2, null, false,
                LocalDate.now(), LocalDate.now().plusDays(1), source.sourceUrl(), "Dwa opakowania za 7,99; dane testowe", Instant.now().minusSeconds(1), true, true, true,
                false, new java.math.BigDecimal("7.99"), 2, null, "DRY", false, null, null);
        var reviewed = imports.review(batch.batch().id(), new OfferImportDto.Review(batch.version(), 0, false, "Controlled verification", offer));
        assertThat(reviewed.batch().rows().get(0).published().details().packagePrice()).isNull();
        assertThat(reviewed.batch().rows().get(0).published().details().bundlePrice()).isEqualByComparingTo("7.99");
        assertThat(reviewed.batch().status()).isEqualTo("REVIEWED");
    }
    @Test void aiRevisionUpdatesInstructionsAndChargesOnlyOnceOnRetry() {
        var plan = generated(1); var slot = plan.plan().slots().get(0);
        var input = new RevisionRequest(plan.version(), UUID.randomUUID(), RevisionIntent.SIMPLIFY, "Mniej kroków", null, null, null, null, null);
        var preview = revisions.preview(email, plan.id(), slot.id(), input);
        assertThat(revisions.preview(email, plan.id(), slot.id(), input).id()).isEqualTo(preview.id());
        assertThat(plans.get(email, plan.id()).plan().slots().get(0).recipe()).isEqualTo(slot.recipe());
        verify(gemini, times(2)).generateRecipes(any(RecipeGenerationRequestDto.class), any());
    }
    @Test void historicalEnglishRecipeCanBeTranslatedPreviewedAppliedAndUndoneWithoutChangingQuantities() {
        var base = settings(1);
        var englishSettings = new Create(base.requestId(), base.startDate(), base.dayCount(), base.servings(), base.mealTypes(), base.stores(),
                base.budget(), "en", base.maxMinutes(), base.planningMode(), base.budgetMode(), base.shopping());
        var english = recipe("Sichuan style rice", 100);
        english.setLocale(ContentLocale.en); english.setDescription("Rice with Sichuan seasoning.");
        english.setIngredients(List.of(new RecipeIngredientDto("rice", 100, "g"))); english.setInstructions(List.of("Boil rice."));
        english.setNutrition(new RecipeNutritionDto(200d, 4d, 40d, 2d));
        when(gemini.generateRecipes(any(RecipeGenerationRequestDto.class), any())).thenReturn(json.writeValueAsString(english));
        var plan = plans.create(email, englishSettings); var slotId = plan.plan().slots().get(0).id();
        plan = generation.generate(email, plan.id(), slotId, new Generate(plan.version(), UUID.randomUUID()));
        plan = plans.revise(email, plan.id(), slotId, plan.version(), english);
        var polish = recipe("Ryż po syczuańsku", 100); polish.setDescription("Ryż z przyprawami kuchni syczuańskiej."); polish.setTimeToPrepare("20 minut");
        when(gemini.generateRecipes(any(RecipeGenerationRequestDto.class), any())).thenReturn(json.writeValueAsString(polish));
        var preview = revisions.preview(email, plan.id(), slotId, new RevisionRequest(plan.version(), UUID.randomUUID(),
                RevisionIntent.TRANSLATE_PL, null, null, null, null, null, null));
        assertThat(plans.get(email, plan.id()).plan().slots().get(0).recipe().getName()).isEqualTo(english.getName());
        assertThat(preview.after().getLocale()).isEqualTo(ContentLocale.pl);
        assertThat(preview.after().getNutrition()).isEqualTo(english.getNutrition());
        assertThat(preview.after().getIngredients().get(0).getAmount()).isEqualTo(100);
        var applied = revisionStore.apply(email, plan.id(), slotId, new ApplyRevision(plan.version(), preview.id()));
        assertThat(applied.plan().settings().locale()).isEqualTo("pl");
        assertThat(applied.plan().slots().get(0).recipe().getName()).isEqualTo("Ryż po syczuańsku");
        var undo = revisions.undo(email, plan.id(), slotId, new ApplyRevision(applied.version(), preview.id()));
        assertThat(undo.after().getLocale()).isEqualTo(ContentLocale.en);
        var restored = revisionStore.apply(email, plan.id(), slotId, new ApplyRevision(applied.version(), undo.id()));
        assertThat(restored.plan().slots().get(0).recipe().getName()).isEqualTo(english.getName());
        generation.generate(email, plan.id(), slotId, new Generate(restored.version(), UUID.randomUUID()));
        var requests = org.mockito.ArgumentCaptor.forClass(RecipeGenerationRequestDto.class);
        verify(gemini, times(3)).generateRecipes(requests.capture(), any());
        assertThat(requests.getAllValues()).extracting(RecipeGenerationRequestDto::getLocale).containsExactly("en", "pl", "pl");
        assertThat(requests.getAllValues().get(1).getRequestText()).contains("Preserve its cuisine", "numeric amounts", "every instruction");
    }
    @Test void translationRejectsChangedAmountsUnitsServingsPreparationTimeIngredientsAndSteps() {
        var plan = generated(1); var slot = plan.plan().slots().get(0);
        for (int mutation = 0; mutation < 6; mutation++) {
            var translated = recipe("Przetłumaczony ryż", 100);
            switch (mutation) {
                case 0 -> translated.setIngredients(List.of(new RecipeIngredientDto("ryż", 101, "g")));
                case 1 -> translated.setIngredients(List.of(new RecipeIngredientDto("ryż", 100, "ml")));
                case 2 -> translated.setServings(3);
                case 3 -> translated.setTimeToPrepare("21 min");
                case 4 -> translated.setIngredients(List.of(new RecipeIngredientDto("ryż", 100, "g"), new RecipeIngredientDto("olej", 10, "ml")));
                case 5 -> translated.setInstructions(List.of("Ugotuj ryż.", "Podaj."));
            }
            when(gemini.generateRecipes(any(RecipeGenerationRequestDto.class), any())).thenReturn(json.writeValueAsString(translated));
            assertThatThrownBy(() -> revisions.preview(email, plan.id(), slot.id(), new RevisionRequest(plan.version(), UUID.randomUUID(),
                    RevisionIntent.TRANSLATE_PL, null, null, null, null, null, null)))
                    .isInstanceOf(AppException.class);
            assertThat(plans.get(email, plan.id()).plan().slots().get(0).recipe()).isEqualTo(slot.recipe());
        }
    }
    @Test void unrelatedLibraryRecipeCannotSkipTheSelectedBroccoliOffer() {
        recipes.saveRecipe(recipe("Tylko ryż " + UUID.randomUUID(), 100), email);
        var broccoli = ingredient("brokuł"); alias(broccoli, "brokuły");
        var offer = broccoliOffer(broccoli);
        when(gemini.generateRecipes(any(RecipeGenerationRequestDto.class), any())).thenReturn(json.writeValueAsString(broccoliRecipe("Brokuły z pary", "brokuły")));
        var plan = plans.create(email, selectedSettings(offer.id()));
        var result = generation.generate(email, plan.id(), plan.plan().slots().get(0).id(), new Generate(plan.version(), UUID.randomUUID()));
        assertThat(result.plan().slots().get(0).recipe().getIngredients()).extracting(RecipeIngredientDto::getName).contains("brokuły");
        verify(gemini, times(1)).generateRecipes(any(RecipeGenerationRequestDto.class), any());
    }
    @Test void aiMustUseTheSelectedIngredientInsteadOfSilentlyReturningRice() {
        var offer = broccoliOffer(ingredient("brokuł"));
        var plan = plans.create(email, selectedSettings(offer.id()));
        assertThatThrownBy(() -> generation.generate(email, plan.id(), plan.plan().slots().get(0).id(), new Generate(plan.version(), UUID.randomUUID())))
                .isInstanceOf(AppException.class);
        assertThat(plans.get(email, plan.id()).plan().slots().get(0).recipe()).isNull();
        verify(gemini, times(3)).generateRecipes(any(RecipeGenerationRequestDto.class), any());
    }
    @Test void substitutionRejectsTheOldIngredientEvenWhenReturnedUnderAnAlias() {
        var plan = generated(1); var rice = ingredient("ryż"); alias(rice, "ziarno ryżowe"); ingredient("brokuł");
        var invalid = broccoliRecipe("Ryż i brokuł", "brokuł");
        invalid.setIngredients(List.of(new RecipeIngredientDto("ziarno ryżowe", 100, "g"), new RecipeIngredientDto("brokuł", 100, "g")));
        when(gemini.generateRecipes(any(RecipeGenerationRequestDto.class), any())).thenReturn(json.writeValueAsString(invalid));
        assertThatThrownBy(() -> revisions.preview(email, plan.id(), plan.plan().slots().get(0).id(), substitute(plan, "ryż", "brokuł")))
                .isInstanceOf(AppException.class).extracting("code").isEqualTo(org.springframework.http.HttpStatus.BAD_GATEWAY);
        assertThat(plans.get(email, plan.id()).plan().slots().get(0).recipe().getIngredients()).extracting(RecipeIngredientDto::getName).containsExactly("ryż");
    }
    @Test void matchingLibraryAliasUsesSelectedProductWithoutForcingItIntoEveryMeal() {
        var broccoli = ingredient("brokuł"); alias(broccoli, "brokuły"); var offer = broccoliOffer(broccoli);
        var saved = broccoliRecipe("Brokuły z biblioteki " + UUID.randomUUID(), "brokuły"); recipes.saveRecipe(saved, email);
        var rice = recipe("Ryż z biblioteki " + UUID.randomUUID(), 100); recipes.saveRecipe(rice, email);
        var settings = selectedSettings(offer.id());
        var plan = plans.create(email, new Create(settings.requestId(), settings.startDate(), 2, settings.servings(), settings.mealTypes(), settings.stores(), settings.budget(), settings.locale(), settings.maxMinutes(), settings.planningMode(), settings.budgetMode(), settings.shopping()));
        plan = generation.generate(email, plan.id(), plan.plan().slots().get(0).id(), new Generate(plan.version(), UUID.randomUUID()));
        assertThat(plan.plan().slots().get(0).recipe().getName()).isEqualTo(saved.getName());
        plan = generation.generate(email, plan.id(), plan.plan().slots().get(1).id(), new Generate(plan.version(), UUID.randomUUID()));
        assertThat(plan.plan().slots().get(1).recipe().getName()).isEqualTo(rice.getName());
        verifyNoInteractions(gemini);
    }
    @Test void substitutionAcceptsAliasesOnlyWhenTheOldIdentityIsAbsent() {
        var plan = generated(1); alias(ingredient("ryż"), "ziarno ryżowe"); alias(ingredient("brokuł"), "brokuły");
        when(gemini.generateRecipes(any(RecipeGenerationRequestDto.class), any())).thenReturn(json.writeValueAsString(broccoliRecipe("Brokuły zamiast ryżu", "brokuły")));
        var preview = revisions.preview(email, plan.id(), plan.plan().slots().get(0).id(), substitute(plan, "ziarno ryżowe", "brokuł"));
        assertThat(preview.after().getIngredients()).extracting(RecipeIngredientDto::getName).containsExactly("brokuły");
        assertThat(preview.after().getInstructions()).containsExactly("Ugotuj brokuły na parze.");
    }
    @Test void substitutionCannotReplaceAnIngredientWithAnotherNameForItself() {
        var plan = generated(1); alias(ingredient("ryż"), "ziarno ryżowe");
        assertThatThrownBy(() -> revisions.preview(email, plan.id(), plan.plan().slots().get(0).id(), substitute(plan, "ryż", "ziarno ryżowe")))
                .isInstanceOf(AppException.class).extracting("code").isEqualTo(org.springframework.http.HttpStatus.BAD_REQUEST);
        verify(gemini, times(1)).generateRecipes(any(RecipeGenerationRequestDto.class), any());
    }
    private RevisionRequest substitute(View plan, String original, String replacement) {
        return new RevisionRequest(plan.version(), UUID.randomUUID(), RevisionIntent.SUBSTITUTE, null, null, original, replacement, null, null);
    }
    private Ingredient ingredient(String name) {
        return ingredients.findByNameIgnoreCase(name).orElseGet(() -> ingredients.saveAndFlush(new Ingredient(null, name, List.of())));
    }
    private void alias(Ingredient ingredient, String name) {
        if (aliases.findByNormalizedAliasForLocale(normalization.aliasName(name), ContentLocale.pl).stream().anyMatch(a -> a.getIngredient().getId().equals(ingredient.getId()))) return;
        var alias = new IngredientAlias(); alias.setIngredient(ingredient); alias.setNormalizedAlias(normalization.aliasName(name)); alias.setLocale(ContentLocale.pl); aliases.saveAndFlush(alias);
    }
    private RecipeDto broccoliRecipe(String name, String ingredient) {
        var dto = recipe(name, 100); dto.setIngredients(List.of(new RecipeIngredientDto(ingredient, 100, "g"))); dto.setInstructions(List.of("Ugotuj brokuły na parze.")); return dto;
    }
    private StoreOfferDto.Offer broccoliOffer(Ingredient ingredient) {
        return storeOffers.publish(UUID.randomUUID(), new StoreOfferDto.Publish(0, Store.LIDL, ingredient.getId(), "Brokuł — dane testowe", new java.math.BigDecimal("500"), "g", new java.math.BigDecimal("3.99"),
                1, 1, null, false, LocalDate.now(), LocalDate.now().plusDays(1), "https://www.lidl.pl/p/test-broccoli", "Kontrolowana oferta testowa", Instant.now().minusSeconds(1), true, true, true));
    }
    private Create selectedSettings(UUID offerId) {
        var base = settings(1);
        return new Create(base.requestId(), base.startDate(), base.dayCount(), base.servings(), base.mealTypes(), base.stores(), base.budget(), base.locale(), base.maxMinutes(), base.planningMode(), base.budgetMode(),
                new ShoppingOptions(LocalDate.now(), 1, Set.of(), Set.of(), Set.of(offerId), false));
    }
    private RevisionPreview preview(View plan, UUID slot, RecipeDto after) {
        return revisions.preview(email, plan.id(), slot, new RevisionRequest(plan.version(), UUID.randomUUID(), RevisionIntent.MANUAL, null, after, null, null, null, null));
    }
    private View generated(int count) {
        var plan = plans.create(email, settings(count));
        for (UUID slot : plan.plan().slots().stream().map(Slot::id).toList()) plan = generation.generate(email, plan.id(), slot, new Generate(plan.version(), UUID.randomUUID()));
        return plan;
    }
    private Create settings(int count) { return new Create(UUID.randomUUID(), LocalDate.now(), count, 2, Set.of(MealType.DINNER), Set.of(Store.LIDL, Store.BIEDRONKA), null, "pl", 45, PlanningMode.DEALS, BudgetMode.NONE, new ShoppingOptions(LocalDate.now(), 1, Set.of(), Set.of(), Set.of(), false)); }
    private RecipeDto recipe(String name, double amount) { var dto = new RecipeDto(null, name, List.of(new RecipeIngredientDto("ryż", amount, "g")), List.of("Ugotuj ryż."), "Proste danie", "20 min", 2); dto.setLocale(ContentLocale.pl); dto.setVisibility(RecipeVisibility.PRIVATE); return dto; }
    private UsernamePasswordAuthenticationToken auth() { return new UsernamePasswordAuthenticationToken(new UserDto(email, owner.getId(), Role.USER, null), null, List.of(new SimpleGrantedAuthority("ROLE_USER"))); }
}
