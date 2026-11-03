package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.dto.StoreOfferDto.*;
import org.jakub.backendapi.exceptions.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import java.math.*;
import java.time.*;
import java.util.*;

@Service
public class MealPlanPricingService {
    private final MealPlanService plans;
    private final StoreOfferService offers;
    private final IngredientNormalizationService names;
    public MealPlanPricingService(MealPlanService plans, StoreOfferService offers, IngredientNormalizationService names) {
        this.plans = plans; this.offers = offers; this.names = names;
    }
    public Quote quote(String email, UUID id, QuoteRequest input) { return quote(email, id, input, false); }
    public Quote preview(String email, UUID id, QuoteRequest input) { return quote(email, id, input, true); }
    private Quote quote(String email, UUID id, QuoteRequest input, boolean preview) {
        View plan = plans.get(email, id);
        if (plan.version() != input.version()) throw new AppException("Plan changed. Reload before pricing.", HttpStatus.CONFLICT);
        if (!preview && (plan.plan().status() != Status.ACCEPTED || plan.plan().shopping() == null))
            throw new AppException("Accept the plan before pricing.", HttpStatus.CONFLICT);
        LocalDate today = LocalDate.now(ZoneId.of("Europe/Warsaw"));
        LocalDate firstMeal = plan.plan().slots().stream().filter(s -> s.recipe() != null && !s.skipped())
                .map(Slot::date).min(LocalDate::compareTo).orElse(plan.plan().settings().startDate());
        if (input.shoppingDate().isBefore(today) || input.shoppingDate().isAfter(today.plusDays(7))
                || input.shoppingDate().isAfter(firstMeal))
            throw new AppException("Choose a shopping date in the next seven days, no later than the first meal.", HttpStatus.BAD_REQUEST);
        if (preview) plan = new View(plan.id(), plan.version(), plan.createdAt(), new Document(2,
                plan.plan().settings(), plan.plan().status(), plan.plan().slots(), plans.previewShopping(email, id, plan.plan().slots())));
        Instant now = Instant.now();
        var available = offers.eligible(plan.plan().settings().stores(), input.shoppingDate(), now);
        // The original accepted-plan endpoint retains the fixed-package contract for older clients.
        if (!preview) available = available.stream().filter(o -> o.details().fixedPackage() && o.details().bundlePrice() == null).toList();
        return calculate(plan, input, available, now);
    }
    public Quote calculate(View plan, QuoteRequest input, List<Offer> available, Instant now) {
        var settings = plan.plan().settings();
        List<Offer> eligible = available.stream().filter(offer -> {
            var d = offer.details();
            return offer.active() && settings.stores().contains(d.store()) && d.nationwide() && (d.fixedPackage() || d.weighted())
                    && d.conditionsVerified() && !input.shoppingDate().isBefore(d.validFrom()) && !input.shoppingDate().isAfter(d.validTo())
                    && !d.verifiedAt().isBefore(now.minus(StoreOfferService.MAX_AGE)) && !d.verifiedAt().isAfter(now)
                    && (!d.loyaltyRequired() || input.loyaltyStores().contains(d.store()))
                    && (!Boolean.TRUE.equals(d.couponRequired()) || input.confirmedCouponOffers().contains(offer.id()));
        }).toList();
        Map<String, Long> identities = new HashMap<>();
        for (ShoppingItem item : plan.plan().shopping().items()) {
            var resolution = names.resolve(item.name(), settings.locale());
            if (resolution.isResolved()) identities.put(item.key(), resolution.ingredient().getId());
        }
        List<Basket> baskets = new ArrayList<>();
        settings.stores().stream().sorted().forEach(store -> baskets.add(basket(store.name(), Set.of(store), plan, eligible, identities)));
        if (settings.stores().size() > 1 && settings.shopping().maxStores() > 1) baskets.add(basket("COMBINED", settings.stores(), plan, eligible, identities));
        Instant expiresAt = eligible.stream().map(o -> o.details().verifiedAt().plus(StoreOfferService.MAX_AGE))
                .min(Instant::compareTo).filter(expiry -> expiry.isBefore(now.plusSeconds(900))).orElse(now.plusSeconds(900));
        Instant midnight = now.atZone(ZoneId.of("Europe/Warsaw")).toLocalDate().plusDays(1).atStartOfDay(ZoneId.of("Europe/Warsaw")).toInstant();
        if (expiresAt.isAfter(midnight)) expiresAt = midnight;
        return new Quote(plan.id(), plan.version(), input.shoppingDate(), now, expiresAt, settings.budget(), List.copyOf(baskets));
    }
    private Basket basket(String option, Set<Store> stores, View plan, List<Offer> offers, Map<String, Long> identities) {
        List<PricedItem> rows = new ArrayList<>();
        Map<String, Integer> mappedRows = new HashMap<>();
        for (ShoppingItem item : plan.plan().shopping().items()) {
            if (identities.containsKey(item.key()) && item.amount() != null && item.amount() > 0)
                mappedRows.merge(identities.get(item.key()) + "|" + item.unit(), 1, Integer::sum);
        }
        for (ShoppingItem item : plan.plan().shopping().items()) {
            if (item.amount() != null && item.amount() == 0 && !item.needsReview()) continue;
            // A catalog alias may have changed since aggregation. Do not consume the same deal limit twice.
            if (mappedRows.getOrDefault(identities.get(item.key()) + "|" + item.unit(), 0) > 1
                    || item.amount() == null || !Double.isFinite(item.amount()) || item.amount() <= 0 || item.needsReview()) {
                rows.add(missing(item, MissingReason.CHECK_QUANTITY)); continue;
            }
            PricedItem best = offers.stream().filter(o -> stores.contains(o.details().store())
                            && Objects.equals(o.details().ingredientId(), identities.get(item.key()))
                            && o.details().unit().equals(item.unit()))
                    .map(o -> price(item, o)).filter(Objects::nonNull)
                    .min(Comparator.comparing(PricedItem::cost).thenComparing(p -> p.offer().id())).orElse(null);
            rows.add(best == null ? missing(item, MissingReason.NO_ELIGIBLE_OFFER) : best);
        }
        BigDecimal total = rows.stream().map(PricedItem::cost).filter(Objects::nonNull).reduce(new BigDecimal("0.00"), BigDecimal::add);
        int missing = (int) rows.stream().filter(row -> row.missingReason() != null).count();
        BudgetStatus status = plan.plan().settings().budget() != null && total.compareTo(plan.plan().settings().budget()) > 0 ? BudgetStatus.OVER_BUDGET
                : missing > 0 ? BudgetStatus.INCOMPLETE : plan.plan().settings().budget() == null ? BudgetStatus.NO_BUDGET : BudgetStatus.WITHIN_BUDGET;
        return new Basket(option, stores, List.copyOf(rows), total, rows.size() - missing, missing, status);
    }
    private PricedItem price(ShoppingItem item, Offer offer) {
        Publish d = offer.details();
        BigDecimal needed = BigDecimal.valueOf(item.amount());
        if (d.weighted()) {
            BigDecimal purchased = needed.divide(d.weightStep(), 0, RoundingMode.CEILING).multiply(d.weightStep());
            BigDecimal discounted = purchased;
            BigDecimal regular = BigDecimal.ZERO;
            if (d.maximumAmount() != null && purchased.compareTo(d.maximumAmount()) > 0) {
                if (d.regularPrice() == null) return null;
                discounted = d.maximumAmount().divide(d.weightStep(), 0, RoundingMode.FLOOR).multiply(d.weightStep());
                regular = purchased.subtract(discounted);
            }
            BigDecimal cost = discounted.multiply(d.packagePrice());
            if (regular.signum() > 0) cost = cost.add(regular.multiply(d.regularPrice()));
            cost = cost.divide(d.packageAmount(), 2, RoundingMode.HALF_UP);
            return new PricedItem(item.key(), item.name(), offer, null, purchased, purchased.subtract(needed), cost, null);
        }
        BigDecimal multiple = BigDecimal.valueOf(d.packageMultiple());
        BigDecimal required = needed.divide(d.packageAmount(), 0, RoundingMode.CEILING);
        BigDecimal count = required.max(BigDecimal.valueOf(d.minimumPackages()))
                .divide(multiple, 0, RoundingMode.CEILING).multiply(multiple);
        BigDecimal bestCount = null;
        BigDecimal bestCost = null;
        // A complete extra bundle may cost less than buying just the missing pack regularly.
        if (d.maximumPackages() == null || count.compareTo(BigDecimal.valueOf(d.maximumPackages())) <= 0) {
            bestCount = count; bestCost = packageCost(d, count);
        }
        if (d.regularPrice() != null) {
            BigDecimal regularOnly = required.multiply(d.regularPrice());
            if (bestCost == null || regularOnly.compareTo(bestCost) < 0
                    || regularOnly.compareTo(bestCost) == 0 && required.compareTo(bestCount) < 0) {
                bestCount = required; bestCost = regularOnly;
            }
            BigDecimal discounted = required;
            if (d.maximumPackages() != null) discounted = discounted.min(BigDecimal.valueOf(d.maximumPackages()));
            discounted = discounted.divide(multiple, 0, RoundingMode.FLOOR).multiply(multiple);
            if (discounted.signum() > 0 && discounted.compareTo(BigDecimal.valueOf(d.minimumPackages())) >= 0) {
                BigDecimal mixed = packageCost(d, discounted).add(required.subtract(discounted).multiply(d.regularPrice()));
                if (mixed.compareTo(bestCost) < 0 || mixed.compareTo(bestCost) == 0 && required.compareTo(bestCount) < 0) {
                    bestCount = required; bestCost = mixed;
                }
            }
        }
        if (bestCost == null) return null;
        count = bestCount;
        BigDecimal cost = bestCost;
        BigDecimal purchased = count.multiply(d.packageAmount());
        return new PricedItem(item.key(), item.name(), offer, count, purchased, purchased.subtract(needed),
                cost.setScale(2, RoundingMode.UNNECESSARY), null);
    }

    private BigDecimal packageCost(Publish offer, BigDecimal count) {
        return offer.bundlePrice() == null ? count.multiply(offer.packagePrice())
                : count.divide(BigDecimal.valueOf(offer.bundleSize()), 0, RoundingMode.UNNECESSARY).multiply(offer.bundlePrice());
    }
    private PricedItem missing(ShoppingItem item, MissingReason reason) {
        return new PricedItem(item.key(), item.name(), null, null, null, null, null, reason);
    }
}
