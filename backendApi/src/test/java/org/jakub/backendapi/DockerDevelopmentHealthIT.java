package org.jakub.backendapi;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Local development does not require an SMTP service to plan meals or log in. */
@ActiveProfiles("docker")
@SpringBootTest(properties={
        "security.jwt.token.secret-key=docker-health-isolated-test-secret-at-least-32",
        "spring.datasource.url=jdbc:h2:mem:docker-health",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false",
        "spring.mail.host=127.0.0.1", "spring.mail.port=9",
        "spring.mail.properties.mail.smtp.connectiontimeout=200",
        "spring.mail.properties.mail.smtp.timeout=200",
        "app.planner.jobs-enabled=false", "app.offers.lidl-price-import-enabled=false", "posthog.enabled=false"})
@AutoConfigureMockMvc
class DockerDevelopmentHealthIT {
    @Autowired MockMvc mvc;
    @Test void healthDoesNotRequireOptionalLocalSmtp() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"));
    }
}
