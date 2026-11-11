package org.jakub.backendapi.config;

import org.jakub.backendapi.services.LidlPriceCatalogService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.*;

@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "app.offers.lidl-price-import-enabled", havingValue = "true")
public class LiveOfferSchedule {
    private final LidlPriceCatalogService catalog;
    public LiveOfferSchedule(LidlPriceCatalogService catalog) { this.catalog = catalog; }
    @Scheduled(initialDelayString = "${app.offers.initial-delay-ms:5000}", fixedDelayString = "${app.offers.refresh-delay-ms:21600000}")
    public void refresh() { catalog.refresh(false); }
}
