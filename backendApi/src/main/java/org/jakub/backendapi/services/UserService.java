package org.jakub.backendapi.services;


import jakarta.transaction.Transactional;
import org.jakub.backendapi.dto.CredentialsDto;
import org.jakub.backendapi.dto.SignUpDto;
import org.jakub.backendapi.dto.UserDto;
import org.jakub.backendapi.entities.Enums.Diet;
import org.jakub.backendapi.entities.Enums.Role;
import org.jakub.backendapi.entities.Enums.SubscriptionPlan;
import org.jakub.backendapi.entities.User;
import org.jakub.backendapi.entities.UserPreferences;
import org.jakub.backendapi.exceptions.AppException;
import org.jakub.backendapi.mappers.UserMapper;
import org.jakub.backendapi.repositories.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.nio.CharBuffer;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;


@Service
public class UserService {
    public static final String TERMS_VERSION = "2026-05-30";
    public static final String PRIVACY_VERSION = "2026-05-30";

    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final RecipePlanLimitService recipePlanLimitService;

    public UserService(UserRepository userRepository, UserMapper userMapper, PasswordEncoder passwordEncoder, RecipePlanLimitService recipePlanLimitService) {
        this.userRepository = userRepository;
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
        this.recipePlanLimitService = recipePlanLimitService;
    }

    public UserDto findByEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException("Unknown user", HttpStatus.NOT_FOUND));
        return userMapper.toUserDto(user);
    }

    public UserDto getUserProfileByEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException("Unknown user", HttpStatus.NOT_FOUND));

        long recipeRequestsToday = recipePlanLimitService.getRecipeRequestsToday(user);
        UserDto userDto = userMapper.toUserDto(user);
        userDto.setSubscriptionPlan(recipePlanLimitService.getEffectivePlan(user));
        userDto.setRecipeCreationLimit(recipePlanLimitService.resolveRecipeLimit(user));
        userDto.setRecipesCreated(recipeRequestsToday);
        userDto.setRecipesRemaining(recipePlanLimitService.getRemainingRecipes(user, recipeRequestsToday));
        userDto.setRecipeCreationLimitReached(recipePlanLimitService.isLimitReached(user, recipeRequestsToday));
        return userDto;
    }

    @Transactional
    public void reserveRecipeGeneration(String email) {
        User user = userRepository.findByEmailForUpdate(email)
                .orElseThrow(() -> new AppException("Unknown user", HttpStatus.NOT_FOUND));

        java.time.LocalDate today = java.time.LocalDate.now();
        if (user.getLastRecipeResetDate() == null || !user.getLastRecipeResetDate().equals(today)) {
            user.setDailyRecipeCount(0);
            user.setLastRecipeResetDate(today);
        }

        recipePlanLimitService.assertCanCreateRecipe(user);
        user.setDailyRecipeCount(user.getDailyRecipeCount() + 1);
        userRepository.save(user);
    }

    @Transactional
    public void releaseRecipeGeneration(String email) {
        User user = userRepository.findByEmailForUpdate(email)
                .orElseThrow(() -> new AppException("Unknown user", HttpStatus.NOT_FOUND));

        java.time.LocalDate today = java.time.LocalDate.now();
        if (today.equals(user.getLastRecipeResetDate()) && user.getDailyRecipeCount() > 0) {
            user.setDailyRecipeCount(user.getDailyRecipeCount() - 1);
            userRepository.save(user);
        }
    }

    public UserDto login(CredentialsDto credentialsDto) {
        User user = userRepository.findByEmail(credentialsDto.getEmail())
                .orElseThrow(() -> new AppException("Unknown user", HttpStatus.NOT_FOUND));

        if (user.getPassword() == null) {
            throw new AppException("This account uses social login. Please sign in with " + user.getAuthMethod().name(), HttpStatus.BAD_REQUEST);
        }

        if (passwordEncoder.matches(CharBuffer.wrap(credentialsDto.getPassword()), user.getPassword())) {
            return userMapper.toUserDto(user);
        }
        throw new AppException("Invalid password", HttpStatus.BAD_REQUEST);
    }

    public UserDto register(SignUpDto signUpDto) {
        assertPoliciesAccepted(signUpDto.isAcceptedTerms(), signUpDto.isAcceptedPrivacy());

        Optional<User> optionalUser = userRepository.findByEmail(signUpDto.getEmail());
        if (optionalUser.isPresent()) {
            throw new AppException("User already exists", HttpStatus.BAD_REQUEST);
        }
        User user = userMapper.signUpToUser(signUpDto);
        user.setPassword(passwordEncoder.encode(CharBuffer.wrap(signUpDto.getPassword())));
        user.setRole(Role.USER);
        markPoliciesAccepted(user);

        UserPreferences userPreferences = new UserPreferences();
        userPreferences.setDiets(List.of(Diet.NONE));
        userPreferences.setUser(user);
        user.setUserPreferences(userPreferences);
        User savedUser = userRepository.save(user);

        return userMapper.toUserDto(savedUser);
    }

    public void assertPoliciesAccepted(boolean acceptedTerms, boolean acceptedPrivacy) {
        if (!acceptedTerms || !acceptedPrivacy) {
            throw new AppException("You must accept the Terms of Service and acknowledge the Privacy Policy to create an account.", HttpStatus.BAD_REQUEST);
        }
    }

    public void markPoliciesAccepted(User user) {
        LocalDateTime acceptedAt = LocalDateTime.now();
        user.setTermsAcceptedAt(acceptedAt);
        user.setPrivacyAcceptedAt(acceptedAt);
        user.setTermsVersion(TERMS_VERSION);
        user.setPrivacyVersion(PRIVACY_VERSION);
    }

    public UserDto getUserById(Long id) {
        UserPreferences userPreferences = new UserPreferences();
        userPreferences.setDiets(List.of(Diet.NONE));
        userPreferences.setDiet(Diet.NONE);
        User user = userRepository.findById(id).orElseThrow(() -> new AppException("User not found", HttpStatus.NOT_FOUND));
        userPreferences.setDislikedIngredients(List.of());
        userPreferences.setUser(user);
        return userMapper.toUserDto(user);
    }

    public List<UserDto> getAllUsers() {
        return userRepository.findAll().stream().map(userMapper::toUserDto).collect(Collectors.toList());
    }

    public Page<UserDto> getAllUsers(Pageable pageable) {
        return userRepository.findAll(pageable).map(userMapper::toUserDto);
    }

    public UserDto updateUserRole(Long id, Role role) {
        User user = userRepository.findById(id).orElseThrow(() -> new AppException("User not found", HttpStatus.NOT_FOUND));
        if (role == null) {
            throw new AppException("Role is required.", HttpStatus.BAD_REQUEST);
        }
        if (user.getRole() == Role.ADMIN && role != Role.ADMIN && userRepository.countByRole(Role.ADMIN) <= 1) {
            throw new AppException("Cannot remove the last admin user.", HttpStatus.BAD_REQUEST);
        }
        user.setRole(role);
        User updatedUser = userRepository.save(user);
        return userMapper.toUserDto(updatedUser);
    }

    public UserDto updateUserPlan(Long id, SubscriptionPlan subscriptionPlan) {
        User user = userRepository.findById(id).orElseThrow(() -> new AppException("User not found", HttpStatus.NOT_FOUND));
        user.setSubscriptionPlan(subscriptionPlan);
        User updatedUser = userRepository.save(user);
        return userMapper.toUserDto(updatedUser);
    }

    public void deleteUser(Long id) {
        User user = userRepository.findById(id).orElseThrow(() -> new AppException("User not found", HttpStatus.NOT_FOUND));
        if (user.getRole() == Role.ADMIN && userRepository.countByRole(Role.ADMIN) <= 1) {
            throw new AppException("Cannot delete the last admin user.", HttpStatus.BAD_REQUEST);
        }
        userRepository.delete(user);
    }


}
