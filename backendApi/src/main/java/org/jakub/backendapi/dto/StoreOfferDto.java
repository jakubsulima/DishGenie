package org.jakub.backendapi.dto;

import jakarta.validation.constraints.*;
import org.jakub.backendapi.dto.MealPlanDto.Store;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

public final class StoreOfferDto {
    private StoreOfferDto() {}
    /** Verified nationwide packages, exact bundles and declared loose-weight price bases. */
    public record Publish(@Min(0) long version, @NotNull Store store,
            @NotNull Long ingredientId, @NotBlank @Size(max = 200) String productName,
            @NotNull @DecimalMin("0.001") @DecimalMax("1000000") @Digits(integer = 7, fraction = 3) BigDecimal packageAmount,
            @NotNull @Pattern(regexp = "g|ml|pcs") String unit,
            @DecimalMin("0.01") @DecimalMax("100000") @Digits(integer = 6, fraction = 2) BigDecimal packagePrice,
            @Min(1) @Max(1000) int minimumPackages, @Min(1) @Max(1000) int packageMultiple,
            @Min(1) @Max(1000) Integer maximumPackages, boolean loyaltyRequired,
            @NotNull LocalDate validFrom, @NotNull LocalDate validTo,
            @NotBlank @Size(max = 1000) String sourceUrl,
            @NotBlank @Size(max = 1000) String conditions,
            @NotNull Instant verifiedAt, @AssertTrue boolean nationwide,
            boolean fixedPackage, @AssertTrue boolean conditionsVerified,
            Boolean couponRequired,
            @DecimalMin("0.01") @DecimalMax("100000") @Digits(integer = 6, fraction = 2) BigDecimal bundlePrice,
            @Min(1) @Max(1000) Integer bundleSize,
            @DecimalMin("0.01") @DecimalMax("100000") @Digits(integer = 6, fraction = 2) BigDecimal regularPrice,
            @Pattern(regexp = "VEGETABLES|FRUIT|MEAT_FISH|DAIRY|DRY|OTHER") String category,
            boolean weighted, @DecimalMin("0.001") @DecimalMax("1000000") @Digits(integer = 7, fraction = 3) BigDecimal weightStep, @DecimalMin("0.001") @DecimalMax("1000000") @Digits(integer = 7, fraction = 3) BigDecimal maximumAmount) {
        public Publish { category = category == null ? "OTHER" : category; couponRequired = couponRequired == null ? loyaltyRequired : couponRequired; }
        public Publish(long version, Store store, Long ingredientId, String productName, BigDecimal packageAmount,
                       String unit, BigDecimal packagePrice, int minimumPackages, int packageMultiple, Integer maximumPackages,
                       boolean loyaltyRequired, LocalDate validFrom, LocalDate validTo, String sourceUrl, String conditions,
                       Instant verifiedAt, boolean nationwide, boolean fixedPackage, boolean conditionsVerified) {
            this(version, store, ingredientId, productName, packageAmount, unit, packagePrice, minimumPackages,
                 packageMultiple, maximumPackages, loyaltyRequired, validFrom, validTo, sourceUrl, conditions,
                 verifiedAt, nationwide, fixedPackage, conditionsVerified, null, null, null, null, null, false, null, null);
        }
    }
    public record Offer(UUID id, long version, boolean active, Publish details, String sourceType, String ingredientKey) {
        public Offer(UUID id, long version, boolean active, Publish details) { this(id, version, active, details, "MANUAL", null); }
    }
    public record SourceStatus(Store store, String status, int offers, Instant fetchedAt) {}
    public record QuoteRequest(@Min(0) long version, @NotNull LocalDate shoppingDate,
                               @NotNull @Size(max = 2) Set<@NotNull Store> loyaltyStores,
                               @Size(max = 100) Set<@NotNull UUID> confirmedCouponOffers) {
        public QuoteRequest { confirmedCouponOffers = confirmedCouponOffers == null ? Set.of() : confirmedCouponOffers; }
        public QuoteRequest(long version, LocalDate shoppingDate, Set<Store> loyaltyStores) {
            this(version, shoppingDate, loyaltyStores, Set.of());
        }
    }
    public record LeafletSummary(String title, String sourceUrl, String pdfSha256, LocalDate startDate, int pages, int candidates,
            int reviewedCandidates, int products, int priceVariants, Map<String, Integer> excludedReasons,
            double importSeconds, String paidApiCostUsd, boolean cacheHit) {}
    public record Catalog(LocalDate shoppingDate, List<Offer> offers, String sourceStatus, LeafletSummary importSummary) {
        public Catalog(LocalDate shoppingDate, List<Offer> offers, String sourceStatus) { this(shoppingDate, offers, sourceStatus, null); }
    }
    public enum BudgetStatus { WITHIN_BUDGET, OVER_BUDGET, INCOMPLETE, NO_BUDGET }
    public enum MissingReason { NO_ELIGIBLE_OFFER, CHECK_QUANTITY }
    public record PriceInput(@Min(0) long version, @NotBlank @Size(max = 64) String key, @NotNull Store store,
                             @NotNull LocalDate shoppingDate,
                             @NotNull @DecimalMin("0.001") @DecimalMax("1000000") @Digits(integer = 7, fraction = 3) BigDecimal packageAmount,
                             @NotNull @DecimalMin("0.01") @DecimalMax("100000") @Digits(integer = 6, fraction = 2) BigDecimal packagePrice) {}
    public record ManualPrice(UUID id, String key, Store store, LocalDate shoppingDate, BigDecimal packageAmount,
                              String unit, BigDecimal packagePrice, Instant confirmedAt) {}
    public record PricedItem(String key, String name, Offer offer, BigDecimal packages,
                             BigDecimal purchasedAmount, BigDecimal leftoverAmount, BigDecimal cost,
                             MissingReason missingReason, Double requiredAmount, String unit, ManualPrice manualPrice) {
        public PricedItem(String key, String name, Offer offer, BigDecimal packages, BigDecimal purchasedAmount,
                          BigDecimal leftoverAmount, BigDecimal cost, MissingReason missingReason) {
            this(key, name, offer, packages, purchasedAmount, leftoverAmount, cost, missingReason, null, null, null);
        }
    }
    public record Basket(String option, Set<Store> stores, List<PricedItem> items,
                         BigDecimal knownTotal, int pricedItems, int missingItems, BudgetStatus budgetStatus) {}
    public record Quote(UUID planId, long planVersion, LocalDate shoppingDate, Instant calculatedAt,
                        Instant expiresAt, BigDecimal budget, List<Basket> baskets, List<SourceStatus> sources) {
        public Quote(UUID planId, long planVersion, LocalDate shoppingDate, Instant calculatedAt,
                     Instant expiresAt, BigDecimal budget, List<Basket> baskets) {
            this(planId, planVersion, shoppingDate, calculatedAt, expiresAt, budget, baskets, List.of());
        }
    }
}
