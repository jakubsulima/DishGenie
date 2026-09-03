package org.jakub.backendapi.services;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/** Canonical unit parsing shared by recipes, fridge coverage and shopping lists. */
@Component
public class UnitConversionService {

    private static final Set<String> SAFE_INGREDIENT_QUALIFIERS = Set.of(
            "fresh", "frozen", "dried", "dry", "ripe", "raw", "cooked", "uncooked",
            "whole", "ground", "grated", "shredded", "chopped", "diced", "sliced",
            "minced", "crushed", "peeled", "boneless", "skinless", "firm", "soft",
            "extra", "virgin", "baby", "cherry", "leaf", "clove", "oil"
    );

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
                .replaceAll("\\p{M}", "")
                .replace('ł', 'l')
                .replace('Ł', 'L');
        return withoutAccents.trim()
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    /**
     * Matches a base ingredient to a more descriptive recipe label, while
     * rejecting additions that represent a different ingredient (for example
     * chicken vs chicken broth or tomato vs tomato paste).
     */
    public boolean ingredientNamesMatch(String left, String right) {
        Set<String> leftTokens = ingredientTokens(left);
        Set<String> rightTokens = ingredientTokens(right);
        if (leftTokens.isEmpty() || rightTokens.isEmpty()) {
            return false;
        }
        if (leftTokens.equals(rightTokens)) {
            return true;
        }

        Set<String> smaller;
        Set<String> larger;
        if (leftTokens.size() <= rightTokens.size() && rightTokens.containsAll(leftTokens)) {
            smaller = leftTokens;
            larger = rightTokens;
        } else if (rightTokens.size() < leftTokens.size() && leftTokens.containsAll(rightTokens)) {
            smaller = rightTokens;
            larger = leftTokens;
        } else {
            return false;
        }

        return larger.stream()
                .filter(token -> !smaller.contains(token))
                .allMatch(SAFE_INGREDIENT_QUALIFIERS::contains);
    }

    private Set<String> ingredientTokens(String rawName) {
        String normalized = normalizeIngredientName(rawName);
        if (!StringUtils.hasText(normalized)) {
            return Set.of();
        }
        return java.util.Arrays.stream(normalized.split(" "))
                .map(this::singularizeIngredientToken)
                .filter(StringUtils::hasText)
                .collect(Collectors.toSet());
    }

    private String singularizeIngredientToken(String token) {
        if ("leaves".equals(token)) {
            return "leaf";
        }
        if (token.endsWith("oes") && token.length() > 4) {
            return token.substring(0, token.length() - 2);
        }
        if (token.endsWith("ies") && token.length() > 4) {
            return token.substring(0, token.length() - 3) + "y";
        }
        if (token.endsWith("s") && !token.endsWith("ss") && token.length() > 3) {
            return token.substring(0, token.length() - 1);
        }
        return token;
    }
}
