package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.UserPreferencesDto;
import org.jakub.backendapi.entities.Enums.Diet;
import org.jakub.backendapi.entities.User;
import org.jakub.backendapi.entities.UserPreferences;
import org.jakub.backendapi.exceptions.AppException;
import org.jakub.backendapi.mappers.UserPreferencesMapper;
import org.jakub.backendapi.repositories.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

@Service
public class UserPreferencesService {
    private static final Logger log = LoggerFactory.getLogger(UserPreferencesService.class);

    private final UserRepository userRepository;
    private final UserPreferencesMapper userPreferencesMapper;

    public UserPreferencesService(UserRepository userRepository, UserPreferencesMapper userPreferencesMapper) {
        this.userRepository = userRepository;
        this.userPreferencesMapper = userPreferencesMapper;
    }

    public UserPreferencesDto getPreferences(String email) {
        User user = userRepository.findByEmail(email).orElseThrow(() -> new AppException("User not found", HttpStatus.NOT_FOUND));
        return userPreferencesMapper.toUserPreferencesDto(user.getUserPreferences());
    }

    @Transactional
    public UserPreferencesDto changeDiet(String email, String diet) {
        List<String> requested = new ArrayList<>();
        if (diet != null) {
            requested.add(diet);
        }
        return changeDiets(email, requested);
    }

    @Transactional
    public UserPreferencesDto changeDiets(String email, List<String> diets) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException("User not found", HttpStatus.NOT_FOUND));

        UserPreferences preferences = user.getUserPreferences();

        List<Diet> parsedDiets;
        try {
            parsedDiets = parseDiets(diets);
        } catch (IllegalArgumentException e) {
            throw new AppException("Invalid diet value", HttpStatus.BAD_REQUEST);
        }

        preferences.setDiets(parsedDiets);

        return userPreferencesMapper.toUserPreferencesDto(preferences);
    }

    @Transactional
    public UserPreferencesDto addDislikedIngredient(String email, String ingredient) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException("User not found", HttpStatus.NOT_FOUND));

        UserPreferences preferences = user.getUserPreferences();

        if (!preferences.getDislikedIngredients().contains(ingredient)) {
            log.debug("Adding disliked ingredient '{}' for {}", ingredient, email);
            List<String> newDislikedIngredients = new ArrayList<>(preferences.getDislikedIngredients());
            newDislikedIngredients.add(ingredient);
            preferences.setDislikedIngredients(newDislikedIngredients);
        }

        return userPreferencesMapper.toUserPreferencesDto(preferences);
    }

    @Transactional
    public UserPreferencesDto removeDislikedIngredient(String email, String ingredient) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException("User not found", HttpStatus.NOT_FOUND));

        UserPreferences preferences = user.getUserPreferences();
        if (!preferences.getDislikedIngredients().contains(ingredient)) {
            throw new AppException("Ingredient not found in disliked ingredients", HttpStatus.BAD_REQUEST);
        }
        List<String> newDislikedIngredients = new ArrayList<>(preferences.getDislikedIngredients());
        newDislikedIngredients.removeIf(i -> i.equalsIgnoreCase(ingredient));
        preferences.setDislikedIngredients(newDislikedIngredients);

        return userPreferencesMapper.toUserPreferencesDto(preferences);
    }


    public Diet[] getDiets() {
        return Diet.values();
    }

    private List<Diet> parseDiets(List<String> diets) {
        if (diets == null || diets.isEmpty()) {
            return new ArrayList<>(List.of(Diet.NONE));
        }

        List<Diet> parsed = new ArrayList<>();
        for (String dietValue : diets) {
            if (dietValue == null || dietValue.trim().isEmpty()) {
                continue;
            }
            parsed.add(Diet.valueOf(dietValue.trim().toUpperCase()));
        }

        if (parsed.isEmpty()) {
            return new ArrayList<>(List.of(Diet.NONE));
        }

        List<Diet> unique = new ArrayList<>(new LinkedHashSet<>(parsed));
        if (unique.contains(Diet.NONE) && unique.size() > 1) {
            return new ArrayList<>(List.of(Diet.NONE));
        }

        return unique;
    }
}
