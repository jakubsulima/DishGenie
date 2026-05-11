package org.jakub.backendapi.controllers;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.jakub.backendapi.config.JwtUtils;
import org.jakub.backendapi.config.UserAuthProvider;
import org.jakub.backendapi.dto.CredentialsDto;
import org.jakub.backendapi.dto.ErrorDto;
import org.jakub.backendapi.dto.OAuthLoginDto;
import org.jakub.backendapi.dto.SignUpDto;
import org.jakub.backendapi.dto.UserDto;
import org.jakub.backendapi.exceptions.AppException;
import org.jakub.backendapi.services.OAuthService;
import org.jakub.backendapi.services.UserService;
import org.jakub.backendapi.services.RateLimitService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Map;
import java.util.Set;

@RestController
public class AuthController {
    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final UserService userService;
    private final UserAuthProvider userAuthProvider;
    private final OAuthService oAuthService;
    private final RateLimitService rateLimitService;

    @Value("${app.security.trusted-proxies:127.0.0.1,0:0:0:0:0:0:0:1}")
    private String trustedProxyIps;

    public AuthController(UserService userService, UserAuthProvider userAuthProvider, OAuthService oAuthService, RateLimitService rateLimitService) {
        this.userService = userService;
        this.userAuthProvider = userAuthProvider;
        this.oAuthService = oAuthService;
        this.rateLimitService = rateLimitService;
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(forwardedFor) && isFromTrustedProxy(request.getRemoteAddr())) {
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private boolean isFromTrustedProxy(String remoteAddr) {
        Set<String> trusted = Arrays.stream(trustedProxyIps.split(","))
                .map(String::trim)
                .collect(java.util.stream.Collectors.toSet());
        return trusted.contains(remoteAddr);
    }

    // Login endpoint: generates an access token and refresh token
    @PostMapping("/login")
    public ResponseEntity<UserDto> login(@Valid @RequestBody CredentialsDto credentialsDto, HttpServletRequest request, HttpServletResponse response) {
        String clientIp = resolveClientIp(request);
        rateLimitService.assertAllowed(
            "login_" + clientIp,
            10, // Max 10 attempts
            15 * 60 * 1000L, // per 15 minutes
            "Przekroczono limit prób logowania. Spróbuj ponownie później."
        );

        UserDto user = userService.login(credentialsDto);

        CreateToken(response, user.getEmail()); // Pass email directly

        return ResponseEntity.ok(user);
    }

    // Register endpoint: generates an access token and refresh token
    @PostMapping("/register")
    public ResponseEntity<UserDto> register(@Valid @RequestBody SignUpDto signUpDto, HttpServletRequest request, HttpServletResponse response) {
        String clientIp = resolveClientIp(request);
        rateLimitService.assertAllowed(
            "register_" + clientIp,
            5, // Max 5 attempts
            60 * 60 * 1000L, // per 1 hour
            "Przekroczono limit prób rejestracji. Spróbuj ponownie później."
        );

        UserDto user = userService.register(signUpDto);
        CreateToken(response, user.getEmail()); // Pass email directly

        return ResponseEntity.created(URI.create("/users/" + user.getId())).body(user);
    }

    private void CreateToken(HttpServletResponse response, String email) {
        String accessToken = userAuthProvider.createToken(email);
        String refreshToken = userAuthProvider.createRefreshToken(email);

        ArrayList<ResponseCookie> tokens = userAuthProvider.setHttpOnlyCookie(accessToken, refreshToken);

        response.addHeader(HttpHeaders.SET_COOKIE, tokens.get(0).toString());
        response.addHeader(HttpHeaders.SET_COOKIE, tokens.get(1).toString());
    }

    @PostMapping("/oauth/google")
    public ResponseEntity<UserDto> oauthGoogle(@Valid @RequestBody OAuthLoginDto oAuthLoginDto, HttpServletRequest request, HttpServletResponse response) {
        String clientIp = resolveClientIp(request);
        rateLimitService.assertAllowed(
            "login_" + clientIp,
            10, // Max 10 attempts
            15 * 60 * 1000L, // per 15 minutes
            "Przekroczono limit prób logowania. Spróbuj ponownie później."
        );

        UserDto user = oAuthService.authenticateGoogle(oAuthLoginDto.getIdToken());
        CreateToken(response, user.getEmail());
        return ResponseEntity.ok(user);
    }

    // Refresh token endpoint: accepts refresh token from HttpOnly cookie and returns new tokens
    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(@CookieValue(value = "refresh_token", required = false) String refreshToken,
                                          HttpServletResponse response) {
        if (refreshToken == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing refresh token cookie"));
        }

        try {
            String newAccessToken = userAuthProvider.refreshAccessToken(refreshToken);
            String newRefreshToken = userAuthProvider.refreshRefreshToken(refreshToken);

            ArrayList<ResponseCookie> tokens = userAuthProvider.setHttpOnlyCookie(newAccessToken, newRefreshToken);

            response.addHeader(HttpHeaders.SET_COOKIE, tokens.get(0).toString());
            response.addHeader(HttpHeaders.SET_COOKIE, tokens.get(1).toString());

            return ResponseEntity.ok().build();

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid or expired refresh token"));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        return ResponseEntity.ok().body(Map.of("message", "Logged out successfully"));
    }

    @GetMapping("/me")
    public ResponseEntity<?> getUser(HttpServletRequest request) { // Changed return type to ResponseEntity<?>
        String token = JwtUtils.getTokenFromCookies(request, "access_token");
        if (token == null) {
            // It's better to return 401 if authentication is expected but no token is provided for /me
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorDto("Access token missing."));
        }

        String emailFromToken = JwtUtils.getLoginFromToken(token); // 'getLoginFromToken' actually returns the issuer/email

        if (emailFromToken == null) {
            // This means the token's issuer was null, which is an invalid state for an access token.
            // Log this as a server-side issue (token should always have an issuer).
            log.error("Access token found with null issuer.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorDto("Invalid token: User identifier missing."));
        }

        try {
            UserDto userDto = userService.getUserProfileByEmail(emailFromToken);
            return ResponseEntity.ok(userDto);
        } catch (AppException e) {
            // Handle cases where user might not be found based on a valid-looking email from token (e.g., user deleted after token issuance)
            return ResponseEntity.status(e.getCode() != null ? e.getCode() : HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorDto(e.getMessage()));
        }
    }

}
