package org.jakub.backendapi.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import org.jakub.backendapi.entities.Enums.FridgeOperationChangeType;
import org.jakub.backendapi.entities.Enums.QuantityAccuracy;
import org.jakub.backendapi.entities.Enums.FridgeStockState;

import java.time.LocalDate;

public class FridgeInventoryChangeRequestDto {
    @Size(max = 120, message = "Client change ID must not exceed 120 characters")
    private String clientChangeId;

    private FridgeOperationChangeType type;

    private Long fridgeItemId;

    @Size(max = 100, message = "Fridge item name must not exceed 100 characters")
    private String name;

    @PositiveOrZero(message = "Fridge item amount cannot be negative")
    private Double amount;

    @Pattern(
            regexp = "^$|(?i)(GRAMS|KILOGRAMS|LITERS|MILLILITERS|PIECES|g|kg|l|ml|pcs)",
            message = "Fridge item unit is invalid"
    )
    private String unit;

    @JsonFormat(pattern = "dd-MM-yyyy")
    private LocalDate expirationDate;

    @Size(max = 64, message = "Barcode must not exceed 64 characters")
    private String barcode;

    private QuantityAccuracy quantityAccuracy = QuantityAccuracy.UNKNOWN;

    private FridgeStockState stockState;

    public String getClientChangeId() { return clientChangeId; }

    public void setClientChangeId(String clientChangeId) { this.clientChangeId = clientChangeId; }

    public FridgeOperationChangeType getType() {
        return type;
    }

    public void setType(FridgeOperationChangeType type) {
        this.type = type;
    }

    public Long getFridgeItemId() {
        return fridgeItemId;
    }

    public void setFridgeItemId(Long fridgeItemId) {
        this.fridgeItemId = fridgeItemId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Double getAmount() {
        return amount;
    }

    public void setAmount(Double amount) {
        this.amount = amount;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public LocalDate getExpirationDate() {
        return expirationDate;
    }

    public void setExpirationDate(LocalDate expirationDate) {
        this.expirationDate = expirationDate;
    }

    public String getBarcode() {
        return barcode;
    }

    public void setBarcode(String barcode) {
        this.barcode = barcode;
    }

    public QuantityAccuracy getQuantityAccuracy() {
        return quantityAccuracy;
    }

    public void setQuantityAccuracy(QuantityAccuracy quantityAccuracy) {
        this.quantityAccuracy = quantityAccuracy == null ? QuantityAccuracy.UNKNOWN : quantityAccuracy;
    }

    public FridgeStockState getStockState() { return stockState; }
    public void setStockState(FridgeStockState stockState) { this.stockState = stockState; }
}
