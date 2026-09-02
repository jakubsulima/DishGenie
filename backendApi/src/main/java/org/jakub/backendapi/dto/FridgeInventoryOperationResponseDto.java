package org.jakub.backendapi.dto;

import org.jakub.backendapi.entities.Enums.FridgeOperationStatus;

import java.util.List;

public class FridgeInventoryOperationResponseDto {
    private String operationId;
    private FridgeOperationStatus status;
    private List<FridgeInventoryChangeResultDto> appliedChanges;
    private List<FridgeInventoryChangeResultDto> skippedChanges;
    private List<FridgeIngredientDto> currentItems;

    public FridgeInventoryOperationResponseDto() {
    }

    public FridgeInventoryOperationResponseDto(
            String operationId,
            FridgeOperationStatus status,
            List<FridgeInventoryChangeResultDto> appliedChanges,
            List<FridgeInventoryChangeResultDto> skippedChanges,
            List<FridgeIngredientDto> currentItems
    ) {
        this.operationId = operationId;
        this.status = status;
        this.appliedChanges = appliedChanges;
        this.skippedChanges = skippedChanges;
        this.currentItems = currentItems;
    }

    public String getOperationId() { return operationId; }
    public FridgeOperationStatus getStatus() { return status; }
    public List<FridgeInventoryChangeResultDto> getAppliedChanges() { return appliedChanges; }
    public List<FridgeInventoryChangeResultDto> getSkippedChanges() { return skippedChanges; }
    public List<FridgeIngredientDto> getCurrentItems() { return currentItems; }
}
