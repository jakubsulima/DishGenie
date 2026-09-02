package org.jakub.backendapi.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class FridgeInventoryUndoRequestDto {
    @NotBlank
    @Size(max = 36)
    private String operationId;

    public String getOperationId() { return operationId; }
    public void setOperationId(String operationId) { this.operationId = operationId; }
}
