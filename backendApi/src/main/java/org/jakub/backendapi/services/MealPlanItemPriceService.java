package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.dto.StoreOfferDto.*;
import org.jakub.backendapi.entities.MealPlanItemPrice;
import org.jakub.backendapi.repositories.*;
import org.jakub.backendapi.exceptions.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import java.math.*;
import java.time.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
public class MealPlanItemPriceService {
    private final MealPlanItemPriceRepository repository;
    private final MealPlanRepository planRepository;
    private final MealPlanService plans;
    private final ObjectMapper json;
    public MealPlanItemPriceService(MealPlanItemPriceRepository repository, MealPlanRepository planRepository, MealPlanService plans, ObjectMapper json) {
        this.repository = repository; this.planRepository = planRepository; this.plans = plans; this.json = json;
    }
    @Transactional
    public View save(String email, UUID planId, PriceInput input) {
        var entity = planRepository.findOwnedForUpdate(planId, email).orElseThrow(() -> error(HttpStatus.NOT_FOUND));
        if (entity.getVersion() != input.version()) throw error(HttpStatus.CONFLICT);
        var plan = plans.get(email, planId);
        LocalDate today = LocalDate.now(ZoneId.of("Europe/Warsaw"));
        if (!plan.plan().settings().stores().contains(input.store())
                || !PlanPricingDates.allows(plan.plan(), input.shoppingDate(), today)) throw error(HttpStatus.BAD_REQUEST);
        var item = plans.previewShopping(email, planId, plan.plan().slots()).items().stream()
                .filter(i -> i.key().equals(input.key())).findFirst().orElseThrow(() -> error(HttpStatus.NOT_FOUND));
        if (item.needsReview() || item.amount() == null || item.amount() <= 0 || !Set.of("g", "ml", "pcs").contains(item.unit())
                || item.unit().equals("pcs") && input.packageAmount().stripTrailingZeros().scale() > 0) throw error(HttpStatus.BAD_REQUEST);
        UUID id = UUID.nameUUIDFromBytes((planId + ":" + input.key() + ":" + input.store() + ":" + input.shoppingDate()).getBytes(StandardCharsets.UTF_8));
        var value = repository.findById(id).orElseGet(MealPlanItemPrice::new);
        value.setId(id); value.setPlan(entity); value.setItemKey(input.key()); value.setStore(input.store()); value.setShoppingDate(input.shoppingDate());
        value.setDocument(json.writeValueAsString(new ManualPrice(id, input.key(), input.store(), input.shoppingDate(), input.packageAmount(), item.unit(), input.packagePrice(), Instant.now())));
        repository.saveAndFlush(value);
        return plans.priceChanged(email, planId, input.version());
    }
    @Transactional
    public View remove(String email, UUID planId, UUID priceId, long version) {
        var plan = planRepository.findOwnedForUpdate(planId, email).orElseThrow(() -> error(HttpStatus.NOT_FOUND));
        if (plan.getVersion() != version) throw error(HttpStatus.CONFLICT);
        repository.delete(repository.findByIdAndPlanId(priceId, planId).orElseThrow(() -> error(HttpStatus.NOT_FOUND)));
        return plans.priceChanged(email, planId, version);
    }
    @Transactional(readOnly = true)
    public List<ManualPrice> prices(String email, UUID id, LocalDate date, Set<Store> stores) {
        plans.get(email, id);
        return repository.findByPlanIdAndShoppingDateAndStoreIn(id, date, stores).stream()
                .map(p -> json.readValue(p.getDocument(), ManualPrice.class)).toList();
    }
    public PricedItem price(ShoppingItem item, ManualPrice manual) {
        if (item.needsReview() || item.amount() == null || item.amount() <= 0 || !item.unit().equals(manual.unit())) return null;
        BigDecimal required = BigDecimal.valueOf(item.amount());
        BigDecimal packages = required.divide(manual.packageAmount(), 0, RoundingMode.CEILING);
        BigDecimal purchased = packages.multiply(manual.packageAmount());
        return new PricedItem(item.key(), item.name(), null, packages, purchased, purchased.subtract(required),
                packages.multiply(manual.packagePrice()).setScale(2, RoundingMode.UNNECESSARY), null, item.amount(), item.unit(), manual);
    }
    private AppException error(HttpStatus code) { return new AppException("Check the plan version, item quantity, store and shopping date before saving a price.", code); }
}
