package org.jakub.backendapi.entities;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;
@Entity
@Table(name = "recipe_generation_reservation")
public class RecipeGenerationReservation {
    @Id private UUID id;
    @Column(nullable = false) private Long userId;
    @Column(nullable = false) private String status;
    @Column(nullable = false) private LocalDate chargedOn;
    public UUID getId() { return id; }
    public void setId(UUID value) { id = value; }
    public Long getUserId() { return userId; }
    public void setUserId(Long value) { userId = value; }
    public String getStatus() { return status; }
    public void setStatus(String value) { status = value; }
    public LocalDate getChargedOn() { return chargedOn; }
    public void setChargedOn(LocalDate value) { chargedOn = value; }
}
