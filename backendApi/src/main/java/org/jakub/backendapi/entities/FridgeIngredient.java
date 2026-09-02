package org.jakub.backendapi.entities;

import jakarta.persistence.*;
import org.jakub.backendapi.entities.Enums.Unit;
import org.jakub.backendapi.entities.Enums.FridgeOperationSource;
import org.jakub.backendapi.entities.Enums.FridgeStockState;
import org.jakub.backendapi.entities.Enums.QuantityAccuracy;

import java.time.LocalDate;
import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "fridge_ingredient")
public class FridgeIngredient {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column()
    private LocalDate expirationDate;

    @Column()
    private Double amount;

    @Column()
    @Enumerated(EnumType.STRING)
    private Unit unit;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne
    @JoinColumn(name = "ingredient_id")
    private Ingredient ingredient;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private FridgeOperationSource source = FridgeOperationSource.MANUAL;

    @Column(name = "quantity_accuracy", nullable = false)
    @Enumerated(EnumType.STRING)
    private QuantityAccuracy quantityAccuracy = QuantityAccuracy.UNKNOWN;

    @Column(length = 64)
    private String barcode;

    @Column(name = "stock_state", nullable = false)
    @Enumerated(EnumType.STRING)
    private FridgeStockState stockState = FridgeStockState.IN_STOCK;

    @Column(name = "last_confirmed_at")
    private Instant lastConfirmedAt;

    public FridgeIngredient() {
    }

    public FridgeIngredient(Long id, String name, LocalDate expirationDate, Double amount, Unit unit, User user) {
        this.id = id;
        this.name = name;
        this.expirationDate = expirationDate;
        this.amount = amount;
        this.unit = unit;
        this.user = user;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public LocalDate getExpirationDate() {
        return expirationDate;
    }

    public void setExpirationDate(LocalDate expirationDate) {
        this.expirationDate = expirationDate;
    }

    public Double getAmount() {
        return amount;
    }

    public void setAmount(Double amount) {
        this.amount = amount;
    }

    public Unit getUnit() {
        return unit;
    }

    public void setUnit(Unit unit) {
        this.unit = unit;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public Ingredient getIngredient() { return ingredient; }

    public void setIngredient(Ingredient ingredient) { this.ingredient = ingredient; }

    public FridgeOperationSource getSource() { return source; }

    public void setSource(FridgeOperationSource source) { this.source = source; }

    public QuantityAccuracy getQuantityAccuracy() { return quantityAccuracy; }

    public void setQuantityAccuracy(QuantityAccuracy quantityAccuracy) { this.quantityAccuracy = quantityAccuracy; }

    public String getBarcode() { return barcode; }

    public void setBarcode(String barcode) { this.barcode = barcode; }

    public FridgeStockState getStockState() { return stockState; }

    public void setStockState(FridgeStockState stockState) { this.stockState = stockState; }

    public Instant getLastConfirmedAt() { return lastConfirmedAt; }

    public void setLastConfirmedAt(Instant lastConfirmedAt) { this.lastConfirmedAt = lastConfirmedAt; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        FridgeIngredient that = (FridgeIngredient) o;
        return Objects.equals(id, that.id) && Objects.equals(name, that.name) && Objects.equals(expirationDate, that.expirationDate) && Objects.equals(amount, that.amount) && unit == that.unit && Objects.equals(user, that.user);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, name, expirationDate, amount, unit, user);
    }

    @Override
    public String toString() {
        return "FridgeIngredient{" +
                "id=" + id +
                ", name='" + name + '\'' +
                ", expirationDate=" + expirationDate +
                ", amount=" + amount +
                ", unit=" + unit +
                ", user=" + user +
                '}';
    }
}
