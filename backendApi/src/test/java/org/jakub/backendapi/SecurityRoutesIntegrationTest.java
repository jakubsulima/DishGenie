package org.jakub.backendapi;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "oauth.google.client-id=test-client-id",
        "posthog.enabled=false"
})
@AutoConfigureMockMvc
class SecurityRoutesIntegrationTest {

    private static final String TEST_JWT_SECRET = UUID.randomUUID().toString() + UUID.randomUUID();

    @DynamicPropertySource
    static void registerTestProperties(DynamicPropertyRegistry registry) {
        registry.add("security.jwt.token.secret-key", () -> TEST_JWT_SECRET);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void publicRecipesRemainAvailableWithoutAuthentication() throws Exception {
        mockMvc.perform(get("/getAllRecipes"))
                .andExpect(status().isOk());
    }

    @Test
    void fridgeRemainsProtectedWithoutAuthentication() throws Exception {
        mockMvc.perform(get("/getFridgeIngredients"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void passwordResetRequestIsPublicGenericAndCsrfProtected() throws Exception {
        mockMvc.perform(post("/forgot-password")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"missing@example.com\",\"locale\":\"pl\"}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.message").value(
                        "If an eligible account exists, a password reset link has been sent."
                ));

        mockMvc.perform(post("/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"missing@example.com\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void recipeGenerationRejectsAnInvalidClientPromptBeforeCallingAi() throws Exception {
        mockMvc.perform(post("/generateRecipe")
                        .with(user("cook@example.com").roles("USER"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"prompt\":\" \",\"locale\":\"pl\",\"count\":3}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Prompt is required"));
    }
}
