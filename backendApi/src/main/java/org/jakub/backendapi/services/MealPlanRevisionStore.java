package org.jakub.backendapi.services;
import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.dto.RecipeDto;
import org.jakub.backendapi.entities.MealPlanRevision;
import org.jakub.backendapi.repositories.*;
import org.jakub.backendapi.exceptions.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
@Service
public class MealPlanRevisionStore {
    public record Data(UUID slotId, RevisionRequest request, RevisionPreview preview, Long appliedVersion) {}
    public record Reservation(Data data, boolean execute) {}
    private final StoreOfferService offers;
    private final WeekCycleService cycle;
    private final WeekCycleSupport cycleSupport;
    private final MealPlanRevisionRepository revisions;
    private final MealPlanRepository repository;
    private final MealPlanService plans;
    private final PlanRecipeValidationService validation;
    private final ObjectMapper json;
    public MealPlanRevisionStore(MealPlanRevisionRepository revisions, MealPlanRepository repository, MealPlanService plans,
            PlanRecipeValidationService validation, ObjectMapper json, StoreOfferService offers,WeekCycleService cycle,WeekCycleSupport cycleSupport) {
        this.cycle=cycle;this.cycleSupport=cycleSupport;this.offers = offers; this.revisions = revisions; this.repository = repository; this.plans = plans; this.validation = validation; this.json = json;
    }
    @Transactional
    public Reservation reserve(String email, UUID planId, UUID slotId, RevisionRequest input) {
        var plan = repository.findOwnedForUpdate(planId, email).orElseThrow(() -> error(HttpStatus.NOT_FOUND));
        var existing = revisions.lock(input.requestId());
        if (existing.isPresent()) {
            var entity = existing.get(); var d = read(entity);
            if (!entity.getPlan().getId().equals(planId) || !d.slotId().equals(slotId)
                    || !json.writeValueAsString(d.request()).equals(json.writeValueAsString(input))) throw error(HttpStatus.CONFLICT);
            if (d.preview() == null) throw error(HttpStatus.CONFLICT);
            return new Reservation(d, false);
        }
        if (plan.getVersion() != input.version()) throw error(HttpStatus.CONFLICT);
        var slot = plans.get(email, planId).plan().slots().stream().filter(s -> s.id().equals(slotId)).findFirst().orElseThrow(() -> error(HttpStatus.NOT_FOUND));
        var doc=plans.get(email,planId).plan();
        if(doc.schemaVersion()>=4 && !cycleSupport.forSlot(doc,slotId).status().equals("PLANNED")) throw error(HttpStatus.CONFLICT);
        if (slot.recipe() == null || slot.locked() || slot.skipped()) throw error(HttpStatus.CONFLICT);
        var entity = new MealPlanRevision(); entity.setId(input.requestId()); entity.setPlan(plan); entity.setCreatedAt(Instant.now()); entity.setStatus("PREPARING");
        Data data = new Data(slotId, input, null, null); entity.setDocument(json.writeValueAsString(data)); revisions.saveAndFlush(entity);
        return new Reservation(data, true);
    }
    @Transactional
    public void prepared(UUID id, RevisionPreview preview) {
        var entity = revisions.lock(id).orElseThrow(); Data d = read(entity);
        entity.setDocument(json.writeValueAsString(new Data(d.slotId(), d.request(), preview, null))); entity.setStatus("READY");
    }
    @Transactional
    public void failed(UUID id) { revisions.lock(id).ifPresent(e -> e.setStatus("FAILED")); }
    @Transactional
    public View apply(String email, UUID planId, UUID slotId, ApplyRevision input) {
        repository.findOwnedForUpdate(planId, email).orElseThrow(() -> error(HttpStatus.NOT_FOUND));
        var entity = revisions.lock(input.previewId()).orElseThrow(() -> error(HttpStatus.NOT_FOUND)); Data d = read(entity);
        if (!entity.getPlan().getId().equals(planId) || !d.slotId().equals(slotId)) throw error(HttpStatus.NOT_FOUND);
        if (d.appliedVersion() != null) return plans.get(email, planId);
        var preview = d.preview();
        if (preview == null || !preview.expiresAt().isAfter(Instant.now()) || preview.planVersion() != input.version()) throw error(HttpStatus.CONFLICT);
        var plan = plans.get(email, planId);
        if (preview.quoteAfter() != null) {
            var available = offers.eligibleForUser(email, plan.plan().settings().stores(), preview.quoteAfter().shoppingDate(), Instant.now());
            var used = preview.quoteAfter().baskets().stream().flatMap(b -> b.items().stream()).map(i -> i.offer()).filter(Objects::nonNull).toList();
            if (used.stream().anyMatch(old -> available.stream().noneMatch(current -> current.id().equals(old.id()) && current.version() == old.version()))) throw error(HttpStatus.CONFLICT);
        }
        validation.validate(email, preview.after(), plan.plan().settings().maxMinutes(), preview.after().getLocale().name());
        var result = plan.plan().schemaVersion()>=4
            ? cycle.apply(email,planId,new WeekCycleService.Apply(input.version(),RecipeGenerationQuotaService.key("v4-revision:"+planId+":"+input.previewId()),input.previewId()))
            : plans.revise(email, planId, slotId, input.version(), preview.after());
        entity.setDocument(json.writeValueAsString(new Data(d.slotId(), d.request(), preview, result.version()))); entity.setStatus("APPLIED");
        return result;
    }
    @Transactional(readOnly = true)
    public RecipeDto undoRecipe(String email, UUID planId, UUID slotId, UUID revisionId) {
        var plan = plans.get(email, planId);
        var entity = revisions.findById(revisionId).orElseThrow(() -> error(HttpStatus.NOT_FOUND)); Data d = read(entity);
        if (!entity.getPlan().getId().equals(planId) || !d.slotId().equals(slotId) || d.appliedVersion() == null) throw error(HttpStatus.NOT_FOUND);
        var current = plan.plan().slots().stream().filter(s -> s.id().equals(slotId)).findFirst().orElseThrow();
        if (!Objects.equals(current.recipe(), d.preview().after())) throw error(HttpStatus.CONFLICT);
        return d.preview().before();
    }
    @Transactional(readOnly = true)
    public Map<String, UUID> latest(String email, UUID planId, UUID slotId) {
        var plan = plans.get(email, planId);
        var slot = plan.plan().slots().stream().filter(s -> s.id().equals(slotId)).findFirst().orElseThrow(() -> error(HttpStatus.NOT_FOUND));
        return revisions.findTop50ByPlanIdAndStatusOrderByCreatedAtDesc(planId, "APPLIED").stream().filter(e -> {
            var d = read(e); return d.slotId().equals(slotId) && d.preview() != null && Objects.equals(d.preview().after(), slot.recipe());
        }).findFirst().map(e -> Map.of("id", e.getId())).orElse(Map.of());
    }
    private Data read(MealPlanRevision entity) { return json.readValue(entity.getDocument(), Data.class); }
    private AppException error(HttpStatus status) { return new AppException("Revision unavailable or outdated. Refresh the plan and preview again.", status); }
}
