package org.jakub.backendapi.entities;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** A bounded, versioned aggregate: at most fourteen meal slots and their snapshots. */
@Entity
@Table(name = "meal_plan")
public class MealPlan {
    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY)
    @org.hibernate.annotations.OnDelete(action = org.hibernate.annotations.OnDeleteAction.CASCADE)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @Version
    private long version;
    @Column(nullable = false)
    private Instant createdAt;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String document;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public long getVersion() { return version; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public String getDocument() { return document; }
    public void setDocument(String document) { this.document = document; }
}
