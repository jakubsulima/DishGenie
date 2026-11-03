package org.jakub.backendapi.controllers;

import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.jakub.backendapi.exceptions.AppException;
import org.jakub.backendapi.services.MealPlanJobService;
import org.jakub.backendapi.services.MealPlanShoppingIssueService;
import org.jakub.backendapi.services.MealPlanRevisionService;
import org.jakub.backendapi.services.MealPlanRevisionStore;
import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.services.MealPlanService;
import org.jakub.backendapi.services.MealPlanGenerationService;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;
import org.jakub.backendapi.dto.UserDto;
import org.jakub.backendapi.dto.StoreOfferDto;
import org.jakub.backendapi.services.MealPlanPricingService;
import java.util.*;

@RestController
@RequestMapping({"/v2/meal-plans", "/v3/meal-plans"})
public class MealPlanController {
    private final MealPlanShoppingIssueService issues;
    private final MealPlanJobService jobs;
    private final MealPlanRevisionService revisions;
    private final MealPlanRevisionStore revisionStore;
    private final MealPlanService plans;
    private final MealPlanGenerationService generation;
    private final MealPlanPricingService pricing;
    public MealPlanController(MealPlanService plans, MealPlanGenerationService generation, MealPlanPricingService pricing, MealPlanJobService jobs, MealPlanRevisionService revisions, MealPlanRevisionStore revisionStore, MealPlanShoppingIssueService issues) {
        this.issues = issues; this.revisions = revisions; this.revisionStore = revisionStore; this.jobs = jobs; this.plans = plans; this.generation = generation; this.pricing = pricing;
    }
    private String email(Authentication user) {
        return user.getPrincipal() instanceof UserDto dto ? dto.getEmail() : user.getName();
    }
    /** A v2 client cannot safely represent a missing budget: fail before performing a mutation. */
    @ModelAttribute
    public void legacyCompatibility(Authentication user, HttpServletRequest request) {
        if (!request.getRequestURI().contains("/v2/meal-plans/")) return;
        String suffix = request.getRequestURI().split("/v2/meal-plans/", 2)[1];
        try {
            UUID id = UUID.fromString(suffix.split("/", 2)[0]);
            if (plans.get(email(user), id).plan().settings().budget() == null)
                throw new AppException("This plan requires an updated planner client.", HttpStatus.CONFLICT);
        } catch (IllegalArgumentException ignored) { /* Normal route validation handles malformed IDs. */ }
    }
    @PostMapping("/{id}/quote")
    public StoreOfferDto.Quote quote(Authentication user, @PathVariable UUID id, @Valid @RequestBody StoreOfferDto.QuoteRequest input) {
        return pricing.quote(email(user), id, input);
    }
    @PostMapping("/{id}/quote-preview")
    public StoreOfferDto.Quote preview(Authentication user, @PathVariable UUID id, @Valid @RequestBody StoreOfferDto.QuoteRequest input) {
        return pricing.preview(email(user), id, input);
    }
    @PostMapping("/{id}/generations")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public MealPlanJobService.Progress start(Authentication user, @PathVariable UUID id, @Valid @RequestBody Generate input) {
        return jobs.start(email(user), id, input);
    }
    @GetMapping("/{id}/generations/latest")
    public MealPlanJobService.Progress progress(Authentication user, @PathVariable UUID id) { return jobs.latest(email(user), id); }
    @PostMapping("/{id}/generations/{jobId}/cancel")
    public MealPlanJobService.Progress cancel(Authentication user, @PathVariable UUID id, @PathVariable UUID jobId) { return jobs.cancel(email(user), id, jobId); }
    @PostMapping("/{id}/slots/{slotId}/revision-previews")
    public RevisionPreview revision(Authentication user, @PathVariable UUID id, @PathVariable UUID slotId, @Valid @RequestBody RevisionRequest input) { return revisions.preview(email(user), id, slotId, input); }
    @PostMapping("/{id}/slots/{slotId}/apply-revision")
    public View applyRevision(Authentication user, @PathVariable UUID id, @PathVariable UUID slotId, @Valid @RequestBody ApplyRevision input) { return revisionStore.apply(email(user), id, slotId, input); }
    @GetMapping("/{id}/slots/{slotId}/revisions/latest")
    public Map<String, UUID> latestRevision(Authentication user, @PathVariable UUID id, @PathVariable UUID slotId) { return revisionStore.latest(email(user), id, slotId); }
    @PostMapping("/{id}/slots/{slotId}/undo-revision")
    public RevisionPreview undoRevision(Authentication user, @PathVariable UUID id, @PathVariable UUID slotId, @Valid @RequestBody ApplyRevision input) { return revisions.undo(email(user), id, slotId, input); }
    @PostMapping("/{id}/shopping-list/select")
    public View selectBasket(Authentication user, @PathVariable UUID id, @Valid @RequestBody SelectBasket input) {
        if (input.version() != input.quote().version()) throw new AppException("Quote version changed.", HttpStatus.CONFLICT);
        return plans.selectBasket(email(user), id, input.version(), input.option(), pricing.preview(email(user), id, input.quote()));
    }
    @PatchMapping("/{id}/settings")
    public View settings(Authentication user, @PathVariable UUID id, @Valid @RequestBody SettingsChange input) { return plans.settings(email(user), id, input); }
    @PostMapping("/{id}/shopping-list/issues")
    public MealPlanShoppingIssueService.Issue report(Authentication user, @PathVariable UUID id, @Valid @RequestBody MealPlanShoppingIssueService.Input input) { return issues.report(email(user), id, input); }
    @GetMapping("/{id}/shopping-list/issues")
    public List<MealPlanShoppingIssueService.Issue> issues(Authentication user, @PathVariable UUID id) { return issues.list(email(user), id); }
    @GetMapping
    public List<Summary> list(Authentication user) { return plans.list(email(user)); }
    @PostMapping
    public View create(Authentication user, @Valid @RequestBody Create input, HttpServletRequest request) {
        if (request.getRequestURI().endsWith("/v2/meal-plans") && input.budget() == null)
            throw new AppException("Use the v3 planner to omit the budget.", HttpStatus.BAD_REQUEST);
        return plans.create(email(user), input);
    }
    @GetMapping("/{id}")
    public View get(Authentication user, @PathVariable UUID id) { return plans.get(email(user), id); }
    @PostMapping("/{id}/slots/{slotId}")
    public View change(Authentication user, @PathVariable UUID id, @PathVariable UUID slotId, @Valid @RequestBody Change input) {
        return plans.change(email(user), id, slotId, input);
    }
    @PostMapping("/{id}/slots/{slotId}/generate")
    public View generate(Authentication user, @PathVariable UUID id, @PathVariable UUID slotId, @Valid @RequestBody Generate input) {
        return generation.generate(email(user), id, slotId, input);
    }
    @PostMapping("/{id}/accept")
    public View accept(Authentication user, @PathVariable UUID id, @Valid @RequestBody Version input) { return plans.accept(email(user), id, input); }
    @PostMapping("/{id}/shopping-list/refresh")
    public View refresh(Authentication user, @PathVariable UUID id, @Valid @RequestBody Version input) { return plans.refreshShopping(email(user), id, input); }
    @PostMapping("/{id}/shopping-list/sync")
    public View sync(Authentication user, @PathVariable UUID id, @Valid @RequestBody Generate input) { return plans.syncShopping(email(user), id, input); }
    @PostMapping("/{id}/shopping-list/check")
    public View check(Authentication user, @PathVariable UUID id, @Valid @RequestBody Check input) { return plans.checkShopping(email(user), id, input); }
}
