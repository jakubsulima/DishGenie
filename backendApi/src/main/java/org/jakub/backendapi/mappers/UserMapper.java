package org.jakub.backendapi.mappers;

import org.jakub.backendapi.dto.SignUpDto;
import org.jakub.backendapi.dto.UserDto;
import org.jakub.backendapi.entities.User;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring", uses = UserPreferencesMapper.class)
public interface UserMapper {
    @Mapping(target = "token", ignore = true)
    @Mapping(target = "recipeCreationLimit", ignore = true)
    @Mapping(target = "recipesCreated", ignore = true)
    @Mapping(target = "recipesRemaining", ignore = true)
    @Mapping(target = "recipeCreationLimitReached", ignore = true)
    UserDto toUserDto(User user);

    @Mapping(target = "password", ignore = true)
    @Mapping(target = "role", ignore = true)
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "recipes", ignore = true)
    @Mapping(target = "userPreferences", ignore = true)
    @Mapping(target = "fridgeIngredients", ignore = true)
    @Mapping(target = "authMethod", ignore = true)
    @Mapping(target = "subscriptionPlan", ignore = true)
    @Mapping(target = "dailyRecipeCount", ignore = true)
    @Mapping(target = "lastRecipeResetDate", ignore = true)
    @Mapping(target = "termsAcceptedAt", ignore = true)
    @Mapping(target = "privacyAcceptedAt", ignore = true)
    @Mapping(target = "termsVersion", ignore = true)
    @Mapping(target = "privacyVersion", ignore = true)
    @Mapping(target = "passwordResetTokenHash", ignore = true)
    @Mapping(target = "passwordResetExpiresAt", ignore = true)
    User signUpToUser(SignUpDto userDto);

}
