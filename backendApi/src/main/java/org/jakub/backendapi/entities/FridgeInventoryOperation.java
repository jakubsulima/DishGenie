package org.jakub.backendapi.entities;

import jakarta.persistence.*;
import org.jakub.backendapi.entities.Enums.FridgeOperationSource;
import org.jakub.backendapi.entities.Enums.FridgeOperationStatus;

import java.time.Instant;

@Entity
@Table(name = "fridge_inventory_operation", uniqueConstraints = {
        @UniqueConstraint(name = "uk_fridge_inventory_operation_user_client", columnNames = {"user_id", "client_operation_id"})
})
public class FridgeInventoryOperation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "client_operation_id", nullable = false, length = 36)
    private String clientOperationId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private FridgeOperationSource source;

    @Column(name = "source_reference", length = 100)
    private String sourceReference;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private FridgeOperationStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "result_json", nullable = false, columnDefinition = "TEXT")
    private String resultJson;

    @Column(name = "undo_operation_id", length = 36)
    private String undoOperationId;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public String getClientOperationId() { return clientOperationId; }
    public void setClientOperationId(String clientOperationId) { this.clientOperationId = clientOperationId; }
    public FridgeOperationSource getSource() { return source; }
    public void setSource(FridgeOperationSource source) { this.source = source; }
    public String getSourceReference() { return sourceReference; }
    public void setSourceReference(String sourceReference) { this.sourceReference = sourceReference; }
    public FridgeOperationStatus getStatus() { return status; }
    public void setStatus(FridgeOperationStatus status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public String getResultJson() { return resultJson; }
    public void setResultJson(String resultJson) { this.resultJson = resultJson; }
    public String getUndoOperationId() { return undoOperationId; }
    public void setUndoOperationId(String undoOperationId) { this.undoOperationId = undoOperationId; }
}
