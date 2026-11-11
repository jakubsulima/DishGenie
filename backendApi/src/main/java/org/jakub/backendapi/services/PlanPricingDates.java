package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.MealPlanDto.Document;
import java.time.LocalDate;

/** Past meals remain in the quote, but cannot make today's shopping impossible. */
public final class PlanPricingDates {
    private PlanPricingDates() {}
    public static boolean allows(Document plan, LocalDate date, LocalDate today) {
        LocalDate fallback = plan.settings().startDate().isBefore(today) ? today.plusDays(7) : plan.settings().startDate();
        LocalDate first = plan.slots().stream().filter(s -> s.recipe() != null && !s.skipped() && !s.date().isBefore(today))
                .map(s -> s.date()).min(LocalDate::compareTo).orElse(fallback);
        return date != null && !date.isBefore(today) && !date.isAfter(today.plusDays(7)) && !date.isAfter(first);
    }
}
