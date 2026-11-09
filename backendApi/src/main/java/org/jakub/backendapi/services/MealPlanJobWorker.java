package org.jakub.backendapi.services;
import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.repositories.MealPlanGenerationRepository;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import java.time.Instant;
import java.util.*;
@Service
@EnableScheduling
@ConditionalOnProperty(name = "app.planner.jobs-enabled", havingValue = "true", matchIfMissing = true)
public class MealPlanJobWorker {
    private final MealPlanJobService jobs;
    private final MealPlanGenerationRepository repository;
    private final MealPlanService plans;
    private final MealPlanGenerationService generation;
    public MealPlanJobWorker(MealPlanJobService jobs, MealPlanGenerationRepository repository, MealPlanService plans, MealPlanGenerationService generation) {
        this.jobs = jobs; this.repository = repository; this.plans = plans; this.generation = generation;
    }
    @Scheduled(fixedDelay = 2000, initialDelay = 5000)
    public void tick() {
        for (UUID id : repository.ready(Instant.now(), PageRequest.of(0, 10))) {
            var work = jobs.claim(id);
            if (work != null) execute(work);
        }
    }
    public static UUID operationId(UUID jobId, UUID slotId) { return RecipeGenerationQuotaService.key("week:" + jobId + ":" + slotId); }
    public void execute(MealPlanJobService.Work work) {
        try {
            var plan = plans.get(work.email(), work.planId());
            var slotId = work.data().slots().get(work.data().cursor());
            var slot = plan.plan().slots().stream().filter(s -> s.id().equals(slotId)).findFirst().orElseThrow();
            if (work.data().lastRequest() != null && work.data().lastRequest().equals(slot.generationId())) {
                if (slot.generationStatus() == GenerationStatus.COMPLETED && plan.version() == work.data().version() + 2) {
                    jobs.finish(work, plan.version(), null); return;
                }
                // A dead worker may have reserved a slot before its process stopped.
                if (slot.generationStatus() == GenerationStatus.RUNNING && plan.version() == work.data().version() + 1
                        && slot.generationStartedAt().isBefore(Instant.now().minusSeconds(300))) {
                    plans.failGeneration(work.email(), work.planId(), slotId, slot.generationId());
                    // New request uses the current version, but only after validating the crashed reservation above.
                    plan = plans.get(work.email(), work.planId());
                } else throw new IllegalStateException("Changed during generation");
            } else if (plan.version() != work.data().version()) throw new IllegalStateException("Changed during generation");
            UUID request = UUID.randomUUID(); jobs.request(work, request, plan.version());
            var result = generation.generate(work.email(), work.planId(), slotId, new Generate(plan.version(), request), operationId(work.id(), slotId));
            jobs.finish(work, result.version(), null);
        } catch (RuntimeException failure) {
            org.slf4j.LoggerFactory.getLogger(MealPlanJobWorker.class).warn("Planner job stopped: {}: {}", failure.getClass().getSimpleName(), failure.getMessage());
            String reason="GENERATION_STOPPED";
            if(failure instanceof org.jakub.backendapi.exceptions.AppException app) {
                if(app.getCode()==org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY) reason="PRICE_COVERAGE_UNAVAILABLE";
                else if(app.getCode()==org.springframework.http.HttpStatus.TOO_MANY_REQUESTS) reason="AI_LIMIT_REACHED";
                else if(app.getCode()==org.springframework.http.HttpStatus.CONFLICT) reason="PLAN_CHANGED";
            }
            jobs.finish(work,null,reason);
        }
    }
}
