package org.jakub.backendapi;

import org.jakub.backendapi.entities.OfferFeatureSetting;
import org.jakub.backendapi.repositories.OfferFeatureSettingRepository;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

/** Promotion scenarios explicitly opt in; production and access tests remain admin-only by default. */
@TestConfiguration(proxyBeanMethods = false)
public class OffersEnabledTestConfiguration {
    @Bean
    ApplicationRunner enableOffersForScenario(OfferFeatureSettingRepository settings) {
        return args -> {
            var value = settings.findById(1).orElseGet(OfferFeatureSetting::new);
            value.setEnabledForUsers(true);
            settings.saveAndFlush(value);
        };
    }
}
