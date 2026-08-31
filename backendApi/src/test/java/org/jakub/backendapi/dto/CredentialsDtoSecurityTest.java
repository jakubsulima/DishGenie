package org.jakub.backendapi.dto;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CredentialsDtoSecurityTest {

    @Test
    void stringRepresentationNeverContainsThePassword() {
        CredentialsDto credentials = new CredentialsDto("cook@example.com", "Secret123!".toCharArray());

        assertThat(credentials.toString())
                .contains("cook@example.com")
                .doesNotContain("Secret123!")
                .contains("[REDACTED]");
    }
}
