package org.jakub.backendapi.entities;

import jakarta.persistence.*;
import org.jakub.backendapi.entities.Enums.ContentLocale;

import java.time.Instant;

@Entity
@Table(name = "ingredient_alias")
public class IngredientAlias {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "ingredient_id")
    private Ingredient ingredient;

    @Column(name = "normalized_alias", nullable = false, length = 255)
    private String normalizedAlias;

    @Enumerated(EnumType.STRING)
    @Column(length = 2)
    private ContentLocale locale;

    @Column(nullable = false, length = 30)
    private String source = "CURATED";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Ingredient getIngredient() { return ingredient; }
    public void setIngredient(Ingredient ingredient) { this.ingredient = ingredient; }
    public String getNormalizedAlias() { return normalizedAlias; }
    public void setNormalizedAlias(String normalizedAlias) { this.normalizedAlias = normalizedAlias; }
    public ContentLocale getLocale() { return locale; }
    public void setLocale(ContentLocale locale) { this.locale = locale; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
