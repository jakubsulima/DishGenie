package org.jakub.backendapi.entities;

import jakarta.persistence.*;
import org.jakub.backendapi.dto.MealPlanDto.Store;
import java.time.*;
import java.util.UUID;

@Entity
@Table(name = "store_offer")
public class StoreOffer {
    @Id private UUID id;
    @Version private long version;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private Store store;
    @Column(nullable = false) private LocalDate validFrom;
    @Column(nullable = false) private LocalDate validTo;
    @Column(nullable = false) private Instant verifiedAt;
    @Column(nullable = false) private boolean active;
    @Column(nullable = false, columnDefinition = "TEXT") private String document;
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public long getVersion() { return version; }
    public Store getStore() { return store; }
    public void setStore(Store store) { this.store = store; }
    public LocalDate getValidFrom() { return validFrom; }
    public void setValidFrom(LocalDate value) { validFrom = value; }
    public LocalDate getValidTo() { return validTo; }
    public void setValidTo(LocalDate value) { validTo = value; }
    public Instant getVerifiedAt() { return verifiedAt; }
    public void setVerifiedAt(Instant value) { verifiedAt = value; }
    public boolean isActive() { return active; }
    public void setActive(boolean value) { active = value; }
    public String getDocument() { return document; }
    public void setDocument(String value) { document = value; }
}
