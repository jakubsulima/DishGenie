package org.jakub.backendapi.entities;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "offer_feature_setting")
public class OfferFeatureSetting {
    @Id private Integer id = 1;
    @Version private long version;
    @Column(nullable = false) private boolean enabledForUsers = false;
    @Column(nullable = false) private Instant updatedAt = Instant.now();
    @Column(length = 320) private String updatedBy;
    public Integer getId() { return id; }
    public long getVersion() { return version; }
    public boolean isEnabledForUsers() { return enabledForUsers; }
    public void setEnabledForUsers(boolean value) { enabledForUsers = value; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant value) { updatedAt = value; }
    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String value) { updatedBy = value; }
}
