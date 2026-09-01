package org.jakub.backendapi.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jakub.backendapi.config.LegacyFridgeItemDeserializer;
import org.jakub.backendapi.entities.Enums.FridgePolicy;
import org.jakub.backendapi.entities.Enums.ShoppingPolicy;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class RecipeGenerationRequestDto {

    private String requestText;

    private String legacyPrompt;

    @Size(max = 100, message = "At most 100 fridge items are allowed")
    @Valid
    @JsonDeserialize(contentUsing = LegacyFridgeItemDeserializer.class)
    private List<@Valid FridgeIngredientDto> fridgeItems;

    @Pattern(regexp = "en|pl", message = "Locale must be 'en' or 'pl'")
    private String locale;

    @Min(value = 1, message = "Recipe count must be between 1 and 5")
    @Max(value = 5, message = "Recipe count must be between 1 and 5")
    private Integer count;

    @Min(value = 1, message = "Servings must be between 1 and 100")
    @Max(value = 100, message = "Servings must be between 1 and 100")
    private Integer servings = 2;

    @NotNull(message = "Fridge policy is required")
    private FridgePolicy fridgePolicy = FridgePolicy.SUGGEST;

    @NotNull(message = "Shopping policy is required")
    private ShoppingPolicy shoppingPolicy = ShoppingPolicy.ALLOWED;

    @Size(max = 100, message = "At most 100 fridge items may be mandatory")
    private List<@Positive(message = "Fridge item IDs must be positive") Long> mustUseFridgeItemIds;

    @Valid
    private RecipeGenerationPreferencesDto preferences;

    public RecipeGenerationRequestDto() {
    }

    /** Source-compatible constructor for the previous prompt + names payload. */
    public RecipeGenerationRequestDto(String prompt, List<?> fridgeItems) {
        this(prompt, fridgeItems, null, null);
    }

    /** Source-compatible constructor for the previous prompt + names payload. */
    public RecipeGenerationRequestDto(String prompt, List<?> fridgeItems, String locale, Integer count) {
        this.legacyPrompt = prompt;
        this.fridgeItems = adaptFridgeItems(fridgeItems);
        this.locale = locale;
        this.count = count;
    }

    @JsonProperty("requestText")
    public String requestText() {
        return hasText(requestText) ? requestText : legacyPrompt;
    }

    public String getRequestText() {
        return requestText();
    }

    public void setRequestText(String requestText) {
        this.requestText = requestText;
    }

    public String prompt() {
        return getPrompt();
    }

    @JsonProperty(value = "prompt", access = JsonProperty.Access.WRITE_ONLY)
    @NotBlank(message = "Prompt is required")
    @Size(max = 2_000, message = "Prompt must not exceed 2000 characters")
    public String getPrompt() {
        return requestText();
    }

    @JsonProperty("prompt")
    public void setPrompt(String prompt) {
        this.legacyPrompt = prompt;
    }

    public List<FridgeIngredientDto> fridgeItems() {
        return immutableCopy(fridgeItems);
    }

    public List<FridgeIngredientDto> getFridgeItems() {
        return fridgeItems();
    }

    public void setFridgeItems(List<FridgeIngredientDto> fridgeItems) {
        this.fridgeItems = fridgeItems;
    }

    public String locale() {
        return locale;
    }

    public String getLocale() {
        return locale();
    }

    public void setLocale(String locale) {
        this.locale = locale;
    }

    public Integer count() {
        return count;
    }

    public Integer getCount() {
        return count();
    }

    public void setCount(Integer count) {
        this.count = count;
    }

    public Integer servings() {
        return servings == null ? 2 : servings;
    }

    public Integer getServings() {
        return servings();
    }

    public void setServings(Integer servings) {
        this.servings = servings;
    }

    public FridgePolicy fridgePolicy() {
        return fridgePolicy;
    }

    public FridgePolicy getFridgePolicy() {
        return fridgePolicy();
    }

    public void setFridgePolicy(FridgePolicy fridgePolicy) {
        this.fridgePolicy = fridgePolicy;
    }

    public ShoppingPolicy shoppingPolicy() {
        return shoppingPolicy;
    }

    public ShoppingPolicy getShoppingPolicy() {
        return shoppingPolicy();
    }

    public void setShoppingPolicy(ShoppingPolicy shoppingPolicy) {
        this.shoppingPolicy = shoppingPolicy;
    }

    public List<Long> mustUseFridgeItemIds() {
        return immutableCopy(mustUseFridgeItemIds);
    }

    public List<Long> getMustUseFridgeItemIds() {
        return mustUseFridgeItemIds();
    }

    public void setMustUseFridgeItemIds(List<Long> mustUseFridgeItemIds) {
        this.mustUseFridgeItemIds = mustUseFridgeItemIds;
    }

    public RecipeGenerationPreferencesDto preferences() {
        return preferences;
    }

    public RecipeGenerationPreferencesDto getPreferences() {
        return preferences();
    }

    public void setPreferences(RecipeGenerationPreferencesDto preferences) {
        this.preferences = preferences;
    }

    @JsonIgnore
    public boolean isLegacyPayload() {
        return !hasText(requestText) && legacyPrompt != null;
    }

    @JsonIgnore
    public List<String> legacyFridgeItemNames() {
        return fridgeItems().stream()
                .map(FridgeIngredientDto::getName)
                .filter(this::hasText)
                .toList();
    }

    @AssertTrue(message = "Mandatory fridge items must be present and unique")
    @JsonIgnore
    public boolean hasValidMandatoryFridgeItems() {
        List<Long> ids = mustUseFridgeItemIds();
        Set<Long> availableIds = new HashSet<>();
        for (FridgeIngredientDto item : fridgeItems()) {
            if (item != null && item.getId() != null) {
                availableIds.add(item.getId());
            }
        }
        return new HashSet<>(ids).size() == ids.size() && availableIds.containsAll(ids);
    }

    @AssertTrue(message = "Fridge items cannot be mandatory when fridge policy is IGNORE")
    @JsonIgnore
    public boolean hasCompatiblePolicies() {
        return fridgePolicy != FridgePolicy.IGNORE || mustUseFridgeItemIds().isEmpty();
    }

    private List<FridgeIngredientDto> adaptFridgeItems(List<?> items) {
        if (items == null) {
            return null;
        }

        List<FridgeIngredientDto> adapted = new ArrayList<>();
        for (Object item : items) {
            if (item instanceof FridgeIngredientDto fridgeItem) {
                adapted.add(fridgeItem);
            } else if (item instanceof String name) {
                adapted.add(new FridgeIngredientDto(null, name, null, null, null));
            } else {
                throw new IllegalArgumentException("Fridge items must be objects or names");
            }
        }
        return adapted;
    }

    private <T> List<T> immutableCopy(List<T> values) {
        return values == null ? List.of() : Collections.unmodifiableList(new ArrayList<>(values));
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
