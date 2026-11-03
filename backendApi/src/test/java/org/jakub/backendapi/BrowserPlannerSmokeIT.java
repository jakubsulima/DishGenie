package org.jakub.backendapi;
import org.jakub.backendapi.dto.*;
import org.jakub.backendapi.dto.MealPlanDto.Store;
import org.jakub.backendapi.entities.*;
import org.jakub.backendapi.entities.Enums.*;
import org.jakub.backendapi.repositories.*;
import org.jakub.backendapi.services.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import tools.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.nio.file.Path;
import java.math.BigDecimal;
import java.util.concurrent.atomic.AtomicInteger;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
@EnabledIfEnvironmentVariable(named = "RUN_BROWSER_PLANNER_SMOKE", matches = "1")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT, properties = {
        "allowed.origins=http://127.0.0.1:5174", "server.port=18889", "server.servlet.context-path=/api", "security.jwt.token.secret-key=browser-test-isolated-h2-secret-key-at-least-32", "posthog.enabled=false", "spring.jpa.show-sql=false"})
class BrowserPlannerSmokeIT {
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwords;
    @Autowired IngredientRepository ingredients;
    @Autowired FridgeIngredientRepository fridge;
    @Autowired StoreOfferService offers;
    @Autowired ObjectMapper json;
    @MockitoBean GeminiService gemini;
    @Test void mobileAndDesktopUseTheRealApiDatabaseAndDurableWorker() throws Exception {
        var rice = ingredients.saveAndFlush(new Ingredient(null, "ryż", List.of()));
        for (String locale : List.of("pl", "en")) {
            var user = new User(); user.setEmail("browser-planner-" + locale + "@example.com"); user.setPassword(passwords.encode("Browser-test-only-123!")); user.setRole(Role.USER); user = users.saveAndFlush(user);
            var stock = new FridgeIngredient(null, "ryż", null, 400d, Unit.GRAMS, user); stock.setQuantityAccuracy(QuantityAccuracy.EXACT); fridge.saveAndFlush(stock);
        }
        offers.publish(UUID.randomUUID(), new StoreOfferDto.Publish(0, Store.LIDL, rice.getId(), "Ryż — kontrolowane dane testowe", new BigDecimal("400"), "g", new BigDecimal("3.99"),
                1, 1, null, false, LocalDate.now(), LocalDate.now().plusDays(2), "https://www.lidl.pl/p/test-fixture", "Kontrolowane dane testowe, bez rzeczywistej promocji", Instant.now().minusSeconds(1), true, true, true,
                false, null, null, null, "DRY", false, null, null));
        AtomicInteger count = new AtomicInteger();
        when(gemini.generateRecipes(any(RecipeGenerationRequestDto.class), any())).thenAnswer(call -> {
            var request = call.getArgument(0, RecipeGenerationRequestDto.class);
            var recipe = new RecipeDto(null, "Danie testowe " + count.incrementAndGet(), List.of(new RecipeIngredientDto("ryż", 300, "g")), List.of("Ugotuj ryż."), "Kontrolowana odpowiedź AI", "20 min", 2);
            recipe.setLocale(ContentLocale.valueOf(request.getLocale())); return json.writeValueAsString(recipe);
        });
        Path frontend = Path.of(System.getProperty("user.dir")).resolve("../frontend/recipeai").normalize();
        String node = System.getenv().getOrDefault("PLANNER_TEST_NODE", "node");
        var builder = new ProcessBuilder(node, "node_modules/@playwright/test/cli.js", "test", "e2e/meal-planner-backend.spec.ts", "--reporter=line", "--workers=1").directory(frontend.toFile()).inheritIO();
        builder.environment().put("RECIPEAI_BROWSER_BACKEND", "http://127.0.0.1:18889");
        builder.environment().put("RECIPEAI_DEV_API_PROXY", "http://127.0.0.1:18889");
        builder.environment().put("PLAYWRIGHT_PORT", "5174");
        if (Path.of(node).getParent() != null) builder.environment().put("PATH", Path.of(node).getParent() + ":" + builder.environment().getOrDefault("PATH", ""));
        var process = builder.start();
        try { assertThat(process.waitFor(120, TimeUnit.SECONDS)).isTrue(); assertThat(process.exitValue()).isZero(); }
        finally { if (process.isAlive()) process.destroyForcibly(); }
    }
}
