package org.jakub.backendapi.services;

import com.fasterxml.jackson.databind.JsonNode;
import org.jakub.backendapi.dto.FridgeIngredientDto;
import org.jakub.backendapi.dto.RecipeGenerationResponseDto;
import org.jakub.backendapi.dto.UserPreferencesDto;
import org.jakub.backendapi.entities.Enums.ShoppingPolicy;
import org.jakub.backendapi.exceptions.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Deterministic checks applied to AI output before it becomes an API result. */
@Service
public class GeneratedRecipeValidator {
    private static final Pattern MINUTES = Pattern.compile("(\\d+)");
    private static final DietLexicon ENGLISH = new DietLexicon(
            Set.of("meat", "chicken", "beef", "pork", "ham", "turkey", "bacon", "sausage", "lamb", "veal", "duck", "prosciutto", "gelatin", "gelatine"),
            Set.of("fish", "salmon", "tuna", "shrimp", "prawn", "anchovy", "sardine", "cod"),
            Set.of("milk", "cheese", "yogurt", "butter", "cream", "mozzarella", "parmesan", "curd"),
            Set.of("egg", "eggs"),
            Set.of("wheat", "flour", "bread", "pasta", "couscous", "barley", "rye", "spelt", "bun"),
            Set.of("coconut", "oat", "soy", "almond", "rice", "plant", "vegan")
    );
    private static final DietLexicon POLISH = new DietLexicon(
            Set.of("mięs", "kurcz", "wołow", "wieprz", "szynk", "indyk", "boczk", "kiełbas", "jagnięc", "cielęc", "kaczk", "prosciutto", "żelatyn"),
            Set.of("ryb", "łoso", "tuńczy", "krewet", "anchois", "sardyn", "dorsz"),
            Set.of("mlek", "ser", "jogurt", "masł", "śmietan", "mozzarell", "parmezan", "twar"),
            Set.of("jaj"),
            Set.of("pszen", "mąk", "chleb", "makaron", "kuskus", "jęcz", "żyt", "orkisz", "buł"),
            Set.of("kokos", "ows", "soj", "migdał", "ryżow", "roślinn", "wegań")
    );

    public List<RecipeGenerationResponseDto.ConstraintCheckDto> validate(JsonNode root, int expectedCount,
                                                                           UserPreferencesDto preferences,
                                                                           List<FridgeIngredientDto> requiredFridgeItems,
                                                                           Integer maxMinutes,
                                                                           ShoppingPolicy shoppingPolicy,
                                                                           int requestedServings) {
        return validate(root, expectedCount, preferences, requiredFridgeItems, maxMinutes,
                shoppingPolicy, requestedServings, "en");
    }

    public List<RecipeGenerationResponseDto.ConstraintCheckDto> validate(JsonNode root, int expectedCount,
                                                                           UserPreferencesDto preferences,
                                                                           List<FridgeIngredientDto> requiredFridgeItems,
                                                                           Integer maxMinutes,
                                                                           ShoppingPolicy shoppingPolicy,
                                                                           int requestedServings,
                                                                           String locale) {
        DietLexicon lexicon = "pl".equalsIgnoreCase(locale) ? POLISH : ENGLISH;
        List<JsonNode> recipes = new ArrayList<>();
        if (expectedCount == 1) {
            recipes.add(root);
        } else if (root != null && root.path("recipes").isArray()) {
            root.path("recipes").forEach(recipes::add);
        }
        if (recipes.size() != expectedCount) {
            throw invalid("Generated recipe count does not match the request.");
        }

        List<RecipeGenerationResponseDto.ConstraintCheckDto> checks = new ArrayList<>();
        for (JsonNode recipe : recipes) {
            List<String> warnings = new ArrayList<>();
            int servings = recipe.path("servings").asInt(0);
            if (servings < 1 || servings > 100 || servings != requestedServings) {
                throw invalid("Generated recipe servings do not match the request.");
            }
            for (JsonNode ingredient : recipe.path("ingredients")) {
                String unit = ingredient.path("unit").asText("").trim();
                if (new UnitConversionService().normalize(unit).isEmpty()) {
                    throw invalid("Generated recipe contains an unsupported unit.");
                }
            }
            if (shoppingPolicy == ShoppingPolicy.NONE && recipe.path("fridgeCoverage").path("missing").isArray()
                    && recipe.path("fridgeCoverage").path("missing").size() > 0) {
                throw invalid("Generated recipe needs shopping in no-shopping mode.");
            }

            Set<String> names = new HashSet<>();
            for (JsonNode ingredient : recipe.path("ingredients")) {
                names.add(normalize(ingredient.path("name").asText("")));
            }
            for (String required : requiredFridgeNames(requiredFridgeItems)) {
                if (!names.contains(required)) {
                    throw invalid("A required fridge item is missing from the generated recipe.");
                }
            }

            List<String> diets = preferences == null || preferences.getDiets() == null
                    ? List.of()
                    : java.util.Arrays.stream(preferences.getDiets()).map(this::normalize).toList();
            for (String name : names) {
                if (containsAny(name, preferences == null ? new String[0] : preferences.getDislikedIngredients())) {
                    throw invalid("Generated recipe contains a disliked ingredient.");
                }
                boolean containsDairy = matches(name, lexicon.dairy(), lexicon == POLISH)
                        && !matches(name, lexicon.plantAlternativeMarkers(), true);
                if (diets.contains("vegan") && (matches(name, lexicon.meat(), lexicon == POLISH)
                        || matches(name, lexicon.fish(), lexicon == POLISH)
                        || containsDairy
                        || matches(name, lexicon.egg(), lexicon == POLISH))) {
                    throw invalid("Generated recipe violates the vegan diet.");
                }
                if (diets.contains("vegetarian") && (matches(name, lexicon.meat(), lexicon == POLISH)
                        || matches(name, lexicon.fish(), lexicon == POLISH))) {
                    throw invalid("Generated recipe violates the vegetarian diet.");
                }
                if (diets.contains("gluten_free") && matches(name, lexicon.gluten(), lexicon == POLISH)) {
                    throw invalid("Generated recipe violates the gluten-free diet.");
                }
                if (diets.contains("dairy_free") && containsDairy) {
                    throw invalid("Generated recipe violates the dairy-free diet.");
                }
            }

            if (maxMinutes != null && recipe.path("timeToPrepare").isTextual()) {
                Matcher matcher = MINUTES.matcher(recipe.path("timeToPrepare").asText());
                if (matcher.find() && Integer.parseInt(matcher.group(1)) > maxMinutes) {
                    throw invalid("Generated recipe exceeds the requested preparation time.");
                }
            }
            checks.add(new RecipeGenerationResponseDto.ConstraintCheckDto("PASSED", warnings));
        }
        return checks;
    }

    private List<String> requiredFridgeNames(List<FridgeIngredientDto> items) {
        return items == null ? List.of() : items.stream()
                .filter(item -> item != null && item.getId() != null && StringUtils.hasText(item.getName()))
                .map(item -> normalize(item.getName()))
                .toList();
    }

    private boolean containsAny(String name, String[] disliked) {
        if (disliked == null) return false;
        for (String value : disliked) {
            if (StringUtils.hasText(value) && name.equals(normalize(value))) return true;
        }
        return false;
    }

    private boolean matches(String name, Set<String> values, boolean prefixMatch) {
        if (values.isEmpty()) return false;
        List<String> tokens = java.util.Arrays.stream(name.split("[^\\p{L}]+"))
                .filter(StringUtils::hasText)
                .toList();
        return values.stream().anyMatch(value -> tokens.stream().anyMatch(token ->
                prefixMatch ? token.startsWith(value) : token.equals(value)));
    }

    private String normalize(String value) { return value == null ? "" : value.trim().toLowerCase(Locale.ROOT); }

    private AppException invalid(String message) { return new AppException(message, HttpStatus.BAD_GATEWAY); }

    private record DietLexicon(
            Set<String> meat,
            Set<String> fish,
            Set<String> dairy,
            Set<String> egg,
            Set<String> gluten,
            Set<String> plantAlternativeMarkers
    ) {}
}
