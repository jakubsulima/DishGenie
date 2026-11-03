package org.jakub.backendapi.services;
import org.jakub.backendapi.entities.RecipeGenerationReservation;
import org.jakub.backendapi.repositories.*;
import org.jakub.backendapi.exceptions.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
/** Durable accounting for a logical operation, independent of worker restarts and provider attempts. */
@Service
public class RecipeGenerationQuotaService {
    private final UserRepository repository;
    private final UserService users;
    private final RecipeGenerationReservationRepository reservations;
    public RecipeGenerationQuotaService(UserRepository repository, UserService users, RecipeGenerationReservationRepository reservations) {
        this.repository = repository; this.users = users; this.reservations = reservations;
    }
    public static UUID key(String operation) { return UUID.nameUUIDFromBytes(operation.getBytes(StandardCharsets.UTF_8)); }
    @Transactional
    public void reserve(String email, UUID operation) {
        var owner = repository.findByEmailForUpdate(email).orElseThrow();
        var reservation = reservations.findById(operation).orElse(null);
        if (reservation != null) {
            if (!reservation.getUserId().equals(owner.getId())) throw new AppException("Operation unavailable.", HttpStatus.CONFLICT);
            if (!reservation.getStatus().equals("RELEASED")) return;
        } else { reservation = new RecipeGenerationReservation(); reservation.setId(operation); reservation.setUserId(owner.getId()); }
        users.reserveRecipeGeneration(email);
        reservation.setChargedOn(LocalDate.now()); reservation.setStatus("RESERVED"); reservations.saveAndFlush(reservation);
    }
    @Transactional
    public void complete(String email, UUID operation) {
        var owner = repository.findByEmailForUpdate(email).orElseThrow(); var reservation = reservations.findById(operation).orElseThrow();
        if (!reservation.getUserId().equals(owner.getId())) throw new AppException("Operation unavailable.", HttpStatus.CONFLICT);
        reservation.setStatus("COMPLETED");
    }
    @Transactional
    public void release(String email, UUID operation) {
        var owner = repository.findByEmailForUpdate(email).orElseThrow();
        reservations.findById(operation).filter(r -> r.getUserId().equals(owner.getId()) && r.getStatus().equals("RESERVED")).ifPresent(r -> {
            // UserService's daily counter uses the server's LocalDate, so accounting uses the same clock.
            if (r.getChargedOn().equals(LocalDate.now())) users.releaseRecipeGeneration(email);
            r.setStatus("RELEASED");
        });
    }
}
