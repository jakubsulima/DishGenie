package org.jakub.backendapi.config;
import org.jakub.backendapi.services.LidlReviewCaptureService;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "app.offers.lidl-review-capture-enabled", havingValue = "true")
public class OfferCaptureSchedule {
    private final LidlReviewCaptureService capture;
    public OfferCaptureSchedule(LidlReviewCaptureService capture) { this.capture = capture; }
    @Scheduled(cron = "0 0 5 * * *", zone = "Europe/Warsaw") public void daily() { capture.capture(); }
}
