package org.jakub.backendapi.services;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Optional;

/** Canonical unit parsing shared by recipes, fridge coverage and shopping lists. */
@Component
public class UnitConversionService {

    public enum Dimension {
        MASS,
        VOLUME,
        COUNT
    }

    public record NormalizedUnit(String canonical, Dimension dimension, double factorToBase) {
    }

    public Optional<NormalizedUnit> normalize(String rawUnit) {
        if (!StringUtils.hasText(rawUnit)) {
            return Optional.empty();
        }

        return switch (rawUnit.trim().toLowerCase(Locale.ROOT)) {
            case "g", "gram", "grams", "gramy", "gramsów", "gramsow" ->
                    Optional.of(new NormalizedUnit("g", Dimension.MASS, 1d));
            case "kg", "kilogram", "kilograms", "kilogramy" ->
                    Optional.of(new NormalizedUnit("kg", Dimension.MASS, 1_000d));
            case "ml", "milliliter", "milliliters", "millilitr", "millilitry" ->
                    Optional.of(new NormalizedUnit("ml", Dimension.VOLUME, 1d));
            case "l", "liter", "liters", "litre", "litres", "litr", "litry" ->
                    Optional.of(new NormalizedUnit("l", Dimension.VOLUME, 1_000d));
            case "pcs", "pc", "piece", "pieces", "unit", "units", "szt", "szt.", "sztuki" ->
                    Optional.of(new NormalizedUnit("pcs", Dimension.COUNT, 1d));
            default -> {
                String enumName = rawUnit.trim().toUpperCase(Locale.ROOT);
                yield switch (enumName) {
                    case "GRAMS" -> Optional.of(new NormalizedUnit("g", Dimension.MASS, 1d));
                    case "KILOGRAMS" -> Optional.of(new NormalizedUnit("kg", Dimension.MASS, 1_000d));
                    case "MILLILITERS" -> Optional.of(new NormalizedUnit("ml", Dimension.VOLUME, 1d));
                    case "LITERS" -> Optional.of(new NormalizedUnit("l", Dimension.VOLUME, 1_000d));
                    case "PIECES" -> Optional.of(new NormalizedUnit("pcs", Dimension.COUNT, 1d));
                    default -> Optional.empty();
                };
            }
        };
    }

    public double toBaseAmount(double amount, NormalizedUnit unit) {
        return amount * unit.factorToBase();
    }

    public double fromBaseAmount(double amount, NormalizedUnit unit) {
        return amount / unit.factorToBase();
    }

    public boolean areCompatible(NormalizedUnit left, NormalizedUnit right) {
        return left != null && right != null && left.dimension() == right.dimension();
    }

    public String normalizeIngredientName(String rawName) {
        if (rawName == null) {
            return "";
        }

        String withoutAccents = Normalizer.normalize(rawName, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return withoutAccents.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }
}
