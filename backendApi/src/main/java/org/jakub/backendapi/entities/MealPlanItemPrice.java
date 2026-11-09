package org.jakub.backendapi.entities;

import jakarta.persistence.*;
import org.jakub.backendapi.dto.MealPlanDto.Store;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "meal_plan_item_price")
public class MealPlanItemPrice {
    @Id private UUID id;
    @Version private long version;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(nullable = false) private MealPlan plan;
    @Column(nullable = false, length = 64) private String itemKey;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private Store store;
    @Column(nullable = false) private LocalDate shoppingDate;
    @Column(nullable = false, columnDefinition = "TEXT") private String document;
    public UUID getId() { return id; } public void setId(UUID value) { id = value; }
    public MealPlan getPlan() { return plan; } public void setPlan(MealPlan value) { plan = value; }
    public String getItemKey() { return itemKey; } public void setItemKey(String value) { itemKey = value; }
    public Store getStore() { return store; } public void setStore(Store value) { store = value; }
    public LocalDate getShoppingDate() { return shoppingDate; } public void setShoppingDate(LocalDate value) { shoppingDate = value; }
    public String getDocument() { return document; } public void setDocument(String value) { document = value; }
}
