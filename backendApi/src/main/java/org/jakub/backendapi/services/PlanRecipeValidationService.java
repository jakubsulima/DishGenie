package org.jakub.backendapi.services;
import jakarta.validation.Validator;
import org.jakub.backendapi.dto.*;
import org.jakub.backendapi.entities.Enums.*;
import org.jakub.backendapi.exceptions.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;
import java.util.*;
@Service
public class PlanRecipeValidationService {
    private final GeneratedRecipeValidator rules;
    private final Validator validator;
    private final ObjectMapper json;
    private final UserPreferencesService preferences;
    public PlanRecipeValidationService(GeneratedRecipeValidator rules, Validator validator, ObjectMapper json, UserPreferencesService preferences) {
        this.rules = rules; this.validator = validator; this.json = json; this.preferences = preferences;
    }
    public void validate(String email, RecipeDto recipe, int minutes, String locale) {
        if (recipe == null || !validator.validate(recipe).isEmpty()
                || recipe.getIngredients().stream().anyMatch(i -> !Double.isFinite(i.getAmount())))
            throw new AppException("Check recipe fields.", HttpStatus.BAD_REQUEST);
        // Time must be unambiguous; a missing time is not permission to exceed the limit.
        String time = recipe.getTimeToPrepare();
        if (time == null || !time.matches("(?i)\\s*\\d{1,3}\\s*(min|minut|minuty|minuta|minutes?|mins?)[.]?\\s*"))
            throw new AppException("Use preparation time in minutes.", HttpStatus.BAD_REQUEST);
        rules.validate(json.valueToTree(recipe), 1, preferences.getPreferences(email), List.of(), minutes,
                ShoppingPolicy.MINIMIZE, recipe.getServings(), locale);
    }
    public boolean allowedIngredient(String email, String name, String locale) {
        var recipe = new RecipeDto(null, "Ingredient check", List.of(new RecipeIngredientDto(name, 1, "g")), List.of("Check"), "", "5 min", 1);
        try { validate(email, recipe, 5, locale); return true; } catch (RuntimeException rejected) { return false; }
    }
}
