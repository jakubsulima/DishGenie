package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.MealPlanDto.Store;
import org.jakub.backendapi.dto.StoreOfferDto.*;
import org.jakub.backendapi.entities.StoreOffer;
import org.jakub.backendapi.repositories.*;
import org.jakub.backendapi.exceptions.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import java.net.URI;
import java.time.*;
import java.util.*;

@Service
public class StoreOfferService {
    public static final Duration MAX_AGE = Duration.ofHours(48);
    private final StoreOfferRepository offers;
    private final IngredientRepository ingredients;
    private final ObjectMapper json;
    public StoreOfferService(StoreOfferRepository offers, IngredientRepository ingredients, ObjectMapper json) {
        this.offers = offers; this.ingredients = ingredients; this.json = json;
    }
    @Transactional
    public Offer publish(UUID id, Publish input) {
        Instant now = Instant.now();
        if (input.validTo().isBefore(input.validFrom()) || input.verifiedAt().isAfter(now)
                || input.verifiedAt().isBefore(now.minus(MAX_AGE))) bad("Invalid offer dates or stale verification.");
        if (!input.nationwide() || !input.fixedPackage() || !input.conditionsVerified()) bad("Only verified nationwide packaged offers are supported.");
        if (!ingredients.existsById(input.ingredientId())) bad("Unknown ingredient mapping.");
        if (input.maximumPackages() != null && (input.maximumPackages() < input.minimumPackages()
                || input.minimumPackages() + (input.packageMultiple() - input.minimumPackages() % input.packageMultiple()) % input.packageMultiple() > input.maximumPackages()))
            bad("Package limits cannot satisfy this offer.");
        if (input.unit().equals("pcs") && input.packageAmount().stripTrailingZeros().scale() > 0) bad("Package piece count must be whole.");
        validateSource(input);
        StoreOffer entity = offers.findById(id).orElse(null);
        if (entity == null) {
            if (input.version() != 0) throw new AppException("Offer no longer exists.", HttpStatus.CONFLICT);
            entity = new StoreOffer(); entity.setId(id);
        } else if (entity.getVersion() != input.version()) throw new AppException("Offer changed. Reload before editing.", HttpStatus.CONFLICT);
        entity.setStore(input.store()); entity.setValidFrom(input.validFrom()); entity.setValidTo(input.validTo());
        entity.setVerifiedAt(input.verifiedAt()); entity.setActive(true); entity.setDocument(json.writeValueAsString(input));
        return view(offers.saveAndFlush(entity));
    }
    @Transactional
    public void withdraw(UUID id, long version) {
        StoreOffer entity = offers.findById(id).orElseThrow(() -> new AppException("Offer not found.", HttpStatus.NOT_FOUND));
        if (entity.getVersion() != version) throw new AppException("Offer changed.", HttpStatus.CONFLICT);
        entity.setActive(false); offers.saveAndFlush(entity);
    }
    @Transactional(readOnly = true)
    public List<Offer> recent() { return offers.findTop100ByOrderByVerifiedAtDesc().stream().map(this::view).toList(); }
    @Transactional(readOnly = true)
    public List<Offer> eligible(Set<Store> stores, LocalDate day, Instant now) {
        return offers.findByActiveTrueAndStoreInAndValidFromLessThanEqualAndValidToGreaterThanEqualAndVerifiedAtGreaterThanEqual(
                stores, day, day, now.minus(MAX_AGE)).stream().map(this::view).toList();
    }
    private Offer view(StoreOffer entity) {
        return new Offer(entity.getId(), entity.getVersion(), entity.isActive(), json.readValue(entity.getDocument(), Publish.class));
    }
    private void validateSource(Publish input) {
        try {
            URI uri = URI.create(input.sourceUrl());
            String host = input.store() == Store.LIDL ? "www.lidl.pl" : "www.biedronka.pl";
            if (!"https".equals(uri.getScheme()) || !host.equals(uri.getHost()) || uri.getUserInfo() != null
                    || (uri.getPort() != -1 && uri.getPort() != 443)) bad("Use an official HTTPS product or leaflet URL.");
        } catch (IllegalArgumentException ex) { bad("Invalid source URL."); }
    }
    private void bad(String message) { throw new AppException(message, HttpStatus.BAD_REQUEST); }
}
