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
    public Quote quote(String email, UUID id, QuoteRequest input) {
        View plan = plans.get(email, id);
        if (plan.version() != input.version()) throw new AppException("Plan changed. Reload before pricing.", HttpStatus.CONFLICT);
        if (plan.plan().status() != Status.ACCEPTED || plan.plan().shopping() == null)
            throw new AppException("Accept the plan before pricing.", HttpStatus.CONFLICT);
        LocalDate today = LocalDate.now(ZoneId.of("Europe/Warsaw"));
        LocalDate firstMeal = plan.plan().slots().stream().filter(s -> s.recipe() != null && !s.skipped())
                .map(Slot::date).min(LocalDate::compareTo).orElse(plan.plan().settings().startDate());
        if (input.shoppingDate().isBefore(today) || input.shoppingDate().isAfter(today.plusDays(7))
                || input.shoppingDate().isAfter(firstMeal))
            throw new AppException("Choose a shopping date in the next seven days, no later than the first meal.", HttpStatus.BAD_REQUEST);
        Instant now = Instant.now();
        return calculate(plan, input, offers.eligible(plan.plan().settings().stores(), input.shoppingDate(), now), now);
    }
    public Quote calculate(View plan, QuoteRequest input, List<Offer> available, Instant now) {
        var settings = plan.plan().settings();
        List<Offer> eligible = available.stream().filter(offer -> {
            var d = offer.details();
            return offer.active() && settings.stores().contains(d.store()) && d.nationwide() && d.fixedPackage()
                    && d.conditionsVerified() && !input.shoppingDate().isBefore(d.validFrom()) && !input.shoppingDate().isAfter(d.validTo())
                    && !d.verifiedAt().isBefore(now.minus(StoreOfferService.MAX_AGE)) && !d.verifiedAt().isAfter(now)
                    && (!d.loyaltyRequired() || input.loyaltyStores().contains(d.store()));
        }).toList();
        Map<String, Long> identities = new HashMap<>();
        for (ShoppingItem item : plan.plan().shopping().items()) {
            var resolution = names.resolve(item.name(), settings.locale());
            if (resolution.isResolved()) identities.put(item.key(), resolution.ingredient().getId());
        }
        List<Basket> baskets = new ArrayList<>();
        settings.stores().stream().sorted().forEach(store -> baskets.add(basket(store.name(), Set.of(store), plan, eligible, identities)));
        if (settings.stores().size() > 1) baskets.add(basket("COMBINED", settings.stores(), plan, eligible, identities));
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
        BudgetStatus status = total.compareTo(plan.plan().settings().budget()) > 0 ? BudgetStatus.OVER_BUDGET
                : missing > 0 ? BudgetStatus.INCOMPLETE : BudgetStatus.WITHIN_BUDGET;
        return new Basket(option, stores, List.copyOf(rows), total, rows.size() - missing, missing, status);
    }
    private PricedItem price(ShoppingItem item, Offer offer) {
        Publish d = offer.details();
        BigDecimal needed = BigDecimal.valueOf(item.amount());
        BigDecimal multiple = BigDecimal.valueOf(d.packageMultiple());
        BigDecimal count = needed.divide(d.packageAmount(), 0, RoundingMode.CEILING)
                .max(BigDecimal.valueOf(d.minimumPackages())).divide(multiple, 0, RoundingMode.CEILING).multiply(multiple);
        if (d.maximumPackages() != null && count.compareTo(BigDecimal.valueOf(d.maximumPackages())) > 0) return null;
        BigDecimal purchased = count.multiply(d.packageAmount());
        return new PricedItem(item.key(), item.name(), offer, count, purchased, purchased.subtract(needed),
                count.multiply(d.packagePrice()).setScale(2, RoundingMode.UNNECESSARY), null);
    }
    private PricedItem missing(ShoppingItem item, MissingReason reason) {
        return new PricedItem(item.key(), item.name(), null, null, null, null, null, reason);
    }
}
