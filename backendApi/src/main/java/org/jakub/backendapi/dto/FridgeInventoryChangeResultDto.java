package org.jakub.backendapi.dto;

import org.jakub.backendapi.entities.Enums.FridgeOperationChangeType;

public class FridgeInventoryChangeResultDto {
    private FridgeOperationChangeType type;
    private Long fridgeItemId;
    private String status;
    private String reason;
    private String clientChangeId;

    public FridgeInventoryChangeResultDto() {
    }

    public FridgeInventoryChangeResultDto(FridgeOperationChangeType type, Long fridgeItemId, String status, String reason) {
        this.type = type;
        this.fridgeItemId = fridgeItemId;
        this.status = status;
        this.reason = reason;
    }

    public FridgeInventoryChangeResultDto(FridgeOperationChangeType type, Long fridgeItemId, String status, String reason, String clientChangeId) {
        this(type, fridgeItemId, status, reason);
        this.clientChangeId = clientChangeId;
    }

    public FridgeOperationChangeType getType() { return type; }
    public Long getFridgeItemId() { return fridgeItemId; }
    public String getStatus() { return status; }
    public String getReason() { return reason; }
    public String getClientChangeId() { return clientChangeId; }
}
