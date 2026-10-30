package org.jakub.backendapi.dto;

import jakarta.validation.constraints.*;
import org.jakub.backendapi.dto.MealPlanDto.Store;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

public final class StoreOfferDto {
    private StoreOfferDto() {}
    /** Only verified, nationwide, fixed-size packages are supported in this pilot. */
    public record Publish(@Min(0) long version, @NotNull Store store,
            @NotNull Long ingredientId, @NotBlank @Size(max = 200) String productName,
            @NotNull @DecimalMin("0.001") @DecimalMax("1000000") @Digits(integer = 7, fraction = 3) BigDecimal packageAmount,
            @NotNull @Pattern(regexp = "g|ml|pcs") String unit,
            @NotNull @DecimalMin("0.01") @DecimalMax("100000") @Digits(integer = 6, fraction = 2) BigDecimal packagePrice,
            @Min(1) @Max(1000) int minimumPackages, @Min(1) @Max(1000) int packageMultiple,
            @Min(1) @Max(1000) Integer maximumPackages, boolean loyaltyRequired,
            @NotNull LocalDate validFrom, @NotNull LocalDate validTo,
            @NotBlank @Size(max = 1000) String sourceUrl,
            @NotBlank @Size(max = 1000) String conditions,
            @NotNull Instant verifiedAt, @AssertTrue boolean nationwide,
            @AssertTrue boolean fixedPackage, @AssertTrue boolean conditionsVerified) {}
    public record Offer(UUID id, long version, boolean active, Publish details) {}
    public record QuoteRequest(@Min(0) long version, @NotNull LocalDate shoppingDate,
                               @NotNull @Size(max = 2) Set<@NotNull Store> loyaltyStores) {}
    public enum BudgetStatus { WITHIN_BUDGET, OVER_BUDGET, INCOMPLETE }
    public enum MissingReason { NO_ELIGIBLE_OFFER, CHECK_QUANTITY }
    public record PricedItem(String key, String name, Offer offer, BigDecimal packages,
                             BigDecimal purchasedAmount, BigDecimal leftoverAmount, BigDecimal cost,
                             MissingReason missingReason) {}
    public record Basket(String option, Set<Store> stores, List<PricedItem> items,
                         BigDecimal knownTotal, int pricedItems, int missingItems, BudgetStatus budgetStatus) {}
    public record Quote(UUID planId, long planVersion, LocalDate shoppingDate, Instant calculatedAt,
                        Instant expiresAt, BigDecimal budget, List<Basket> baskets) {}
}
