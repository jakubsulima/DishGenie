package org.jakub.backendapi.entities;

import jakarta.persistence.*;
import org.jakub.backendapi.entities.Enums.FridgeOperationChangeType;
import org.jakub.backendapi.entities.Enums.Unit;
import org.jakub.backendapi.entities.Enums.FridgeStockState;
import org.jakub.backendapi.entities.Enums.FridgeOperationSource;
import org.jakub.backendapi.entities.Enums.QuantityAccuracy;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "fridge_inventory_operation_change")
public class FridgeInventoryOperationChange {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "operation_id", nullable = false)
    private FridgeInventoryOperation operation;

    @Enumerated(EnumType.STRING)
    @Column(name = "change_type", nullable = false, length = 16)
    private FridgeOperationChangeType changeType;

    @Column(name = "fridge_item_id")
    private Long fridgeItemId;

    @Column(name = "before_exists", nullable = false)
    private boolean beforeExists;

    @Column(name = "before_name", length = 100)
    private String beforeName;

    @Column(name = "before_amount")
    private Double beforeAmount;

    @Enumerated(EnumType.STRING)
    @Column(name = "before_unit", length = 20)
    private Unit beforeUnit;

    @Column(name = "before_expiration_date")
    private LocalDate beforeExpirationDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "before_stock_state", length = 16)
    private FridgeStockState beforeStockState;

    @Enumerated(EnumType.STRING)
    @Column(name = "before_source", length = 32)
    private FridgeOperationSource beforeSource;

    @Enumerated(EnumType.STRING)
    @Column(name = "before_quantity_accuracy", length = 16)
    private QuantityAccuracy beforeQuantityAccuracy;

    @Column(name = "before_barcode", length = 64)
    private String beforeBarcode;

    @Column(name = "before_last_confirmed_at")
    private Instant beforeLastConfirmedAt;

    @Column(name = "before_ingredient_id")
    private Long beforeIngredientId;

    @Column(name = "after_exists", nullable = false)
    private boolean afterExists;

    @Column(name = "after_name", length = 100)
    private String afterName;

    @Column(name = "after_amount")
    private Double afterAmount;

    @Enumerated(EnumType.STRING)
    @Column(name = "after_unit", length = 20)
    private Unit afterUnit;

    @Column(name = "after_expiration_date")
    private LocalDate afterExpirationDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "after_stock_state", length = 16)
    private FridgeStockState afterStockState;

    @Enumerated(EnumType.STRING)
    @Column(name = "after_source", length = 32)
    private FridgeOperationSource afterSource;

    @Enumerated(EnumType.STRING)
    @Column(name = "after_quantity_accuracy", length = 16)
    private QuantityAccuracy afterQuantityAccuracy;

    @Column(name = "after_barcode", length = 64)
    private String afterBarcode;

    @Column(name = "after_last_confirmed_at")
    private Instant afterLastConfirmedAt;

    @Column(name = "after_ingredient_id")
    private Long afterIngredientId;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public void setOperation(FridgeInventoryOperation operation) { this.operation = operation; }
    public void setChangeType(FridgeOperationChangeType changeType) { this.changeType = changeType; }
    public void setFridgeItemId(Long fridgeItemId) { this.fridgeItemId = fridgeItemId; }
    public void setBeforeExists(boolean beforeExists) { this.beforeExists = beforeExists; }
    public void setBeforeName(String beforeName) { this.beforeName = beforeName; }
    public void setBeforeAmount(Double beforeAmount) { this.beforeAmount = beforeAmount; }
    public void setBeforeUnit(Unit beforeUnit) { this.beforeUnit = beforeUnit; }
    public void setBeforeExpirationDate(LocalDate beforeExpirationDate) { this.beforeExpirationDate = beforeExpirationDate; }
    public boolean isBeforeExists() { return beforeExists; }
    public String getBeforeName() { return beforeName; }
    public Double getBeforeAmount() { return beforeAmount; }
    public Unit getBeforeUnit() { return beforeUnit; }
    public LocalDate getBeforeExpirationDate() { return beforeExpirationDate; }
    public FridgeStockState getBeforeStockState() { return beforeStockState; }
    public void setBeforeStockState(FridgeStockState beforeStockState) { this.beforeStockState = beforeStockState; }
    public FridgeOperationSource getBeforeSource() { return beforeSource; }
    public void setBeforeSource(FridgeOperationSource beforeSource) { this.beforeSource = beforeSource; }
    public QuantityAccuracy getBeforeQuantityAccuracy() { return beforeQuantityAccuracy; }
    public void setBeforeQuantityAccuracy(QuantityAccuracy beforeQuantityAccuracy) { this.beforeQuantityAccuracy = beforeQuantityAccuracy; }
    public String getBeforeBarcode() { return beforeBarcode; }
    public void setBeforeBarcode(String beforeBarcode) { this.beforeBarcode = beforeBarcode; }
    public Instant getBeforeLastConfirmedAt() { return beforeLastConfirmedAt; }
    public void setBeforeLastConfirmedAt(Instant beforeLastConfirmedAt) { this.beforeLastConfirmedAt = beforeLastConfirmedAt; }
    public Long getBeforeIngredientId() { return beforeIngredientId; }
    public void setBeforeIngredientId(Long beforeIngredientId) { this.beforeIngredientId = beforeIngredientId; }
    public void setAfterExists(boolean afterExists) { this.afterExists = afterExists; }
    public void setAfterName(String afterName) { this.afterName = afterName; }
    public void setAfterAmount(Double afterAmount) { this.afterAmount = afterAmount; }
    public void setAfterUnit(Unit afterUnit) { this.afterUnit = afterUnit; }
    public void setAfterExpirationDate(LocalDate afterExpirationDate) { this.afterExpirationDate = afterExpirationDate; }
    public boolean isAfterExists() { return afterExists; }
    public String getAfterName() { return afterName; }
    public Double getAfterAmount() { return afterAmount; }
    public Unit getAfterUnit() { return afterUnit; }
    public LocalDate getAfterExpirationDate() { return afterExpirationDate; }
    public FridgeStockState getAfterStockState() { return afterStockState; }
    public void setAfterStockState(FridgeStockState afterStockState) { this.afterStockState = afterStockState; }
    public FridgeOperationSource getAfterSource() { return afterSource; }
    public void setAfterSource(FridgeOperationSource afterSource) { this.afterSource = afterSource; }
    public QuantityAccuracy getAfterQuantityAccuracy() { return afterQuantityAccuracy; }
    public void setAfterQuantityAccuracy(QuantityAccuracy afterQuantityAccuracy) { this.afterQuantityAccuracy = afterQuantityAccuracy; }
    public String getAfterBarcode() { return afterBarcode; }
    public void setAfterBarcode(String afterBarcode) { this.afterBarcode = afterBarcode; }
    public Instant getAfterLastConfirmedAt() { return afterLastConfirmedAt; }
    public void setAfterLastConfirmedAt(Instant afterLastConfirmedAt) { this.afterLastConfirmedAt = afterLastConfirmedAt; }
    public Long getAfterIngredientId() { return afterIngredientId; }
    public void setAfterIngredientId(Long afterIngredientId) { this.afterIngredientId = afterIngredientId; }
    public Long getFridgeItemId() { return fridgeItemId; }
    public FridgeOperationChangeType getChangeType() { return changeType; }
}
