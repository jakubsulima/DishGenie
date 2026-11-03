package org.jakub.backendapi.entities;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity
@Table(name = "meal_plan_generation")
public class MealPlanGeneration {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "plan_id", nullable = false) private MealPlan plan;
    @Column(nullable = false) private String status;
    @Column(nullable = false, columnDefinition = "TEXT") private String document;
     private Instant leaseUntil;
     private UUID leaseToken;
    @Column(nullable = false) private Instant createdAt;
    public UUID getId() { return id; }
    public void setId(UUID value) { id = value; }
    public MealPlan getPlan() { return plan; }
    public void setPlan(MealPlan value) { plan = value; }
    public String getStatus() { return status; }
    public void setStatus(String value) { status = value; }
    public String getDocument() { return document; }
    public void setDocument(String value) { document = value; }
    public Instant getLeaseUntil() { return leaseUntil; }
    public void setLeaseUntil(Instant value) { leaseUntil = value; }
    public UUID getLeaseToken() { return leaseToken; }
    public void setLeaseToken(UUID value) { leaseToken = value; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant value) { createdAt = value; }
}
