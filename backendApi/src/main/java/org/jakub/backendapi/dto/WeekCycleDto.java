package org.jakub.backendapi.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.*;
import java.util.*;
import java.math.BigDecimal;
import org.jakub.backendapi.dto.MealPlanDto.*;

public final class WeekCycleDto {
    private WeekCycleDto() {}
    public record ExceptionDay(@NotNull LocalDate date, @NotNull MealType mealType,
            boolean skipped, @Min(5) @Max(240) Integer maxMinutes, boolean cookForNext) {
        public ExceptionDay(LocalDate date, MealType mealType, boolean skipped, Integer maxMinutes) { this(date,mealType,skipped,maxMinutes,false); }
    }
    public record Start(@NotNull @Valid Create settings, @NotNull @Size(max=14) List<@Valid ExceptionDay> exceptions,
            @NotNull @Size(max=100) Set<Long> priorityFridgeIds) {}
    public record Started(View view, UUID generationId) {}
    public record Allocation(UUID slotId, int portions, String status, int eatenPortions) {
        public Allocation(UUID slotId,int portions,String status) {this(slotId,portions,status,"EATEN".equals(status)?portions:0);}
    }
    public record Batch(UUID id, LocalDate cookingDate, RecipeDto recipe, int portions, String status,
            List<Allocation> allocations, String inventoryOperationId, boolean inventoryReview, String storage) {}
    public record Cycle(List<ExceptionDay> exceptions, Set<Long> priorityFridgeIds, List<Batch> batches,
            boolean inventoryReview) {}
    public record Command(@Min(0) long version, @NotNull UUID requestId) {}
    public record BatchChange(@Min(0) long version, @NotNull UUID requestId,
            @NotNull @Pattern(regexp="SHARE|MOVE|SKIP|SERVINGS|RECIPE|RELEASE|STORE") String action,
            @NotNull UUID slotId, UUID targetSlotId, @Min(1) @Max(100) Integer portions,
            @Valid RecipeDto recipe, boolean replaceOccupied, boolean keepExtra,
            @Pattern(regexp="STORED|FROZEN|DISCARDED") String storage) {}
    public record ChangePreview(UUID id, long planVersion, String inventoryFingerprint, Instant expiresAt,
            Document after, Shopping shoppingBefore, Shopping shoppingAfter, List<String> unusedProducts,
            List<UUID> affectedSlots) {}
    public record Cook(@Min(0) long version, @NotNull UUID requestId, @Min(1) @Max(1400) int portions,
            boolean updateInventory, @NotBlank String inventoryFingerprint) {}
    public record CookPreview(UUID batchId, long version, String inventoryFingerprint,
            int portions, List<FridgeInventoryChangeRequestDto> changes, Shopping uncovered, List<Allocation> allocations) {}
    public record Eat(@Min(0) long version, @NotNull UUID requestId, @Min(1) @Max(100) int portions) {}
    public record Today(LocalDate date, List<Slot> slots, List<Batch> batches, boolean inventoryReview) {}
    public record Prepare(@Min(0) long version, @NotNull UUID requestId,
            @NotNull @Size(max=100) Set<Long> manualItemIds) {}
    public record TripLine(UUID id, String source, Long manualItemId, String requirementKey, String name,
            Double needed, double fromHome, Double toBuy, String unit, boolean needsReview, List<UUID> slotIds,
            String state, Double purchasedAmount, String purchasedUnit, boolean importToFridge,
            String importStatus, BigDecimal actualPrice, Double suggestedAmount, String department, String store, BigDecimal packages) {
        public TripLine(UUID id,String source,Long manualItemId,String requirementKey,String name,Double needed,double fromHome,Double toBuy,String unit,boolean needsReview,List<UUID> slotIds,String state,Double purchasedAmount,String purchasedUnit,boolean importToFridge,String importStatus,BigDecimal actualPrice,Double suggestedAmount,String department) {
            this(id,source,manualItemId,requirementKey,name,needed,fromHome,toBuy,unit,needsReview,slotIds,state,purchasedAmount,purchasedUnit,importToFridge,importStatus,actualPrice,suggestedAmount,department,null,null);
        }
    }
    public record TripDocument(List<TripLine> lines, String inventoryOperationId, Instant completedAt) {}
    public record TripView(UUID id, UUID planId, long version, String status, Instant createdAt, TripDocument trip) {}
    public record LineChange(@Min(0) long version, @NotNull UUID requestId,
            @NotNull @Pattern(regexp="NEEDED|IN_BASKET|UNAVAILABLE") String state) {}
    public record AddLine(@Min(0) long version, @NotNull UUID requestId, @NotBlank @Size(max=100) String name,
            @Positive Double amount, @Size(max=50) String unit) {}
    public record Purchase(@NotNull UUID lineId, @Positive Double amount, @Size(max=50) String unit,
            boolean importToFridge, @DecimalMin("0") @Digits(integer=6,fraction=2) BigDecimal actualPrice) {}
    public record Confirm(@Min(0) long version, @NotNull UUID requestId,
            @NotNull @Size(max=100) List<@Valid Purchase> purchases) {}
}
