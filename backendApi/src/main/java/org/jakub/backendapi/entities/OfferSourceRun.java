package org.jakub.backendapi.entities;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity
@Table(name = "offer_source_run")
public class OfferSourceRun {
    @Version private long version;
    public long getVersion() { return version; }
    @Id private UUID id;
    @Column(nullable = false) private String status;
    @Column(nullable = false, columnDefinition = "TEXT") private String document;


    @Column(nullable = false) private Instant createdAt;
    public UUID getId() { return id; }
    public void setId(UUID value) { id = value; }
    public String getStatus() { return status; }
    public void setStatus(String value) { status = value; }
    public String getDocument() { return document; }
    public void setDocument(String value) { document = value; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant value) { createdAt = value; }
}
