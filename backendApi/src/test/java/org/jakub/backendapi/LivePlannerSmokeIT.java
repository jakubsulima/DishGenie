package org.jakub.backendapi;
import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.entities.User;
import org.jakub.backendapi.entities.Enums.Role;
import org.jakub.backendapi.repositories.UserRepository;
import org.jakub.backendapi.services.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import java.time.LocalDate;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
/** Opt-in network check, deliberately separate from controlled CI tests. Uses one recipe request. */
@EnabledIfEnvironmentVariable(named = "RUN_LIVE_PLANNER_SMOKE", matches = "1")
@org.springframework.context.annotation.Import(org.jakub.backendapi.OffersEnabledTestConfiguration.class)
@SpringBootTest(properties = {"security.jwt.token.secret-key=live-smoke-isolated-h2-secret-key-at-least-32", "posthog.enabled=false", "spring.jpa.show-sql=false", "app.planner.jobs-enabled=false"})
class LivePlannerSmokeIT {
    @Autowired UserRepository users;
    @Autowired MealPlanService plans;
    @Autowired MealPlanGenerationService generation;
    @Autowired PlanRecipeValidationService validation;
    @Autowired LidlReviewCaptureService capture;
    @Test void actualLidlReviewCaptureDoesNotPublishPrices() {
        var run = capture.capture();
        assertThat(run.status()).isEqualTo("INCOMPLETE_REVIEW_ONLY");
        assertThat(run.candidates()).isGreaterThan(0);
        System.out.println("LIVE_SOURCE: candidates=" + run.candidates() + ", status=" + run.status());
    }
    @Test void actualGeminiCreatesOneValidatedPolishMealWithoutInventedPrices() {
        String email = "live-" + UUID.randomUUID() + "@example.com";
        var user = new User(); user.setEmail(email); user.setRole(Role.USER); users.saveAndFlush(user);
        var settings = new Create(UUID.randomUUID(), LocalDate.now(), 1, 2, Set.of(MealType.DINNER), Set.of(Store.LIDL), null, "pl", 45,
                PlanningMode.DEALS, BudgetMode.NONE, new ShoppingOptions(LocalDate.now(), 1, Set.of(), Set.of(), Set.of(), false));
        var plan = plans.create(email, settings); var slot = plan.plan().slots().get(0);
        var generated = generation.generate(email, plan.id(), slot.id(), new Generate(plan.version(), UUID.randomUUID()));
        var recipe = generated.plan().slots().get(0).recipe();
        validation.validate(email, recipe, 45, "pl");
        assertThat(recipe.getIngredients()).isNotEmpty(); assertThat(recipe.getInstructions()).isNotEmpty();
        System.out.println("LIVE_AI: valid Polish meal, ingredients=" + recipe.getIngredients().size() + ", instructions=" + recipe.getInstructions().size());
    }
}
