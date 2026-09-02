package org.jakub.backendapi.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.jakub.backendapi.entities.Enums.FridgeOperationSource;

import java.util.ArrayList;
import java.util.List;

public class FridgeInventoryOperationRequestDto {
    @NotBlank(message = "Operation ID is required")
    @Size(max = 36, message = "Operation ID must be a UUID")
    private String operationId;

    @NotNull(message = "Operation source is required")
    private FridgeOperationSource source;

    @Size(max = 100, message = "Operation source reference must not exceed 100 characters")
    private String sourceReference;

    @NotEmpty(message = "At least one fridge change is required")
    @Size(max = 50, message = "An operation cannot contain more than 50 changes")
    @Valid
    private List<FridgeInventoryChangeRequestDto> changes = new ArrayList<>();

    public String getOperationId() {
        return operationId;
    }

    public void setOperationId(String operationId) {
        this.operationId = operationId;
    }

    public FridgeOperationSource getSource() {
        return source;
    }

    public void setSource(FridgeOperationSource source) {
        this.source = source;
    }

    public String getSourceReference() {
        return sourceReference;
    }

    public void setSourceReference(String sourceReference) {
        this.sourceReference = sourceReference;
    }

    public List<FridgeInventoryChangeRequestDto> getChanges() {
        return changes;
    }

    public void setChanges(List<FridgeInventoryChangeRequestDto> changes) {
        this.changes = changes;
    }
}
