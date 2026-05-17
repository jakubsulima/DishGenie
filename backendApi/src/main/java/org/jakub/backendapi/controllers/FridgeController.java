package org.jakub.backendapi.controllers;

import jakarta.servlet.http.HttpServletRequest;
import org.jakub.backendapi.dto.FridgeIngredientDto;
import org.jakub.backendapi.dto.UserDto;
import org.jakub.backendapi.entities.FridgeIngredient;
import org.jakub.backendapi.mappers.FridgeIngredientMapper;
import org.jakub.backendapi.services.FridgeService;
import org.jakub.backendapi.services.GeminiService;
import org.jakub.backendapi.services.RateLimitService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.jakub.backendapi.config.JwtUtils.getLoginFromToken;

@RestController
public class FridgeController {
    private static final int RECEIPT_SCAN_LIMIT_PER_MINUTE = 10;

    private final FridgeService fridgeService;
    private final FridgeIngredientMapper fridgeIngredientMapper;
    private final GeminiService geminiService;
    private final RateLimitService rateLimitService;

    @Value("${security.trusted-proxy-ips:}")
    private String trustedProxyIps;

    public FridgeController(FridgeService fridgeService, FridgeIngredientMapper fridgeIngredientMapper, GeminiService geminiService, RateLimitService rateLimitService) {
        this.fridgeService = fridgeService;
        this.fridgeIngredientMapper = fridgeIngredientMapper;
        this.geminiService = geminiService;
        this.rateLimitService = rateLimitService;
    }

    @GetMapping("/getFridgeIngredients")
    public ResponseEntity<List<FridgeIngredientDto>> getFridgeIngredients(HttpServletRequest request) {
        List<FridgeIngredientDto> fridgeIngredients = fridgeService.getFridgeIngredients(getLoginFromToken(request));
        return ResponseEntity.ok(fridgeIngredients);
    }

    @PostMapping("/addFridgeIngredient")
    public ResponseEntity<FridgeIngredientDto> addFridgeIngredient(@RequestBody FridgeIngredientDto fridgeIngredientDto, HttpServletRequest request) {
        fridgeService.addFridgeIngredient(fridgeIngredientDto, getLoginFromToken(request));
        return ResponseEntity.ok(fridgeIngredientDto);
    }

    @DeleteMapping("/deleteFridgeIngredient/{ingredientId}")
    public ResponseEntity<FridgeIngredientDto> deleteFridgeIngredient(@PathVariable Long ingredientId, HttpServletRequest request) {
        fridgeService.deleteFridgeIngredient(ingredientId, getLoginFromToken(request));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/updateFridgeIngredient/{ingredientId}")
    public ResponseEntity<FridgeIngredientDto> updateFridgeIngredient(@PathVariable Long ingredientId, @RequestBody FridgeIngredientDto fridgeIngredientDto, HttpServletRequest request) {
        FridgeIngredient updatedIngredient = fridgeService.updateFridgeIngredient(ingredientId, fridgeIngredientDto, getLoginFromToken(request));
        if (updatedIngredient == null) {
            return ResponseEntity.noContent().build();
        }

        return ResponseEntity.ok(fridgeIngredientMapper.toFridgeIngredientDto(updatedIngredient));
    }

    @PostMapping(value = "/scanFridgeReceipt", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<List<FridgeIngredientDto>> scanFridgeReceipt(@RequestPart("file") MultipartFile file, HttpServletRequest request) {
        String clientKey = resolveClientKey(request);
        rateLimitService.assertAllowed(
                "scanFridgeReceipt:" + clientKey,
                RECEIPT_SCAN_LIMIT_PER_MINUTE,
                60_000L,
                "Too many receipt scans. Please wait and try again."
        );

        List<FridgeIngredientDto> detectedItems = geminiService.extractFridgeIngredientsFromReceipt(file);
        return ResponseEntity.ok(detectedItems);
    }

    private String resolveClientKey(HttpServletRequest request) {
        String userEmail = getAuthenticatedUserEmail();
        if (StringUtils.hasText(userEmail)) {
            return userEmail;
        }

        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(forwardedFor) && isFromTrustedProxy(request.getRemoteAddr())) {
            return forwardedFor.split(",")[0].trim();
        }

        return request.getRemoteAddr();
    }

    private String getAuthenticatedUserEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof UserDto userDto) {
            return userDto.getEmail();
        }

        return null;
    }

    private boolean isFromTrustedProxy(String remoteAddr) {
        Set<String> trusted = Arrays.stream(trustedProxyIps.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .collect(Collectors.toSet());

        return trusted.contains(remoteAddr);
    }

}
