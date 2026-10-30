package org.jakub.backendapi.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

public final class MealPlanDto {
    private MealPlanDto() {}
    public enum MealType { LUNCH, DINNER }
    public enum Store { LIDL, BIEDRONKA }
    public enum Status { DRAFT, ACCEPTED }
    public enum Action { LOCK, UNLOCK, SKIP, RESTORE, SERVINGS }
    public enum GenerationStatus { RUNNING, COMPLETED, FAILED }

    public record Create(
            @NotNull UUID requestId,
            @NotNull LocalDate startDate,
            @Min(1) @Max(7) int dayCount,
            @Min(1) @Max(100) int servings,
            @NotEmpty @Size(max = 2) Set<@NotNull MealType> mealTypes,
            @NotEmpty @Size(max = 2) Set<@NotNull Store> stores,
            @NotNull @DecimalMin("0.01") @DecimalMax("100000.00") @Digits(integer = 6, fraction = 2) BigDecimal budget,
            @NotNull @Pattern(regexp = "pl|en") String locale,
            @Min(5) @Max(240) int maxMinutes) {}

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
    public record Shopping(Instant calculatedAt, List<ShoppingItem> items, Set<String> checkedKeys) {}
    public record Document(int schemaVersion, Create settings, Status status, List<Slot> slots, Shopping shopping) {}
    public record View(UUID id, long version, Instant createdAt, Document plan) {}
    public record Summary(UUID id, long version, LocalDate startDate, int dayCount,
                          Status status, int plannedSlots, int totalSlots) {}
    public record GenerationWork(View view, Slot slot, boolean execute) {}
}
