package org.jakub.backendapi.services;
import jakarta.validation.constraints.*;
import org.jakub.backendapi.dto.StoreOfferDto;
import org.jakub.backendapi.entities.MealPlanShoppingIssue;
import org.jakub.backendapi.repositories.*;
import org.jakub.backendapi.exceptions.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.*;
@Service
public class MealPlanShoppingIssueService {
    public enum Reason { MISSING_PRODUCT, PRICE_DIFFERENT }
    public record Input(@NotNull UUID requestId, @Min(0) long version, @NotBlank @Size(max = 64) String key,
                        @NotNull Reason reason, @Size(max = 1000) String comment) {}
    public record Issue(UUID id, UUID planId, Instant createdAt, Input input, StoreOfferDto.Offer offer) {}
    private final MealPlanShoppingIssueRepository issues;
    private final MealPlanRepository repository;
    private final MealPlanService plans;
    private final ObjectMapper json;
    public MealPlanShoppingIssueService(MealPlanShoppingIssueRepository issues, MealPlanRepository repository, MealPlanService plans, ObjectMapper json) {
        this.issues = issues; this.repository = repository; this.plans = plans; this.json = json;
    }
    @Transactional
    public Issue report(String email, UUID planId, Input input) {
        var plan = repository.findOwnedForUpdate(planId, email).orElseThrow(() -> error(HttpStatus.NOT_FOUND));
        var existing = issues.findById(input.requestId());
        if (existing.isPresent()) {
            var issue = read(existing.get());
            if (!issue.planId().equals(planId) || !issue.input().equals(input)) throw error(HttpStatus.CONFLICT);
            return issue;
        }
        var d = plans.get(email, planId).plan();
        if (plan.getVersion() != input.version()) throw error(HttpStatus.CONFLICT);
        if (d.shopping() == null || d.shopping().items().stream().noneMatch(i -> i.key().equals(input.key()))) throw error(HttpStatus.NOT_FOUND);
        var quote = d.shopping().quote();
        var offer = quote == null ? null : quote.baskets().stream().filter(b -> b.option().equals(d.shopping().basketOption()))
                .flatMap(b -> b.items().stream()).filter(i -> i.key().equals(input.key())).map(StoreOfferDto.PricedItem::offer).filter(Objects::nonNull).findFirst().orElse(null);
        var issue = new Issue(input.requestId(), planId, Instant.now(), input, offer);
        var entity = new MealPlanShoppingIssue(); entity.setId(issue.id()); entity.setPlan(plan); entity.setCreatedAt(issue.createdAt()); entity.setStatus("REPORTED"); entity.setDocument(json.writeValueAsString(issue)); issues.saveAndFlush(entity);
        return issue;
    }
    @Transactional(readOnly = true)
    public List<Issue> list(String email, UUID planId) {
        plans.get(email, planId); return issues.findTop50ByPlanIdOrderByCreatedAtDesc(planId).stream().map(this::read).toList();
    }
    private Issue read(MealPlanShoppingIssue entity) { return json.readValue(entity.getDocument(), Issue.class); }
    private AppException error(HttpStatus status) { return new AppException("Shopping item changed or is unavailable. Refresh the plan.", status); }
}
