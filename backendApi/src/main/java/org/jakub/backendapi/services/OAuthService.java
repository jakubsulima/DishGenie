package org.jakub.backendapi.services;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import org.jakub.backendapi.dto.UserDto;
import org.jakub.backendapi.entities.Enums.AuthMethod;
import org.jakub.backendapi.entities.Enums.Role;
import org.jakub.backendapi.entities.Enums.Diet;
import org.jakub.backendapi.entities.User;
import org.jakub.backendapi.entities.UserPreferences;
import org.jakub.backendapi.exceptions.AppException;
import org.jakub.backendapi.mappers.UserMapper;
import org.jakub.backendapi.repositories.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.Optional;
import java.util.List;

@Service
public class OAuthService {

    private static final Logger log = LoggerFactory.getLogger(OAuthService.class);
    private static final String GENERIC_GOOGLE_AUTH_FAILURE_MESSAGE =
            "Google sign-in failed. Please try again.";

    private final UserRepository userRepository;
    private final UserMapper userMapper;

    @Value("${oauth.google.client-id:}")
    private String googleClientId;

    public OAuthService(UserRepository userRepository, UserMapper userMapper) {
        this.userRepository = userRepository;
        this.userMapper = userMapper;
    }

    public UserDto authenticateGoogle(String idTokenString) {
        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                    new NetHttpTransport(), GsonFactory.getDefaultInstance())
                    .setAudience(Collections.singletonList(googleClientId))
                    .build();

            GoogleIdToken idToken = verifier.verify(idTokenString);
            if (idToken == null) {
                log.warn("Google sign-in failed: invalid ID token received");
                throw new AppException(GENERIC_GOOGLE_AUTH_FAILURE_MESSAGE, HttpStatus.UNAUTHORIZED);
            }

            GoogleIdToken.Payload payload = idToken.getPayload();
            String email = payload.getEmail();
            Boolean emailVerified = payload.getEmailVerified();

            if (email == null || !Boolean.TRUE.equals(emailVerified)) {
                log.warn("Google sign-in failed: email missing or not verified");
                throw new AppException(GENERIC_GOOGLE_AUTH_FAILURE_MESSAGE, HttpStatus.BAD_REQUEST);
            }

            return findOrCreateOAuthUser(email, AuthMethod.GOOGLE);
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Google sign-in failed while verifying token", e);
            throw new AppException(GENERIC_GOOGLE_AUTH_FAILURE_MESSAGE, HttpStatus.UNAUTHORIZED);
        }
    }

    private UserDto findOrCreateOAuthUser(String email, AuthMethod authMethod) {
        Optional<User> existingUser = userRepository.findByEmail(email);

        if (existingUser.isPresent()) {
            return userMapper.toUserDto(existingUser.get());
        }

        User user = new User();
        user.setEmail(email);
        user.setPassword(null);
        user.setRole(Role.USER);
        user.setAuthMethod(authMethod);

        UserPreferences userPreferences = new UserPreferences();
        userPreferences.setDiets(List.of(Diet.NONE));
        userPreferences.setUser(user);
        user.setUserPreferences(userPreferences);

        User savedUser = userRepository.save(user);
        return userMapper.toUserDto(savedUser);
    }
}
