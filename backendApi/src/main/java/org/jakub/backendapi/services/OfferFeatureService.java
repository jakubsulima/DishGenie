package org.jakub.backendapi.services;

import jakarta.validation.constraints.Min;
import org.jakub.backendapi.entities.OfferFeatureSetting;
import org.jakub.backendapi.entities.Enums.Role;
import org.jakub.backendapi.repositories.*;
import org.jakub.backendapi.exceptions.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;

@Service
public class OfferFeatureService {
    public record Access(boolean available) {}
    public record Setting(long version, boolean enabledForUsers, Instant updatedAt, String updatedBy) {}
    public record Update(@Min(0) long version, boolean enabledForUsers) {}
    private final OfferFeatureSettingRepository settings;
    private final UserRepository users;
    public OfferFeatureService(OfferFeatureSettingRepository settings, UserRepository users) {
        this.settings = settings; this.users = users;
    }
    @Transactional(readOnly = true)
    public boolean available(String email) {
        return settings.findById(1).map(OfferFeatureSetting::isEnabledForUsers).orElse(false) || isAdmin(email);
    }
    public void requireAvailable(String email) {
        if (!available(email)) throw new AppException("Store promotions are currently available to administrators only.", HttpStatus.FORBIDDEN);
    }
    @Transactional(readOnly = true)
    public Setting get() {
        return settings.findById(1).map(this::view).orElse(new Setting(0, false, null, null));
    }
    @Transactional
    public Setting update(String email, Update input) {
        if (!isAdmin(email)) throw new AppException("Administrator access required.", HttpStatus.FORBIDDEN);
        var value = settings.findById(1).orElseGet(OfferFeatureSetting::new);
        if (input.version() != value.getVersion()) throw new AppException("Promotion access changed. Reload the setting.", HttpStatus.CONFLICT);
        value.setEnabledForUsers(input.enabledForUsers()); value.setUpdatedAt(Instant.now()); value.setUpdatedBy(email);
        try { return view(settings.saveAndFlush(value)); }
        catch (org.springframework.dao.OptimisticLockingFailureException changed) {
            throw new AppException("Promotion access changed. Reload the setting.", HttpStatus.CONFLICT);
        }
    }
    private boolean isAdmin(String email) {
        return email != null && users.findByEmail(email).map(u -> u.getRole() == Role.ADMIN).orElse(false);
    }
    private Setting view(OfferFeatureSetting value) {
        return new Setting(value.getVersion(), value.isEnabledForUsers(), value.getUpdatedAt(), value.getUpdatedBy());
    }
}
