package org.jakub.backendapi.services;

import jakarta.transaction.Transactional;
import org.jakub.backendapi.dto.RecipeDto;
import org.jakub.backendapi.dto.RecipeResponseDto;
import org.jakub.backendapi.entities.Enums.Role;
import org.jakub.backendapi.entities.Enums.RecipeVisibility;
import org.jakub.backendapi.entities.Ingredient;
import org.jakub.backendapi.entities.Recipe;
import org.jakub.backendapi.entities.RecipeIngredient;
import org.jakub.backendapi.entities.User;
import org.jakub.backendapi.exceptions.AppException;
import org.jakub.backendapi.mappers.RecipeMapper;
import org.jakub.backendapi.repositories.IngredientRepository;
import org.jakub.backendapi.repositories.RecipeIngredientRepository;
import org.jakub.backendapi.repositories.RecipeRepository;
import org.jakub.backendapi.repositories.UserRepository;
import org.jakub.backendapi.repositories.projections.RecipeSitemapEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class RecipeService {
    private static final Pattern NUMERIC_IDENTIFIER_PATTERN = Pattern.compile("^\\d+$");

    private final RecipeRepository recipeRepository;
    private final UserRepository userRepository;
    private final IngredientRepository ingredientRepository;
    private final RecipeIngredientRepository recipeIngredientRepository;
    private final RecipeMapper recipeMapper;

    public RecipeService(RecipeRepository recipeRepository, UserRepository userRepository, IngredientRepository ingredientRepository, RecipeIngredientRepository recipeIngredientRepository, RecipeMapper recipeMapper) {
        this.recipeRepository = recipeRepository;
        this.userRepository = userRepository;
        this.ingredientRepository = ingredientRepository;
        this.recipeIngredientRepository = recipeIngredientRepository;
        this.recipeMapper = recipeMapper;
    }

    @Transactional
    public RecipeDto getRecipeById(Long id) {
        Recipe recipe = recipeRepository.findByIdWithIngredients(id)
                .orElseThrow(() -> new AppException("Recipe not found", HttpStatus.NOT_FOUND));
        return toRecipeDto(recipe);
    }

    @Transactional
    public RecipeDto getRecipeByIdentifier(String identifier) {
        String normalizedIdentifier = identifier == null ? "" : identifier.trim();
        if (!StringUtils.hasText(normalizedIdentifier)) {
            throw new AppException("Recipe not found", HttpStatus.NOT_FOUND);
        }
        if (NUMERIC_IDENTIFIER_PATTERN.matcher(normalizedIdentifier).matches()) {
            return getRecipeById(Long.parseLong(normalizedIdentifier));
        }

        String normalizedSlug = toRecipeSlug(normalizedIdentifier);
        String guessedName = normalizedSlug.replace('-', ' ');
        Recipe recipe = recipeRepository.findBySlugWithIngredients(normalizedSlug)
                .or(() -> recipeRepository.findByNameIgnoreCaseWithIngredients(normalizedIdentifier))
                .or(() -> recipeRepository.findByNameIgnoreCaseWithIngredients(guessedName))
                .orElseThrow(() -> new AppException("Recipe not found", HttpStatus.NOT_FOUND));
        return toRecipeDto(recipe);
    }

    @Transactional
    public RecipeDto getRecipeByIdentifier(String identifier, String requesterEmail) {
        String normalizedIdentifier = identifier == null ? "" : identifier.trim();
        if (!StringUtils.hasText(normalizedIdentifier)) {
            throw new AppException("Recipe not found", HttpStatus.NOT_FOUND);
        }

        if (NUMERIC_IDENTIFIER_PATTERN.matcher(normalizedIdentifier).matches()) {
            return toRecipeDto(
                    findReadableRecipeById(Long.parseLong(normalizedIdentifier), requesterEmail),
                    requesterEmail
            );
        }

        String normalizedSlug = toRecipeSlug(normalizedIdentifier);
        String guessedName = normalizedSlug.replace('-', ' ');

        Recipe recipe = findReadableRecipeBySlugOrName(normalizedSlug, normalizedIdentifier, guessedName, requesterEmail);

        return toRecipeDto(recipe, requesterEmail);
    }

    @Transactional
    public Page<RecipeDto> getAllRecipes(Pageable pageable) {
        Page<Long> recipeIds = recipeRepository.findRecipeIds(pageable);
        return mapRecipeIdPage(recipeIds, pageable);
    }

    @Transactional
    public Page<RecipeDto> getAllRecipes(Pageable pageable, String requesterEmail) {
        Page<Long> recipeIds = isAdmin(requesterEmail)
                ? recipeRepository.findRecipeIds(pageable)
                : recipeRepository.findRecipeIdsByVisibility(RecipeVisibility.PUBLIC, pageable);
        return mapRecipeIdPage(recipeIds, pageable);
    }

    @Transactional
    public Recipe saveRecipe(RecipeDto recipeDto, String login) {
        User user = userRepository.findByEmailForUpdate(login)
                .orElseThrow(() -> new AppException("User not found", HttpStatus.NOT_FOUND));

        recipeRepository.findByNameAndUser(recipeDto.getName(), user)
                .ifPresent(existing -> {
                    throw new AppException("Recipe '" + recipeDto.getName() + "' already exists for user '" + login + "'", HttpStatus.CONFLICT);
                });

        if (recipeDto.getIngredients() == null || recipeDto.getIngredients().isEmpty()) {
            throw new AppException("Recipe must have at least one ingredient", HttpStatus.BAD_REQUEST);
        }

        Recipe recipe = recipeMapper.toRecipeWithUser(recipeDto, user);
        recipe.setVisibility(RecipeVisibility.PRIVATE);
        if (recipeDto.getServings() > 0) {
            recipe.setServings(recipeDto.getServings());
        }

        List<RecipeIngredient> recipeIngredients = getRecipeIngredients(recipeDto, recipe);

        recipe.setRecipeIngredients(recipeIngredients);
        return recipeRepository.save(recipe);
    }

    @Transactional
    public RecipeDto saveRecipeDto(RecipeDto recipeDto, String login) {
        return toRecipeDto(saveRecipe(recipeDto, login), login);
    }

    public Page<RecipeDto> findRecipesByUserId(long userId, Pageable pageable, String requesterEmail) {
        User requester = userRepository.findByEmail(requesterEmail)
                .orElseThrow(() -> new AppException("Unknown user", HttpStatus.NOT_FOUND));

        boolean canReadRecipes = Objects.equals(requester.getId(), userId) || requester.getRole() == Role.ADMIN;
        if (!canReadRecipes) {
            throw new AppException("You do not have permission to view this user's recipes", HttpStatus.FORBIDDEN);
        }

        User user = Objects.equals(requester.getId(), userId)
                ? requester
                : userRepository.findById(userId)
                        .orElseThrow(() -> new AppException("Unknown user", HttpStatus.NOT_FOUND));
        Page<Long> recipeIds = recipeRepository.findRecipeIdsByUser(user, pageable);
        return mapRecipeIdPage(recipeIds, pageable);
    }

    @Transactional
    public RecipeDto getRecipeByName(String name) {
        Recipe recipe = recipeRepository.findByNameIgnoreCaseWithIngredients(name)
                .orElseThrow(() -> new AppException("Recipe not found", HttpStatus.NOT_FOUND));
        return toRecipeDto(recipe);
    }

    @Transactional
    public RecipeDto getRecipeByName(String name, String requesterEmail) {
        Recipe recipe = findReadableRecipeBySlugOrName("", name, name, requesterEmail);
        return toRecipeDto(recipe, requesterEmail);
    }

    @Transactional
    public RecipeResponseDto deleteRecipe(Long id, String login) {
        Recipe recipe = recipeRepository.findById(id)
                .orElseThrow(() -> new AppException("Recipe not found", HttpStatus.NOT_FOUND));
        if (!Objects.equals(recipe.getUser().getEmail(), login)) {
            throw new AppException("You are not the owner of this recipe", HttpStatus.FORBIDDEN);
        }
        recipe.getInstructions().size();
        RecipeResponseDto recipeResponseDto = recipeMapper.toResponseDto("Recipe deleted successfully", recipe);
        recipeRepository.delete(recipe);
        return recipeResponseDto;
    }

    public RecipeDto updateRecipe(Long id, RecipeDto recipeDto, String login) {
        Recipe recipe = recipeRepository.findById(id)
                .orElseThrow(() -> new AppException("Recipe not found", HttpStatus.NOT_FOUND));
        if (!Objects.equals(recipe.getUser().getEmail(), login)) {
            User user = userRepository.findByEmail(login)
                    .orElseThrow(() -> new AppException("User not found", HttpStatus.NOT_FOUND));
            if (user.getRole() != Role.ADMIN) {
                throw new AppException("You are not the owner of this recipe or an admin", HttpStatus.FORBIDDEN);
            }
        }

        return getRecipeDto(recipeDto, recipe);
    }

    private RecipeDto getRecipeDto(RecipeDto recipeDto, Recipe recipe) {
        if (recipeDto.getIngredients() == null || recipeDto.getIngredients().isEmpty()) {
            throw new AppException("Recipe must have at least one ingredient", HttpStatus.BAD_REQUEST);
        }

        recipe.setName(recipeDto.getName());
        recipe.setDescription(recipeDto.getDescription());
        recipe.setTimeToPrepare(recipeDto.getTimeToPrepare());
        if (recipeDto.getServings() > 0) {
            recipe.setServings(recipeDto.getServings());
        }
        recipe.setInstructions(recipeDto.getInstructions() == null ? List.of() : recipeDto.getInstructions());
        applyNutrition(recipeDto, recipe);

        List<RecipeIngredient> updatedIngredients = getRecipeIngredients(recipeDto, recipe);

        recipeIngredientRepository.deleteAll(recipe.getRecipeIngredients());
        recipe.setRecipeIngredients(updatedIngredients);
        recipeIngredientRepository.saveAll(updatedIngredients);

        return recipeMapper.toRecipeDto(recipeRepository.save(recipe));
    }

    private void applyNutrition(RecipeDto recipeDto, Recipe recipe) {
        if (recipeDto.getNutrition() == null) {
            recipe.setNutritionCalories(null);
            recipe.setNutritionProtein(null);
            recipe.setNutritionCarbs(null);
            recipe.setNutritionFats(null);
            return;
        }

        recipe.setNutritionCalories(recipeDto.getNutrition().getCalories());
        recipe.setNutritionProtein(recipeDto.getNutrition().getProtein());
        recipe.setNutritionCarbs(recipeDto.getNutrition().getCarbs());
        recipe.setNutritionFats(recipeDto.getNutrition().getFats());
    }

    public RecipeDto adminUpdateRecipe(Long id, RecipeDto recipeDto) {
        Recipe recipe = recipeRepository.findById(id)
                .orElseThrow(() -> new AppException("Recipe not found", HttpStatus.NOT_FOUND));

        return getRecipeDto(recipeDto, recipe);
    }

    @Transactional
    public RecipeResponseDto adminDeleteRecipe(Long id) {
        Recipe recipe = recipeRepository.findById(id)
                .orElseThrow(() -> new AppException("Recipe not found", HttpStatus.NOT_FOUND));
        recipe.getInstructions().size(); // Initialize instructions
        RecipeResponseDto recipeResponseDto = recipeMapper.toResponseDto("Recipe deleted successfully by admin", recipe);
        recipeRepository.delete(recipe);
        return recipeResponseDto;
    }

    private List<RecipeIngredient> getRecipeIngredients(RecipeDto recipeDto, Recipe recipe) {
        Map<String, String> normalizedToOriginalName = new LinkedHashMap<>();

        recipeDto.getIngredients().forEach(dto -> {
            String originalName = requireIngredientName(dto.getName());
            String normalizedName = normalizeIngredientName(originalName);
            normalizedToOriginalName.putIfAbsent(normalizedName, originalName);
        });

        Map<String, Ingredient> ingredientsByNormalizedName = ingredientRepository
                .findAllByLowerNameIn(normalizedToOriginalName.keySet())
                .stream()
                .collect(Collectors.toMap(
                        ingredient -> normalizeIngredientName(ingredient.getName()),
                        Function.identity(),
                        (first, second) -> first,
                        LinkedHashMap::new
                ));

        List<Ingredient> missingIngredients = normalizedToOriginalName.entrySet().stream()
                .filter(entry -> !ingredientsByNormalizedName.containsKey(entry.getKey()))
                .map(entry -> new Ingredient(null, entry.getValue(), new ArrayList<>()))
                .collect(Collectors.toCollection(ArrayList::new));

        if (!missingIngredients.isEmpty()) {
            ingredientRepository.saveAll(missingIngredients).forEach(ingredient ->
                    ingredientsByNormalizedName.put(normalizeIngredientName(ingredient.getName()), ingredient)
            );
        }

        return recipeDto.getIngredients().stream()
                .map(dto -> {
                    String normalizedName = normalizeIngredientName(requireIngredientName(dto.getName()));
                    Ingredient ingredient = ingredientsByNormalizedName.get(normalizedName);

                    if (ingredient == null) {
                        throw new AppException("Could not resolve ingredient: " + dto.getName(), HttpStatus.INTERNAL_SERVER_ERROR);
                    }

                    RecipeIngredient recipeIngredient = new RecipeIngredient();
                    recipeIngredient.setRecipe(recipe);
                    recipeIngredient.setIngredient(ingredient);
                    recipeIngredient.setAmount(dto.getAmount());
                    recipeIngredient.setUnit(dto.getUnit());
                    return recipeIngredient;
                })
                .collect(Collectors.toCollection(ArrayList::new));
    }

    private RecipeDto toRecipeDto(Recipe recipe) {
        recipe.getInstructions().size();
        return recipeMapper.toRecipeDto(recipe);
    }

    private String toRecipeSlug(String value) {
        String normalized = value.toLowerCase(Locale.ROOT).trim();
        normalized = normalized.replaceAll("[^a-z0-9]+", "-");
        normalized = normalized.replaceAll("^-+|-+$", "");
        normalized = normalized.replaceAll("-{2,}", "-");
        return normalized;
    }

    public Page<RecipeDto> searchRecipes(String searchTerm, Pageable pageable) {
        String normalizedSearchTerm = searchTerm == null ? "" : searchTerm.trim();
        if (!StringUtils.hasText(normalizedSearchTerm)) {
            return Page.empty(pageable);
        }

        Page<Long> recipeIds = recipeRepository.searchRecipeIds(normalizedSearchTerm, pageable);
        return mapRecipeIdPage(recipeIds, pageable);
    }

    @Transactional
    public Page<RecipeDto> searchRecipes(String searchTerm, Pageable pageable, String requesterEmail) {
        String normalizedSearchTerm = searchTerm == null ? "" : searchTerm.trim();
        if (!StringUtils.hasText(normalizedSearchTerm)) {
            return Page.empty(pageable);
        }

        Optional<User> requester = StringUtils.hasText(requesterEmail)
                ? userRepository.findByEmail(requesterEmail)
                : Optional.empty();
        Page<Long> recipeIds;
        if (requester.map(user -> user.getRole() == Role.ADMIN).orElse(false)) {
            recipeIds = recipeRepository.searchRecipeIds(normalizedSearchTerm, pageable);
        } else if (requester.isPresent()) {
            recipeIds = recipeRepository.searchRecipeIdsByUser(
                    normalizedSearchTerm,
                    requester.get(),
                    pageable
            );
        } else {
            recipeIds = recipeRepository.searchRecipeIdsByVisibility(
                    normalizedSearchTerm,
                    RecipeVisibility.PUBLIC,
                    pageable
            );
        }
        return mapRecipeIdPage(recipeIds, pageable);
    }

    @Transactional
    public RecipeDto publishRecipe(Long id, String requesterEmail) {
        Recipe recipe = findRecipeForMutation(id, requesterEmail);
        recipe.setVisibility(RecipeVisibility.PUBLIC);
        return toRecipeDto(recipeRepository.save(recipe), requesterEmail);
    }

    @Transactional
    public RecipeDto unpublishRecipe(Long id, String requesterEmail) {
        Recipe recipe = findRecipeForMutation(id, requesterEmail);
        recipe.setVisibility(RecipeVisibility.PRIVATE);
        return toRecipeDto(recipeRepository.save(recipe), requesterEmail);
    }

    @Transactional
    public List<RecipeSitemapEntry> getPublicRecipeSitemapEntries() {
        return recipeRepository.findPublicSitemapEntries(RecipeVisibility.PUBLIC);
    }

    private Recipe findReadableRecipeById(Long id, String requesterEmail) {
        Optional<Recipe> publicRecipe = recipeRepository.findByIdWithIngredientsAndVisibility(
                id,
                RecipeVisibility.PUBLIC
        );
        if (publicRecipe.isPresent()) {
            return publicRecipe.get();
        }

        if (canReadPrivateRecipes(requesterEmail, id)) {
            return recipeRepository.findByIdWithIngredients(id)
                    .orElseThrow(() -> new AppException("Recipe not found", HttpStatus.NOT_FOUND));
        }

        throw new AppException("Recipe not found", HttpStatus.NOT_FOUND);
    }

    private Recipe findReadableRecipeBySlugOrName(
            String slug,
            String requestedName,
            String guessedName,
            String requesterEmail
    ) {
        Optional<Recipe> publicRecipe = StringUtils.hasText(slug)
                ? recipeRepository.findBySlugWithIngredientsAndVisibility(slug, RecipeVisibility.PUBLIC)
                : Optional.empty();
        if (publicRecipe.isEmpty()) {
            publicRecipe = recipeRepository.findByNameIgnoreCaseWithIngredientsAndVisibility(
                    requestedName,
                    RecipeVisibility.PUBLIC
            );
        }
        if (publicRecipe.isEmpty() && !Objects.equals(requestedName, guessedName)) {
            publicRecipe = recipeRepository.findByNameIgnoreCaseWithIngredientsAndVisibility(
                    guessedName,
                    RecipeVisibility.PUBLIC
            );
        }
        if (publicRecipe.isPresent()) {
            return publicRecipe.get();
        }

        if (StringUtils.hasText(requesterEmail)) {
            User requester = userRepository.findByEmail(requesterEmail).orElse(null);
            if (requester != null) {
                Optional<Recipe> privateRecipe = StringUtils.hasText(slug)
                        ? requester.getRole() == Role.ADMIN
                            ? recipeRepository.findBySlugWithIngredients(slug)
                            : recipeRepository.findBySlugWithIngredientsAndUser(slug, requester)
                        : requester.getRole() == Role.ADMIN
                            ? recipeRepository.findByNameIgnoreCaseWithIngredients(requestedName)
                            : recipeRepository.findByNameIgnoreCaseWithIngredientsAndUser(requestedName, requester);
                if (privateRecipe.isPresent()
                        && (requester.getRole() == Role.ADMIN
                        || Objects.equals(privateRecipe.get().getUser().getId(), requester.getId()))) {
                    return privateRecipe.get();
                }
            }
        }

        throw new AppException("Recipe not found", HttpStatus.NOT_FOUND);
    }

    private Recipe findRecipeForMutation(Long id, String requesterEmail) {
        Recipe recipe = recipeRepository.findById(id)
                .orElseThrow(() -> new AppException("Recipe not found", HttpStatus.NOT_FOUND));
        User requester = userRepository.findByEmail(requesterEmail)
                .orElseThrow(() -> new AppException("User not found", HttpStatus.NOT_FOUND));
        if (requester.getRole() != Role.ADMIN && !Objects.equals(recipe.getUser().getId(), requester.getId())) {
            throw new AppException("You are not the owner of this recipe", HttpStatus.FORBIDDEN);
        }
        return recipe;
    }

    private boolean canReadPrivateRecipes(String requesterEmail, Long recipeId) {
        if (!StringUtils.hasText(requesterEmail)) {
            return false;
        }
        User requester = userRepository.findByEmail(requesterEmail).orElse(null);
        if (requester == null) {
            return false;
        }
        if (requester.getRole() == Role.ADMIN) {
            return true;
        }
        return recipeRepository.findById(recipeId)
                .map(recipe -> Objects.equals(recipe.getUser().getId(), requester.getId()))
                .orElse(false);
    }

    private boolean isAdmin(String requesterEmail) {
        return StringUtils.hasText(requesterEmail)
                && userRepository.findByEmail(requesterEmail)
                .map(user -> user.getRole() == Role.ADMIN)
                .orElse(false);
    }

    private RecipeDto toRecipeDto(Recipe recipe, String requesterEmail) {
        RecipeDto recipeDto = toRecipeDto(recipe);
        recipeDto.setCanManage(canManageRecipe(recipe, requesterEmail));
        return recipeDto;
    }

    private boolean canManageRecipe(Recipe recipe, String requesterEmail) {
        if (!StringUtils.hasText(requesterEmail)) {
            return false;
        }
        if (recipe.getUser() != null && Objects.equals(recipe.getUser().getEmail(), requesterEmail)) {
            return true;
        }
        return userRepository.findByEmail(requesterEmail)
                .map(requester -> requester.getRole() == Role.ADMIN)
                .orElse(false);
    }

    private Page<RecipeDto> mapRecipeIdPage(Page<Long> recipeIds, Pageable pageable) {
        List<Long> ids = recipeIds.getContent();
        if (ids.isEmpty()) {
            return new PageImpl<>(List.of(), pageable, recipeIds.getTotalElements());
        }

        Map<Long, Recipe> recipesById = recipeRepository.findAllWithIngredientsByIdIn(ids)
                .stream()
                .collect(Collectors.toMap(Recipe::getId, Function.identity()));

        // Instructions are loaded separately to avoid Hibernate's multiple bag fetch restriction.
        recipesById.values().forEach(recipe -> recipe.getInstructions().size());

        List<RecipeDto> recipeDtos = ids.stream()
                .map(recipesById::get)
                .filter(Objects::nonNull)
                .map(recipeMapper::toRecipeDto)
                .collect(Collectors.toList());

        return new PageImpl<>(recipeDtos, pageable, recipeIds.getTotalElements());
    }

    private String requireIngredientName(String ingredientName) {
        if (!StringUtils.hasText(ingredientName)) {
            throw new AppException("Ingredient name cannot be empty", HttpStatus.BAD_REQUEST);
        }
        return ingredientName.trim();
    }

    private String normalizeIngredientName(String ingredientName) {
        return ingredientName.trim().toLowerCase(Locale.ROOT);
    }

}
