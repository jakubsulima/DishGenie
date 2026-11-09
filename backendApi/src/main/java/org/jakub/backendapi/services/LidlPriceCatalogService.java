package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.MealPlanDto.Store;
import org.jakub.backendapi.dto.StoreOfferDto.SourceStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.time.*;
import java.util.*;

@Service
public class LidlPriceCatalogService {
    private final LidlReviewCaptureService source;
    private final LidlPriceParser parser;
    private final LidlCatalogStore store;
    private final StoreOfferService offers;
    private final boolean enabled;
    public LidlPriceCatalogService(LidlReviewCaptureService source, LidlPriceParser parser, LidlCatalogStore store,
                                    StoreOfferService offers, @Value("${app.offers.lidl-price-import-enabled:false}") boolean enabled) {
        this.source = source; this.parser = parser; this.store = store; this.offers = offers; this.enabled = enabled;
    }
    public boolean enabled() { return enabled; }
    public void ensureFresh(Set<Store> selected) { if (selected.contains(Store.LIDL)) refresh(false); }
    public synchronized LidlCatalogStore.Result refresh(boolean force) {
        if (!enabled) return store.latest();
        Instant now = Instant.now(); var latest = store.latest();
        long lifetime = force ? 60 : latest != null && Set.of("LIVE_FETCH_INCOMPLETE", "LIVE_NO_SUPPORTED_PRICES").contains(latest.status()) ? 300 : 21600;
        if (latest != null && latest.sourceVersion() == LidlCatalogStore.SOURCE_VERSION && latest.fetchedAt().isAfter(now.minusSeconds(lifetime))
                && latest.fetchedAt().atZone(ZoneId.of("Europe/Warsaw")).toLocalDate().equals(now.atZone(ZoneId.of("Europe/Warsaw")).toLocalDate())) return latest;
        Map<String, List<LidlPriceParser.Price>> supported = new HashMap<>(); Set<String> seen = new HashSet<>(); Set<String> conflicting = new HashSet<>(); boolean complete = true;
        Integer total = null;
        for (int offset = 0; ; offset += LidlReviewCaptureService.PRICE_PAGE_SIZE) {
            if (offset >= LidlReviewCaptureService.MAX_PRICE_PAGES * LidlReviewCaptureService.PRICE_PAGE_SIZE
                    || Instant.now().isAfter(now.plusSeconds(60))) { complete = false; break; }
            LidlReviewCaptureService.PricePage page;
            try { page = source.fetchPricePage(offset); }
            catch (RuntimeException failure) { complete = false; break; }
            if (total == null) total = page.total();
            if (total != page.total()) complete = false;
            for (var product : page.products()) {
                String id = product.path("productId").asText(); seen.add(id);
                var prices = parser.parse(product, now);
                if (conflicting.contains(id)) continue;
                var previous = supported.putIfAbsent(id, prices);
                if (previous != null && !previous.equals(prices)) { supported.remove(id); conflicting.add(id); }
            }
            if (offset + page.items() >= page.total()) break;
            if (page.items() != LidlReviewCaptureService.PRICE_PAGE_SIZE) { complete = false; break; }
        }
        if (total == null || seen.size() != total || !conflicting.isEmpty()) complete = false;
        return store.save(supported.values().stream().flatMap(List::stream).toList(), seen.size(), complete, Instant.now());
    }
    public List<SourceStatus> status(Set<Store> selected, LocalDate day) {
        var latest = store.latest(); Instant now = Instant.now();
        return selected.stream().sorted().map(chain -> {
            int count = offers.eligible(Set.of(chain), day, now).size();
            String status = chain == Store.LIDL && enabled ? latest == null ? "LIVE_NOT_FETCHED" : latest.status()
                    : count > 0 ? "MANUAL_CATALOG" : "SOURCE_NOT_CONNECTED";
            return new SourceStatus(chain, status, count, chain == Store.LIDL && latest != null ? latest.fetchedAt() : null);
        }).toList();
    }
}
