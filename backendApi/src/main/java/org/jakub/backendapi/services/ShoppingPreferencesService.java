package org.jakub.backendapi.services;
import org.jakub.backendapi.dto.MealPlanDto.Create;
import org.jakub.backendapi.entities.ShoppingPreferences;
import org.jakub.backendapi.repositories.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
@Service
public class ShoppingPreferencesService {
    private final ShoppingPreferencesRepository preferences;
    private final UserRepository users;
    private final ObjectMapper json;
    public ShoppingPreferencesService(ShoppingPreferencesRepository preferences, UserRepository users, ObjectMapper json) {
        this.preferences = preferences; this.users = users; this.json = json;
    }
    @Transactional(readOnly = true)
    public Create get(String email) {
        return preferences.findById(users.findByEmail(email).orElseThrow().getId())
                .map(p -> json.readValue(p.getDocument(), Create.class)).orElse(null);
    }
    @Transactional
    public Create save(String email, Create input) {
        var user = users.findByEmailForUpdate(email).orElseThrow();
        var value = preferences.findById(user.getId()).orElseGet(ShoppingPreferences::new);
        value.setUserId(user.getId()); value.setDocument(json.writeValueAsString(input)); preferences.save(value);
        return input;
    }
}
