package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.MealPlanDto.Store;
import org.jakub.backendapi.dto.StoreOfferDto.*;
import org.jakub.backendapi.entities.*;
import org.jakub.backendapi.repositories.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

@Service
public class LidlCatalogStore {
    public static final String SOURCE_TYPE = "LIDL_PUBLIC";
    public static final int SOURCE_VERSION = 5;
    public record Result(UUID id, Instant fetchedAt, String status, int candidates, int published, int sourceVersion) {}
    private final StoreOfferRepository repository;
    private final IngredientRepository ingredients;
    private final StoreOfferService offers;
    private final OfferSourceRunRepository runs;
    private final ObjectMapper json;
    public LidlCatalogStore(StoreOfferRepository repository, IngredientRepository ingredients, StoreOfferService offers,
                            OfferSourceRunRepository runs, ObjectMapper json) {
        this.repository = repository; this.ingredients = ingredients; this.offers = offers; this.runs = runs; this.json = json;
    }
    @Transactional
    public Result save(List<LidlPriceParser.Price> prices, int candidates, boolean allPagesFetched, Instant fetchedAt) {
        Map<UUID, StoreOffer> old = new HashMap<>(); repository.findBySourceType(SOURCE_TYPE).forEach(o -> old.put(o.getId(), o));
        Set<UUID> kept = new HashSet<>();
        Map<String, BigDecimal> regular = new HashMap<>();
        prices.stream().filter(p -> p.variant().equals("regular")).forEach(p -> regular.put(p.productId(), p.price()));
        for (var p : prices) {
            UUID id = UUID.nameUUIDFromBytes((SOURCE_TYPE + ":" + p.productId() + ":" + p.variant() + ":" + p.from() + ":" + p.to()
                    + ":" + p.price() + ":" + p.conditions()).getBytes(StandardCharsets.UTF_8));
            if (!kept.add(id)) continue;
            Ingredient ingredient = ingredients.findByNameIgnoreCase(p.ingredient().ingredientName()).orElseGet(() -> {
                var added = new Ingredient(null, p.ingredient().ingredientName(), List.of());
                added.setCanonicalName(p.ingredient().ingredientName().toLowerCase(Locale.ROOT)); return ingredients.saveAndFlush(added);
            });
            long version = old.containsKey(id) ? old.get(id).getVersion() : 0;
            var input = new Publish(version, Store.LIDL, ingredient.getId(), p.title(), p.amount(), p.unit(), p.price(),
                    p.minimum(), p.multiple(), p.maximum(), p.loyalty(), p.from(), p.to(), p.sourceUrl(),
                    p.conditions() + (p.ingredient().weighted() ? " Koszt wagowy jest proporcjonalny do planowanej ilości; rzeczywista waga może zmienić cenę." : ""),
                    fetchedAt, true, !p.ingredient().weighted(), true, p.coupon(), null, null,
                    p.variant().equals("promotion") ? regular.get(p.productId()) : null,
                    p.ingredient().category(), p.ingredient().weighted(), p.ingredient().weighted() ? BigDecimal.ONE : null, p.maximumAmount());
            offers.publish(id, input);
            var entity = repository.findById(id).orElseThrow(); entity.setSourceType(SOURCE_TYPE); entity.setIngredientKey(p.ingredient().key());
        }
        // This is a scoped, partial catalog. Only our own previous rows are retired, and only after every source succeeded.
        if (allPagesFetched) old.values().stream().filter(o -> !kept.contains(o.getId())).forEach(o -> o.setActive(false));
        String status = !allPagesFetched ? "LIVE_FETCH_INCOMPLETE" : prices.isEmpty() ? "LIVE_NO_SUPPORTED_PRICES" : "LIVE_PARTIAL";
        Result result = new Result(UUID.randomUUID(), fetchedAt, status, candidates, kept.size(), SOURCE_VERSION);
        var run = new OfferSourceRun(); run.setId(result.id()); run.setCreatedAt(fetchedAt); run.setStatus(status);
        run.setDocument(json.writeValueAsString(result)); runs.saveAndFlush(run);
        return result;
    }
    @Transactional(readOnly = true)
    public Result latest() {
        return runs.findTop30ByOrderByCreatedAtDesc().stream().filter(r -> r.getStatus().startsWith("LIVE_"))
                .findFirst().map(r -> json.readValue(r.getDocument(), Result.class)).orElse(null);
    }
}
