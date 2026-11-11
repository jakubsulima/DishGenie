package org.jakub.backendapi.controllers;

import jakarta.validation.Valid;
import org.jakub.backendapi.services.OfferFeatureService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
public class OfferFeatureController {
    private final OfferFeatureService feature;
    public OfferFeatureController(OfferFeatureService feature) { this.feature = feature; }
    @GetMapping("/v2/offers/access")
    public OfferFeatureService.Access access(Authentication user) { return new OfferFeatureService.Access(feature.available(email(user))); }
    @GetMapping("/admin/features/store-offers")
    public OfferFeatureService.Setting get() { return feature.get(); }
    @PutMapping("/admin/features/store-offers")
    public OfferFeatureService.Setting update(Authentication user, @Valid @RequestBody OfferFeatureService.Update input) {
        return feature.update(email(user), input);
    }
    private String email(Authentication user) {
        return user.getPrincipal() instanceof org.jakub.backendapi.dto.UserDto dto ? dto.getEmail() : user.getName();
    }
}
