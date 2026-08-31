package org.jakub.backendapi.services;

import org.jakub.backendapi.entities.Enums.AuthMethod;
import org.jakub.backendapi.entities.User;
import org.jakub.backendapi.exceptions.AppException;
import org.jakub.backendapi.repositories.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;

@Service
public class PasswordResetService {
    private static final int TOKEN_BYTES = 32;
    private static final int EXPIRY_MINUTES = 30;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final PasswordResetMailService mailService;
    private final SecureRandom secureRandom = new SecureRandom();

    public PasswordResetService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            PasswordResetMailService mailService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailService = mailService;
    }

    @Transactional
    public void requestReset(String email, String locale) {
        userRepository.findByEmail(email.trim().toLowerCase())
                .filter(user -> user.getAuthMethod() == AuthMethod.CREDENTIALS)
                .ifPresent(user -> createAndSendToken(user, locale));
    }

    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        User user = userRepository.findByPasswordResetTokenHash(hash(rawToken))
                .orElseThrow(() -> new AppException("Invalid or expired password reset link.", HttpStatus.BAD_REQUEST));

        if (user.getPasswordResetExpiresAt() == null
                || !user.getPasswordResetExpiresAt().isAfter(LocalDateTime.now())) {
            clearResetToken(user);
            userRepository.save(user);
            throw new AppException("Invalid or expired password reset link.", HttpStatus.BAD_REQUEST);
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        clearResetToken(user);
        userRepository.save(user);
    }

    private void createAndSendToken(User user, String locale) {
        byte[] tokenBytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(tokenBytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
        user.setPasswordResetTokenHash(hash(token));
        user.setPasswordResetExpiresAt(LocalDateTime.now().plusMinutes(EXPIRY_MINUTES));
        userRepository.save(user);
        mailService.sendPasswordReset(user.getEmail(), token, locale);
    }

    private void clearResetToken(User user) {
        user.setPasswordResetTokenHash(null);
        user.setPasswordResetExpiresAt(null);
    }

    private String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }
}
