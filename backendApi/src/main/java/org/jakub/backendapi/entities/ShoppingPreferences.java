package org.jakub.backendapi.entities;
import jakarta.persistence.*;
@Entity
@Table(name = "shopping_preferences")
public class ShoppingPreferences {
    @Id private Long userId;
    @Column(nullable = false, columnDefinition = "TEXT") private String document;
    public Long getUserId() { return userId; }
    public void setUserId(Long value) { userId = value; }
    public String getDocument() { return document; }
    public void setDocument(String value) { document = value; }
}
