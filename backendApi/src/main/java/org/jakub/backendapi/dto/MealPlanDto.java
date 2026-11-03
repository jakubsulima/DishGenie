package org.jakub.backendapi.dto;

import jakarta.validation.constraints.*;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

public final class MealPlanDto {
    private MealPlanDto() {}
    public enum MealType { LUNCH, DINNER }
    public enum Store { LIDL, BIEDRONKA }
    public enum Status { DRAFT, ACCEPTED }
    public enum Action { LOCK, UNLOCK, SKIP, RESTORE, SERVINGS }
    public enum BudgetMode { NONE, SOFT }
    public enum PlanningMode { DEALS }
    public enum GenerationStatus { RUNNING, COMPLETED, FAILED }

    public record Create(
            @NotNull UUID requestId,
            @NotNull LocalDate startDate,
            @Min(1) @Max(7) int dayCount,
            @Min(1) @Max(100) int servings,
            @NotEmpty @Size(max = 2) Set<@NotNull MealType> mealTypes,
            @NotEmpty @Size(max = 2) Set<@NotNull Store> stores,
            @DecimalMin("0.01") @DecimalMax("100000.00") @Digits(integer = 6, fraction = 2) BigDecimal budget,
            @NotNull @Pattern(regexp = "pl|en") String locale,
            @Min(5) @Max(240) int maxMinutes,
            PlanningMode planningMode, BudgetMode budgetMode, @Valid ShoppingOptions shopping) {
        public Create {
            planningMode = planningMode == null ? PlanningMode.DEALS : planningMode;
            budgetMode = budgetMode == null ? (budget == null ? BudgetMode.NONE : BudgetMode.SOFT) : budgetMode;
            // Old clients selected both stores to compare the combined basket.
            shopping = shopping == null ? new ShoppingOptions(null, 2, Set.of(), Set.of(), Set.of(), true) : shopping;
        }
        public Create(UUID requestId, LocalDate startDate, int dayCount, int servings, Set<MealType> mealTypes,
                      Set<Store> stores, BigDecimal budget, String locale, int maxMinutes) {
            this(requestId, startDate, dayCount, servings, mealTypes, stores, budget, locale, maxMinutes, null, null, null);
        }
        @AssertTrue public boolean isBudgetConsistent() { return (budgetMode == BudgetMode.NONE) == (budget == null); }
    }
    public record ShoppingOptions(LocalDate shoppingDate, @Min(1) @Max(2) int maxStores,
            @NotNull @Size(max = 2) Set<@NotNull Store> loyaltyStores,
            @NotNull @Size(max = 100) Set<@NotNull UUID> confirmedCouponOffers,
            @NotNull @Size(max = 30) Set<@NotNull UUID> selectedOffers, boolean allowRepeats) {}
    public record RevisionRequest(@Min(0) long version, @NotNull UUID requestId,
            @NotNull RevisionIntent intent, @Size(max = 1000) String comment, @Valid RecipeDto recipe,
            @Size(max = 200) String ingredient, @Size(max = 200) String replacement,
            UUID offerId, @Min(5) @Max(240) Integer maxMinutes) {}
    public enum RevisionIntent { MANUAL, SUBSTITUTE, DEAL, FASTER, SIMPLIFY }
    public record ApplyRevision(@Min(0) long version, @NotNull UUID previewId) {}
    public record RevisionPreview(UUID id, long planVersion, UUID slotId, RecipeDto before, RecipeDto after,
                                  Shopping shoppingBefore, Shopping shoppingAfter, Instant expiresAt,
                                  StoreOfferDto.Quote quoteBefore, StoreOfferDto.Quote quoteAfter) {}

    public record SettingsChange(@Min(0) long version, @NotNull @Valid Create settings) {}
    public record Version(@Min(0) long version) {}
    public record Change(@Min(0) long version, @NotNull Action action,
                         @Min(1) @Max(100) Integer servings) {}
    public record Generate(@Min(0) long version, @NotNull UUID requestId) {}
    public record Check(@Min(0) long version, @NotBlank @Size(max = 64) String key, boolean checked) {}

    public record Slot(UUID id, LocalDate date, MealType mealType, int servings,
                       boolean locked, boolean skipped, RecipeDto recipe,
                       UUID generationId, GenerationStatus generationStatus, Instant generationStartedAt) {}
    public record ShoppingItem(String key, String name, Double amount, String unit,
                               double usedFromFridge, List<UUID> slotIds, boolean needsReview) {}
    public record Shopping(Instant calculatedAt, List<ShoppingItem> items, Set<String> checkedKeys,
                           String basketOption, StoreOfferDto.Quote quote, UUID syncRequestId) {
        public Shopping(Instant calculatedAt, List<ShoppingItem> items, Set<String> checkedKeys, String basketOption, StoreOfferDto.Quote quote) { this(calculatedAt, items, checkedKeys, basketOption, quote, null); }
        public Shopping(Instant calculatedAt, List<ShoppingItem> items, Set<String> checkedKeys) { this(calculatedAt, items, checkedKeys, null, null, null); }
    }
    public record SelectBasket(@Min(0) long version, @NotNull @Pattern(regexp = "LIDL|BIEDRONKA|COMBINED") String option,
                               @NotNull @Valid StoreOfferDto.QuoteRequest quote) {}
    public record Document(int schemaVersion, Create settings, Status status, List<Slot> slots, Shopping shopping) {}
    public record View(UUID id, long version, Instant createdAt, Document plan) {}
    public record Summary(UUID id, long version, LocalDate startDate, int dayCount,
                          Status status, int plannedSlots, int totalSlots) {}
    public record GenerationWork(View view, Slot slot, boolean execute) {}
}
