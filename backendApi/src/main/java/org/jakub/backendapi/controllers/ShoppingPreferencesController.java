package org.jakub.backendapi.controllers;
import jakarta.validation.Valid;
import org.jakub.backendapi.dto.*;
import org.jakub.backendapi.services.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;
@RestController
@RequestMapping("/v2/shopping-preferences")
public class ShoppingPreferencesController {
    private final ShoppingPreferencesService preferences;
    public ShoppingPreferencesController(ShoppingPreferencesService preferences) { this.preferences = preferences; }
    private String email(Authentication user) { return user.getPrincipal() instanceof UserDto dto ? dto.getEmail() : user.getName(); }
    @GetMapping public MealPlanDto.Create get(Authentication user) { return preferences.get(email(user)); }
    @PutMapping public MealPlanDto.Create save(Authentication user, @Valid @RequestBody MealPlanDto.Create input) {
        return preferences.save(email(user), input);
    }
}
