package org.jakub.backendapi.services;

import org.jakub.backendapi.entities.Enums.AuthMethod;
import org.jakub.backendapi.entities.User;
import org.jakub.backendapi.repositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PasswordResetServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private PasswordResetMailService mailService;

    private PasswordResetService passwordResetService;

    @BeforeEach
    void setUp() {
        passwordResetService = new PasswordResetService(userRepository, passwordEncoder, mailService);
    }

    @Test
    void createsAHashedSingleUseTokenAndSendsOnlyTheRawToken() {
        User user = new User();
        user.setEmail("cook@example.com");
        user.setAuthMethod(AuthMethod.CREDENTIALS);
        when(userRepository.findByEmail("cook@example.com")).thenReturn(Optional.of(user));

        passwordResetService.requestReset("COOK@example.com", "pl");

        ArgumentCaptor<String> rawToken = ArgumentCaptor.forClass(String.class);
        verify(mailService).sendPasswordReset(eq("cook@example.com"), rawToken.capture(), eq("pl"));
        assertThat(rawToken.getValue()).hasSizeGreaterThan(30);
        assertThat(user.getPasswordResetTokenHash())
                .hasSize(64)
                .doesNotContain(rawToken.getValue());
        assertThat(user.getPasswordResetExpiresAt()).isNotNull();
        verify(userRepository).save(user);
    }

    @Test
    void unknownEmailReturnsWithoutRevealingAccountExistence() {
        when(userRepository.findByEmail("missing@example.com")).thenReturn(Optional.empty());

        passwordResetService.requestReset("missing@example.com", "en");

        verifyNoInteractions(mailService);
        verify(userRepository, never()).save(any());
    }

    @Test
    void validTokenUpdatesPasswordAndCannotBeReused() {
        User user = new User();
        user.setPasswordResetExpiresAt(java.time.LocalDateTime.now().plusMinutes(5));
        when(userRepository.findByPasswordResetTokenHash(anyString())).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("NewSecret123!")).thenReturn("encoded");

        passwordResetService.resetPassword("raw-token", "NewSecret123!");

        assertThat(user.getPassword()).isEqualTo("encoded");
        assertThat(user.getPasswordResetTokenHash()).isNull();
        assertThat(user.getPasswordResetExpiresAt()).isNull();
        verify(userRepository).save(user);
    }
}
