package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.entities.FridgeIngredient;
import org.jakub.backendapi.entities.Enums.QuantityAccuracy;
import org.springframework.stereotype.Service;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

/** Allocates each fridge quantity once, in meal-date order. Never mutates inventory. */
@Service
public class PlanIngredientAggregationService {
    private final UnitConversionService units;
    private final IngredientNormalizationService names;
    private final ServingScalingService scaling;

    public PlanIngredientAggregationService(UnitConversionService units,
            IngredientNormalizationService names, ServingScalingService scaling) {
        this.units = units;
        this.names = names;
        this.scaling = scaling;
    }

    public Shopping aggregate(List<Slot> slots, List<FridgeIngredient> fridge, String locale) {
        Map<String, IngredientNormalizationService.Resolution> resolutions = new HashMap<>();
        Map<FridgeIngredient, Double> stock = new IdentityHashMap<>();
        List<FridgeIngredient> ordered = fridge.stream().sorted(Comparator.comparing(
                FridgeIngredient::getExpirationDate, Comparator.nullsLast(Comparator.naturalOrder()))).toList();
        Map<String, Row> rows = new LinkedHashMap<>();
        for (Slot slot : slots.stream().sorted(Comparator.comparing(Slot::date)).toList()) {
            if (slot.skipped() || slot.recipe() == null) continue;
            int ingredientIndex = 0;
            for (var ingredient : scaling.scale(slot.recipe().getIngredients(), slot.recipe().getServings(), slot.servings())) {
                String identity = identity(ingredient.getName(), locale, resolutions);
                boolean ambiguous = resolutions.get(ingredient.getName()).status() == IngredientNormalizationService.Status.AMBIGUOUS;
                var unit = units.normalize(ingredient.getUnit()).orElse(null);
                double amount = ingredient.getAmount();
                boolean measured = unit != null && Double.isFinite(amount) && amount > 0;
                String rowKey = identity + "|" + (measured ? unit.dimension() : "unknown:" + ingredient.getUnit());
                if (ambiguous) rowKey += "|" + slot.id() + "|" + ingredientIndex;
                ingredientIndex++;
                Row row = rows.computeIfAbsent(rowKey, key -> new Row(ingredient.getName(),
                        measured ? baseUnit(unit.dimension()) : ingredient.getUnit()));
                row.slots.add(slot.id());
                if (!measured) { row.unknownAmount = true; row.review = true; continue; }
                double remaining = units.toBaseAmount(amount, unit);
                if (ambiguous) { row.review = true; row.missing += remaining; continue; }
                for (FridgeIngredient item : ordered) {
                    if (item.getExpirationDate() != null && item.getExpirationDate().isBefore(slot.date())) continue;
                    if (!identity.equals(identity(item.getName(), locale, resolutions))) continue;
                    var stockUnit = units.normalize(item.getUnit() == null ? null : item.getUnit().name()).orElse(null);
                    if (item.getQuantityAccuracy() == QuantityAccuracy.UNKNOWN || stockUnit == null || item.getAmount() == null || !Double.isFinite(item.getAmount())) {
                        row.review = true;
                        continue;
                    }
                    if (item.getQuantityAccuracy() == QuantityAccuracy.ESTIMATED) row.review = true;
                    if (!units.areCompatible(unit, stockUnit)) { row.review = true; continue; }
                    double available = stock.computeIfAbsent(item,
                            key -> units.toBaseAmount(Math.max(0, item.getAmount()), stockUnit));
                    double used = Math.min(available, remaining);
                    stock.put(item, available - used);
                    remaining -= used;
                    row.used += used;
                    if (remaining <= 1e-9) break;
                }
                row.missing += Math.max(0, remaining);
            }
        }
        List<ShoppingItem> items = rows.entrySet().stream().map(entry -> {
            Row r = entry.getValue();
            Double amount = r.unknownAmount ? null : round(r.missing);
            // Quantity is part of the key: changed requirements must be checked again.
            String key = UUID.nameUUIDFromBytes((entry.getKey() + "|" + amount + "|" + r.review)
                    .getBytes(StandardCharsets.UTF_8)).toString();
            return new ShoppingItem(key, r.name, amount, r.unit, round(r.used), List.copyOf(r.slots), r.review);
        }).toList();
        return new Shopping(Instant.now(), items, Set.of());
    }

    private String identity(String name, String locale, Map<String, IngredientNormalizationService.Resolution> cache) {
        var resolution = cache.computeIfAbsent(name, value -> names.resolve(value, locale));
        if (resolution.isResolved()) return "id:" + resolution.ingredient().getId();
        // Exact names only for unresolved ingredients; no fuzzy raw/cooked substitution.
        return "name:" + names.canonicalName(name);
    }
    private String baseUnit(UnitConversionService.Dimension dimension) {
        return switch (dimension) { case MASS -> "g"; case VOLUME -> "ml"; case COUNT -> "pcs"; };
    }
    private double round(double value) { return Math.round(value * 1000d) / 1000d; }
    private static class Row {
        final String name;
        final String unit;
        final Set<UUID> slots = new LinkedHashSet<>();
        double missing;
        double used;
        boolean review;
        boolean unknownAmount;
        Row(String name, String unit) { this.name = name; this.unit = unit; }
    }
}
