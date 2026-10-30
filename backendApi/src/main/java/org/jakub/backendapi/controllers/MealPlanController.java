package org.jakub.backendapi.controllers;

import jakarta.validation.Valid;
import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.services.MealPlanService;
import org.jakub.backendapi.services.MealPlanGenerationService;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;
import org.jakub.backendapi.dto.UserDto;
import org.jakub.backendapi.dto.StoreOfferDto;
import org.jakub.backendapi.services.MealPlanPricingService;
import java.util.*;

@RestController
@RequestMapping("/v2/meal-plans")
public class MealPlanController {
    private final MealPlanService plans;
    private final MealPlanGenerationService generation;
    private final MealPlanPricingService pricing;
    public MealPlanController(MealPlanService plans, MealPlanGenerationService generation, MealPlanPricingService pricing) {
        this.plans = plans; this.generation = generation; this.pricing = pricing;
    }
    private String email(Authentication user) {
        return user.getPrincipal() instanceof UserDto dto ? dto.getEmail() : user.getName();
    }
    @PostMapping("/{id}/quote")
    public StoreOfferDto.Quote quote(Authentication user, @PathVariable UUID id, @Valid @RequestBody StoreOfferDto.QuoteRequest input) {
        return pricing.quote(email(user), id, input);
    }
    @GetMapping
    public List<Summary> list(Authentication user) { return plans.list(email(user)); }
    @PostMapping
    public View create(Authentication user, @Valid @RequestBody Create input) { return plans.create(email(user), input); }
    @GetMapping("/{id}")
    public View get(Authentication user, @PathVariable UUID id) { return plans.get(email(user), id); }
    @PostMapping("/{id}/slots/{slotId}")
    public View change(Authentication user, @PathVariable UUID id, @PathVariable UUID slotId, @Valid @RequestBody Change input) {
        return plans.change(email(user), id, slotId, input);
    }
    @PostMapping("/{id}/slots/{slotId}/generate")
    public View generate(Authentication user, @PathVariable UUID id, @PathVariable UUID slotId, @Valid @RequestBody Generate input) {
        return generation.generate(email(user), id, slotId, input);
    }
    @PostMapping("/{id}/accept")
    public View accept(Authentication user, @PathVariable UUID id, @Valid @RequestBody Version input) { return plans.accept(email(user), id, input); }
    @PostMapping("/{id}/shopping-list/refresh")
    public View refresh(Authentication user, @PathVariable UUID id, @Valid @RequestBody Version input) { return plans.refreshShopping(email(user), id, input); }
    @PostMapping("/{id}/shopping-list/check")
    public View check(Authentication user, @PathVariable UUID id, @Valid @RequestBody Check input) { return plans.checkShopping(email(user), id, input); }
}
