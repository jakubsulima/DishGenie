package org.jakub.backendapi;

import org.jakub.backendapi.dto.*;
import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.dto.WeekCycleDto.*;
import org.jakub.backendapi.entities.*;
import org.jakub.backendapi.entities.Enums.*;
import org.jakub.backendapi.repositories.*;
import org.jakub.backendapi.services.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@org.springframework.context.annotation.Import(org.jakub.backendapi.OffersEnabledTestConfiguration.class)
@SpringBootTest(properties={"security.jwt.token.secret-key=cycle-integration-test-secret-key-32-characters","posthog.enabled=false","spring.jpa.show-sql=false","app.planner.jobs-enabled=false"})
@AutoConfigureMockMvc
class WeekCycleIntegrationTest {
    @Autowired WeekCycleService cycle; @Autowired WeekCycleSupport support; @Autowired PreparedPortionService portions; @Autowired ShoppingTripService trips;
    @Autowired MealPlanRevisionService revisions; @Autowired MealPlanRevisionStore revisionStore;
    @Autowired MealPlanService plans; @Autowired MealPlanGenerationService generation; @Autowired MealPlanJobService jobs;
    @Autowired UserRepository users; @Autowired FridgeIngredientRepository fridge; @Autowired IngredientRepository ingredients;
    @Autowired MealPlanItemPriceService itemPrices; @Autowired MealPlanPricingService pricing;
    @Autowired ShoppingListItemRepository manual; @Autowired ObjectMapper json; @Autowired MockMvc mvc;
    @MockitoBean GeminiService gemini;
    String email; User owner; AtomicInteger calls;
    @BeforeEach void setup() {
        email="cycle-"+UUID.randomUUID()+"@example.com";owner=new User();owner.setEmail(email);owner.setRole(Role.USER);owner=users.saveAndFlush(owner);
        if(ingredients.findByNameIgnoreCase("ryż").isEmpty()) ingredients.saveAndFlush(new Ingredient(null,"ryż",List.of()));
        calls=new AtomicInteger();when(gemini.generateRecipes(any(RecipeGenerationRequestDto.class),any())).thenAnswer(c->json.writeValueAsString(recipe("Ryż testowy "+calls.incrementAndGet(),300)));
    }
    Create settings(int days) {return new Create(UUID.randomUUID(),LocalDate.now(ZoneId.of("Europe/Warsaw")).plusDays(1),days,2,Set.of(MealType.LUNCH),Set.of(Store.LIDL),null,"pl",45,PlanningMode.PRACTICAL,BudgetMode.NONE,new ShoppingOptions(LocalDate.now(),1,Set.of(),Set.of(),Set.of(),false));}
    RecipeDto recipe(String name,double amount) {var r=new RecipeDto(null,name,List.of(new RecipeIngredientDto("ryż",amount,"g")),List.of("Ugotuj ryż."),"Kontrolowany przepis","10 min",2);r.setLocale(ContentLocale.pl);return r;}
    FridgeIngredient rice(Double amount,QuantityAccuracy accuracy) {var i=new FridgeIngredient(null,"ryż",null,amount,Unit.GRAMS,owner);i.setQuantityAccuracy(accuracy);return fridge.saveAndFlush(i);}
    View generate(View p,int index) {return generation.generate(email,p.id(),p.plan().slots().get(index).id(),new Generate(p.version(),UUID.randomUUID()));}
    View change(View p,BatchChange in) {var preview=cycle.preview(email,p.id(),in);return cycle.apply(email,p.id(),new WeekCycleService.Apply(p.version(),UUID.randomUUID(),preview.id()));}
    BatchChange share(View p,int from,int to) {return new BatchChange(p.version(),UUID.randomUUID(),"SHARE",p.plan().slots().get(from).id(),p.plan().slots().get(to).id(),2,null,true,false,null);}
    double stock(){return fridge.findByUser_Id(owner.getId()).stream().mapToDouble(i->i.getAmount()==null?0:i.getAmount()).sum();}
    @Test void backgroundGenerationReadsPersistedDislikedIngredients() {
        owner.setUserPreferences(new UserPreferences(owner.getId(),owner,Diet.NONE,new ArrayList<>(List.of(Diet.NONE)),new ArrayList<>(List.of("seler"))));
        users.saveAndFlush(owner);
        var p=cycle.create(email,new Start(settings(1),List.of(),Set.of())).view();
        p=generate(p,0);
        assertThat(p.plan().slots().get(0).recipe()).isNotNull();
        verify(gemini).generateRecipes(any(),argThat(prefs -> Arrays.asList(prefs.getDislikedIngredients()).contains("seler")));
    }
    @Test void partialCatalogDoesNotBlockV4Meals() {
        var s=settings(1);
        var input=new Create(s.requestId(),s.startDate(),1,s.servings(),Set.of(MealType.BREAKFAST),s.stores(),s.budget(),s.locale(),s.maxMinutes(),PlanningMode.PROMOTIONS_FIRST,s.budgetMode(),s.shopping());
        var p=cycle.create(email,new Start(input,List.of(),Set.of())).view();
        p=generate(p,0);
        assertThat(p.plan().slots().get(0).recipe()).isNotNull();
        assertThat(cycle.previewShopping(email,p.id()).items()).isNotEmpty();
        verify(gemini).generateRecipes(argThat(r -> r.getPlanningIngredients().isEmpty() && r.getRequestText().contains("Missing prices must not prevent planning")),any());
    }
    @Test void supportsBreakfastLunchAndDinnerForSelectedDays() {
        var s=settings(3);
        var input=new Create(s.requestId(),s.startDate(),3,s.servings(),Set.of(MealType.BREAKFAST,MealType.LUNCH,MealType.DINNER),s.stores(),s.budget(),s.locale(),s.maxMinutes(),s.planningMode(),s.budgetMode(),s.shopping());
        var p=cycle.create(email,new Start(input,List.of(),Set.of())).view();
        assertThat(p.plan().slots()).hasSize(9);
        assertThat(p.plan().slots().stream().filter(slot->slot.mealType()==MealType.BREAKFAST)).hasSize(3);
        p=generate(p,0);
        assertThat(p.plan().slots().get(0).mealType()).isEqualTo(MealType.BREAKFAST);
        assertThat(cycle.previewShopping(email,p.id()).items()).isNotEmpty();
    }
    @Test void referenceRiceBalanceAndImmutableHistory() {
        rice(200d,QuantityAccuracy.EXACT);var input=settings(7);
        var started=cycle.create(email,new Start(input,List.of(new ExceptionDay(input.startDate().plusDays(2),MealType.LUNCH,true,null),new ExceptionDay(input.startDate().plusDays(3),MealType.LUNCH,false,15)),Set.of()));
        assertThat(cycle.create(email,new Start(input,List.of(new ExceptionDay(input.startDate().plusDays(2),MealType.LUNCH,true,null),new ExceptionDay(input.startDate().plusDays(3),MealType.LUNCH,false,15)),Set.of()))).isEqualTo(started);
        var p=generate(started.view(),0);p=change(p,share(p,0,1));
        var shopping=cycle.previewShopping(email,p.id());assertThat(shopping.items()).hasSize(1);assertThat(shopping.items().get(0).amount()).isEqualTo(400d);assertThat(shopping.items().get(0).usedFromFridge()).isEqualTo(200d);
        p=itemPrices.save(email,p.id(),new StoreOfferDto.PriceInput(p.version(),shopping.items().get(0).key(),Store.LIDL,LocalDate.now(),new java.math.BigDecimal("500"),new java.math.BigDecimal("3.00")));
        var quote=pricing.preview(email,p.id(),new StoreOfferDto.QuoteRequest(p.version(),LocalDate.now(),Set.of(),Set.of()));
        var priced=quote.baskets().stream().filter(b->b.option().equals("LIDL")).findFirst().orElseThrow().items().get(0);
        assertThat(priced.packages()).isEqualByComparingTo("1");assertThat(priced.purchasedAmount()).isEqualByComparingTo("500");assertThat(priced.leftoverAmount()).isEqualByComparingTo("100");
        p=plans.selectBasket(email,p.id(),p.version(),"LIDL",quote);
        var soap=new ShoppingListItem();soap.setUser(owner);soap.setClientItemId(UUID.randomUUID().toString());soap.setName("detergent");soap.setCreatedAt(Instant.now());soap=manual.saveAndFlush(soap);
        var t=trips.prepare(email,p.id(),new Prepare(p.version(),UUID.randomUUID(),Set.of(soap.getId())));assertThat(t.trip().lines()).extracting(TripLine::name).containsExactlyInAnyOrder("ryż","detergent");
        var line=t.trip().lines().stream().filter(l->l.name().equals("ryż")).findFirst().orElseThrow();assertThat(line.suggestedAmount()).isEqualTo(500d);assertThat(line.packages()).isEqualByComparingTo("1");
        t=trips.changeLine(email,t.id(),line.id(),new LineChange(t.version(),UUID.randomUUID(),"IN_BASKET"));assertThat(stock()).isEqualTo(200);
        var confirm=new Confirm(t.version(),UUID.randomUUID(),List.of(new Purchase(line.id(),500d,"g",true,null)));
        t=trips.confirm(email,t.id(),confirm);assertThat(stock()).isEqualTo(700);assertThat(trips.confirm(email,t.id(),confirm)).isEqualTo(t);assertThat(stock()).isEqualTo(700);
        var original=t;var batch=support.batches(p.plan()).get(0);var preview=cycle.cookingPreview(email,p.id(),batch.id(),4);
        var cook=new Cook(p.version(),UUID.randomUUID(),4,true,preview.inventoryFingerprint());p=cycle.cook(email,p.id(),batch.id(),cook);assertThat(stock()).isEqualTo(100);assertThat(cycle.cook(email,p.id(),batch.id(),cook)).isEqualTo(p);assertThat(stock()).isEqualTo(100);
        var eat=new Eat(p.version(),UUID.randomUUID(),2);p=cycle.eat(email,p.id(),p.plan().slots().get(1).id(),eat);assertThat(stock()).isEqualTo(100);
        p=generate(p,4);var replacement=cycle.preview(email,p.id(),new BatchChange(p.version(),UUID.randomUUID(),"RECIPE",p.plan().slots().get(4).id(),null,null,recipe("Nowy ryż",150),false,false,null));
        assertThat(replacement.shoppingAfter().items().get(0).amount()).isEqualTo(50d);
        p=cycle.apply(email,p.id(),new WeekCycleService.Apply(p.version(),UUID.randomUUID(),replacement.id()));
        var next=trips.prepare(email,p.id(),new Prepare(p.version(),UUID.randomUUID(),Set.of()));assertThat(next.id()).isNotEqualTo(original.id());assertThat(next.trip().lines().get(0).toBuy()).isEqualTo(50d);
        assertThat(trips.get(email,original.id())).isEqualTo(original);
        var nextWeek=cycle.create(email,new Start(settings(7),List.of(),Set.of()));assertThat(nextWeek.view().plan().cycle().exceptions()).isEmpty();assertThat(nextWeek.view().plan().cycle().batches()).isEmpty();
    }
    @Test void stalePreviewUnknownStockAndOwnershipHaveNoSideEffects() {
        var stock=rice(null,QuantityAccuracy.UNKNOWN);var p=generate(cycle.create(email,new Start(settings(2),List.of(),Set.of())).view(),0);
        assertThat(cycle.previewShopping(email,p.id()).items().get(0).needsReview()).isTrue();assertThat(cycle.previewShopping(email,p.id()).items().get(0).amount()).isEqualTo(300d);
        var preview=cycle.preview(email,p.id(),share(p,0,1));stock.setAmount(200d);stock.setQuantityAccuracy(QuantityAccuracy.EXACT);fridge.saveAndFlush(stock);
        assertThatThrownBy(()->cycle.apply(email,p.id(),new WeekCycleService.Apply(p.version(),UUID.randomUUID(),preview.id()))).hasMessageContaining("changed");
        assertThat(plans.get(email,p.id()).version()).isEqualTo(p.version());
        var alien=new User();alien.setEmail(UUID.randomUUID()+"@example.com");alien.setRole(Role.USER);alien=users.saveAndFlush(alien);final String other=alien.getEmail();
        assertThatThrownBy(()->cycle.preview(other,p.id(),share(p,0,1))).hasMessageContaining("unavailable");
        assertThatThrownBy(()->cycle.create(other,new Start(settings(1),List.of(),Set.of(stock.getId())))).hasMessageContaining("unavailable");
    }
    @Test void legacyRoutesRejectWritesAndGetHasNoMutation() throws Exception {
        var p=generate(cycle.create(email,new Start(settings(1),List.of(),Set.of())).view(),0);var auth=user(email).roles("USER");
        mvc.perform(get("/v4/meal-plans/"+p.id()+"/shopping-preview").with(auth)).andExpect(status().isOk());assertThat(plans.get(email,p.id()).version()).isEqualTo(p.version());
        mvc.perform(post("/v3/meal-plans/"+p.id()+"/accept").with(auth).with(csrf()).contentType("application/json").content(json.writeValueAsString(new Version(p.version())))).andExpect(status().isConflict());
        mvc.perform(post("/v2/meal-plans/"+p.id()+"/prices").with(auth).with(csrf()).contentType("application/json").content("{}")).andExpect(status().isConflict());
        assertThat(plans.get(email,p.id()).version()).isEqualTo(p.version());
    }
    @Test void sameIntentConcurrentCreationAndJobRetryAreIdempotent() throws Exception {
        var in=new Start(settings(2),List.of(),Set.of());var pool=Executors.newFixedThreadPool(2);
        try {var a=pool.submit(()->cycle.create(email,in));var b=pool.submit(()->cycle.create(email,in));var one=a.get(20,TimeUnit.SECONDS);assertThat(b.get(20,TimeUnit.SECONDS)).isEqualTo(one);
            var command=new Generate(one.view().version(),one.generationId());
            var preciseTime=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS).plusNanos(123456789);
            try(var clock=mockStatic(Instant.class,CALLS_REAL_METHODS)) {
                clock.when(Instant::now).thenReturn(preciseTime);
                var j=jobs.start(email,one.view().id(),command);assertThat(jobs.start(email,one.view().id(),command)).isEqualTo(j);
            }
        }finally{pool.shutdownNow();}
    }
    @Test void occupiedMoveAndCookedHistoryAreProtected() {
        var p=generate(cycle.create(email,new Start(settings(2),List.of(),Set.of())).view(),0);p=generate(p,1);final View current=p;
        assertThatThrownBy(()->cycle.preview(email,current.id(),new BatchChange(current.version(),UUID.randomUUID(),"MOVE",current.plan().slots().get(0).id(),current.plan().slots().get(1).id(),null,null,false,false,null))).hasMessageContaining("occupied");
        var preview=cycle.cookingPreview(email,p.id(),p.plan().slots().get(0).id(),2);p=cycle.cook(email,p.id(),preview.batchId(),new Cook(p.version(),UUID.randomUUID(),2,false,preview.inventoryFingerprint()));final View cooked=p;
        assertThatThrownBy(()->cycle.preview(email,cooked.id(),new BatchChange(cooked.version(),UUID.randomUUID(),"RECIPE",cooked.plan().slots().get(0).id(),null,null,recipe("Nowy ryż",150),false,false,null))).hasMessageContaining("history");
    }
    @Test void partialImportAndSecondTabCannotDoublePurchase() {
        var p=generate(cycle.create(email,new Start(settings(1),List.of(),Set.of())).view(),0);var t=trips.prepare(email,p.id(),new Prepare(p.version(),UUID.randomUUID(),Set.of()));
        var l=t.trip().lines().get(0);var stale=t;var checked=trips.changeLine(email,t.id(),l.id(),new LineChange(t.version(),UUID.randomUUID(),"IN_BASKET"));
        assertThatThrownBy(()->trips.changeLine(email,stale.id(),l.id(),new LineChange(stale.version(),UUID.randomUUID(),"UNAVAILABLE"))).hasMessageContaining("Changed");
        var in=new Confirm(checked.version(),UUID.randomUUID(),List.of(new Purchase(l.id(),500d,"bag",true,null)));var done=trips.confirm(email,t.id(),in);
        assertThat(done.trip().lines().get(0).importStatus()).isEqualTo("SKIPPED_UNIT");assertThat(stock()).isZero();assertThat(trips.confirm(email,t.id(),in)).isEqualTo(done);
        assertThatThrownBy(()->trips.confirm(email,done.id(),new Confirm(checked.version(),in.requestId(),List.of()))).hasMessageContaining("different data");
    }
    @Test void skippedMealAndSlotLimitAffectGenerationWithoutOffers() {
        var in=settings(2);var p=cycle.create(email,new Start(in,List.of(new ExceptionDay(in.startDate(),MealType.LUNCH,true,null),new ExceptionDay(in.startDate().plusDays(1),MealType.LUNCH,false,15)),Set.of())).view();
        assertThatThrownBy(()->generate(p,0)).hasMessageContaining("restore");
        var ready=generate(p,1);assertThat(ready.plan().slots().get(1).recipe()).isNotNull();verify(gemini).generateRecipes(argThat(r->r.getPreferences().getMaxMinutes()==15),any());
    }
    @Test void predeclaredTwoDayCookingGeneratesOnceAndKeepsTimeLimit() {
        var settings=settings(2);var p=cycle.create(email,new Start(settings,List.of(new ExceptionDay(settings.startDate(),MealType.LUNCH,false,15,true)),Set.of())).view();
        var job=jobs.start(email,p.id(),new Generate(p.version(),UUID.randomUUID()));assertThat(job.total()).isEqualTo(1);
        var ready=generate(p,0);assertThat(ready.plan().slots().stream().filter(slot->slot.recipe()!=null)).hasSize(2);
        assertThat(support.batches(ready.plan())).hasSize(1);assertThat(support.batches(ready.plan()).get(0).portions()).isEqualTo(4);
        assertThat(cycle.previewShopping(email,p.id()).items().get(0).amount()).isEqualTo(600d);
        assertThat(calls.get()).isEqualTo(1);
    }
    @Test void skippedImportCanBeFinishedWithoutRepeatingSuccessAndUndoProtectsConsumption() {
        var p=generate(cycle.create(email,new Start(settings(1),List.of(),Set.of())).view(),0);
        var t=trips.prepare(email,p.id(),new Prepare(p.version(),UUID.randomUUID(),Set.of()));var l=t.trip().lines().get(0);
        t=trips.changeLine(email,t.id(),l.id(),new LineChange(t.version(),UUID.randomUUID(),"IN_BASKET"));
        t=trips.confirm(email,t.id(),new Confirm(t.version(),UUID.randomUUID(),List.of(new Purchase(l.id(),500d,"bag",true,null))));
        var retry=new Confirm(t.version(),UUID.randomUUID(),List.of(new Purchase(l.id(),500d,"g",true,null)));
        t=trips.retryImport(email,t.id(),retry);assertThat(stock()).isEqualTo(500);assertThat(trips.retryImport(email,t.id(),retry)).isEqualTo(t);assertThat(stock()).isEqualTo(500);
        var preview=cycle.cookingPreview(email,p.id(),p.plan().slots().get(0).id(),2);cycle.cook(email,p.id(),preview.batchId(),new Cook(p.version(),UUID.randomUUID(),2,true,preview.inventoryFingerprint()));
        final var done=t;assertThatThrownBy(()->trips.undoImport(email,done.id(),new Command(done.version(),UUID.randomUUID()))).hasMessageContaining("changed");assertThat(stock()).isEqualTo(200);
    }
    @Test void cookingUndoAndPartialEatingKeepRawQuantitiesSeparate() {
        rice(800d,QuantityAccuracy.EXACT);var p=generate(cycle.create(email,new Start(settings(1),List.of(),Set.of())).view(),0);var id=p.plan().slots().get(0).id();
        var preview=cycle.cookingPreview(email,p.id(),id,2);p=cycle.cook(email,p.id(),id,new Cook(p.version(),UUID.randomUUID(),2,true,preview.inventoryFingerprint()));assertThat(stock()).isEqualTo(500);
        p=cycle.undoCooking(email,p.id(),id,new Command(p.version(),UUID.randomUUID()));assertThat(stock()).isEqualTo(800);
        preview=cycle.cookingPreview(email,p.id(),id,2);p=cycle.cook(email,p.id(),id,new Cook(p.version(),UUID.randomUUID(),2,true,preview.inventoryFingerprint()));
        p=cycle.eat(email,p.id(),id,new Eat(p.version(),UUID.randomUUID(),1));assertThat(support.batches(p.plan()).get(0).allocations().get(0).eatenPortions()).isEqualTo(1);assertThat(stock()).isEqualTo(500);
        final var current=p;assertThatThrownBy(()->cycle.undoCooking(email,current.id(),id,new Command(current.version(),UUID.randomUUID()))).hasMessageContaining("Eaten");
    }

    @Test void preparedPortionsCarryToTheNextWeekWithoutRawConsumptionOrDoubleAllocation() {
        rice(800d,QuantityAccuracy.EXACT);var original=generate(cycle.create(email,new Start(settings(1),List.of(),Set.of())).view(),0);var batchId=original.plan().slots().get(0).id();
        var cp=cycle.cookingPreview(email,original.id(),batchId,4);original=cycle.cook(email,original.id(),batchId,new Cook(original.version(),UUID.randomUUID(),4,true,cp.inventoryFingerprint()));assertThat(stock()).isEqualTo(200);
        var next=cycle.create(email,new Start(settings(2),List.of(),Set.of())).view();var ready=cycle.readyPortions(email).get(0);assertThat(ready.unallocated()).isEqualTo(2);
        var assign=new PreparedPortionService.Assign(next.version(),UUID.randomUUID(),original.id(),original.version(),batchId,next.plan().slots().get(0).id(),2);
        next=portions.assign(email,next.id(),assign);assertThat(portions.assign(email,next.id(),assign)).isEqualTo(next);assertThat(cycle.previewShopping(email,next.id()).items()).isEmpty();assertThat(stock()).isEqualTo(200);
        assertThat(cycle.readyPortions(email).get(0).unallocated()).isZero();next=cycle.eat(email,next.id(),next.plan().slots().get(0).id(),new Eat(next.version(),UUID.randomUUID(),2));assertThat(stock()).isEqualTo(200);
        assertThat(cycle.readyPortions(email).get(0).remaining()).isEqualTo(2);
        final var source=plans.get(email,original.id());assertThatThrownBy(()->cycle.undoCooking(email,source.id(),batchId,new Command(source.version(),UUID.randomUUID()))).hasMessageContaining("depend");
    }

    @Test void existingRevisionWorkflowUsesBatchDemandAndRejectsStaleInventoryInV4() {
        var stock=rice(200d,QuantityAccuracy.EXACT);var p=generate(cycle.create(email,new Start(settings(2),List.of(),Set.of())).view(),0);p=change(p,share(p,0,1));
        var slotId=p.plan().slots().get(0).id();var request=new RevisionRequest(p.version(),UUID.randomUUID(),RevisionIntent.MANUAL,null,recipe("Poprawiony ryż",200),null,null,null,null);
        var preview=revisions.preview(email,p.id(),slotId,request);assertThat(preview.shoppingAfter().items().get(0).amount()).isEqualTo(200d);assertThat(preview.affectedSlots()).hasSize(2);
        stock.setAmount(100d);fridge.saveAndFlush(stock);final var stale=p;
        assertThatThrownBy(()->revisionStore.apply(email,stale.id(),slotId,new ApplyRevision(stale.version(),preview.id()))).hasMessageContaining("changed");
        var fresh=revisions.preview(email,p.id(),slotId,new RevisionRequest(p.version(),UUID.randomUUID(),RevisionIntent.MANUAL,null,recipe("Poprawiony ryż",200),null,null,null,null));
        p=revisionStore.apply(email,p.id(),slotId,new ApplyRevision(p.version(),fresh.id()));assertThat(p.plan().schemaVersion()).isEqualTo(4);assertThat(support.batches(p.plan()).get(0).portions()).isEqualTo(4);
        assertThat(p.plan().slots()).allSatisfy(slot->assertThat(slot.recipe().getName()).isEqualTo("Poprawiony ryż"));
    }

    @Test void startingV4CannotOverwriteAnExistingLegacyPlanWithAReusedId() {
        var input=settings(1);View legacy;
        var preciseTime=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS).plusNanos(123456789);
        try(var clock=mockStatic(Instant.class,CALLS_REAL_METHODS)) {
            clock.when(Instant::now).thenReturn(preciseTime);
            legacy=plans.create(email,input);
        }
        assertThatThrownBy(()->cycle.create(email,new Start(input,List.of(),Set.of()))).hasMessageContaining("already belongs");
        assertThat(plans.get(email,legacy.id())).isEqualTo(legacy);
    }

}
