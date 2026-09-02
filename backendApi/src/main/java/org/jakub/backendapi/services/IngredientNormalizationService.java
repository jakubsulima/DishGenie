package org.jakub.backendapi.services;

import org.jakub.backendapi.entities.Ingredient;
import org.jakub.backendapi.entities.IngredientAlias;
import org.jakub.backendapi.entities.Enums.ContentLocale;
import org.jakub.backendapi.repositories.IngredientAliasRepository;
import org.jakub.backendapi.repositories.IngredientRepository;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Resolves ingredient names without silently merging uncertain matches. */
@Service
public class IngredientNormalizationService {
    public enum Status { EXACT_CANONICAL, ALIAS, UNRESOLVED, AMBIGUOUS }

    public record Resolution(Status status, Ingredient ingredient, String displayName, List<Ingredient> candidates) {
        public boolean isResolved() {
            return status == Status.EXACT_CANONICAL || status == Status.ALIAS;
        }
    }

    private final IngredientRepository ingredientRepository;
    private final IngredientAliasRepository aliasRepository;

    public IngredientNormalizationService(IngredientRepository ingredientRepository,
                                           IngredientAliasRepository aliasRepository) {
        this.ingredientRepository = ingredientRepository;
        this.aliasRepository = aliasRepository;
    }

    public Resolution resolve(String rawName) {
        return resolve(rawName, null);
    }

    public Resolution resolve(String rawName, String locale) {
        String displayName = rawName == null ? "" : rawName.trim();
        if (!StringUtils.hasText(displayName)) {
            return new Resolution(Status.UNRESOLVED, null, displayName, List.of());
        }

        String canonical = canonicalName(displayName);
        List<Ingredient> exact = ingredientRepository.findByCanonicalName(canonical);
        if (exact.size() == 1) {
            return new Resolution(Status.EXACT_CANONICAL, exact.get(0), displayName, exact);
        }

        Ingredient legacyExact = ingredientRepository.findByNameIgnoreCase(displayName).orElse(null);
        if (legacyExact != null) {
            return new Resolution(Status.EXACT_CANONICAL, legacyExact, displayName, List.of(legacyExact));
        }

        List<IngredientAlias> aliases = StringUtils.hasText(locale)
                ? aliasRepository.findByNormalizedAliasForLocale(
                        aliasName(displayName),
                        ContentLocale.valueOf(locale.trim().toLowerCase(Locale.ROOT)))
                : aliasRepository.findByNormalizedAlias(aliasName(displayName));
        Set<Ingredient> candidates = new LinkedHashSet<>();
        aliases.stream().map(IngredientAlias::getIngredient).forEach(candidates::add);
        if (candidates.size() == 1) {
            Ingredient ingredient = candidates.iterator().next();
            return new Resolution(Status.ALIAS, ingredient, displayName, List.copyOf(candidates));
        }
        if (candidates.size() > 1) {
            return new Resolution(Status.AMBIGUOUS, null, displayName, List.copyOf(candidates));
        }
        return new Resolution(Status.UNRESOLVED, null, displayName, List.of());
    }

    public String canonicalName(String rawName) {
        return collapseWhitespace(rawName).toLowerCase(Locale.ROOT);
    }

    /** Accent-insensitive form is deliberately an alias key, never a display value. */
    public String aliasName(String rawName) {
        return Normalizer.normalize(canonicalName(rawName), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('ł', 'l')
                .replace('Ł', 'L');
    }

    private String collapseWhitespace(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }
}
