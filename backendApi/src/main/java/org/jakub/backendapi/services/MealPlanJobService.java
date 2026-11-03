package org.jakub.backendapi.services;
import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.entities.MealPlanGeneration;
import org.jakub.backendapi.repositories.*;
import org.jakub.backendapi.exceptions.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
@Service
public class MealPlanJobService {
    public record Progress(UUID id, UUID planId, String status, int completed, int total, String error, Instant createdAt) {}
    public record Data(List<UUID> slots, int cursor, long version, int attempts, UUID lastRequest, String error, long inputVersion) {}
    public record Work(UUID id, UUID planId, String email, UUID lease, Data data) {}
    private final MealPlanGenerationRepository jobs;
    private final MealPlanRepository repository;
    private final MealPlanService plans;
    private final ObjectMapper json;
    public MealPlanJobService(MealPlanGenerationRepository jobs, MealPlanRepository repository, MealPlanService plans, ObjectMapper json) {
        this.jobs = jobs; this.repository = repository; this.plans = plans; this.json = json;
    }
    @Transactional
    public Progress start(String email, UUID id, Generate input) {
        var plan = repository.findOwnedForUpdate(id, email).orElseThrow(() -> error(HttpStatus.NOT_FOUND));
        var previous = jobs.findById(input.requestId());
        if (previous.isPresent()) {
            var job = previous.get();
            if (!job.getPlan().getId().equals(id) || read(job).inputVersion() != input.version()) throw error(HttpStatus.CONFLICT);
            return view(job);
        }
        if (plan.getVersion() != input.version() || jobs.existsByPlanIdAndStatusIn(id, List.of("QUEUED", "RUNNING"))) throw error(HttpStatus.CONFLICT);
        var snapshot = plans.get(email, id);
        if (snapshot.plan().slots().stream().anyMatch(s -> s.generationStatus() == GenerationStatus.RUNNING && s.generationStartedAt().isAfter(Instant.now().minusSeconds(300)))) throw error(HttpStatus.CONFLICT);
        var pending = snapshot.plan().slots().stream().filter(s -> !s.locked() && !s.skipped() && s.recipe() == null).map(Slot::id).toList();
        var job = new MealPlanGeneration(); job.setId(input.requestId()); job.setPlan(plan);
        job.setCreatedAt(Instant.now()); job.setStatus(pending.isEmpty() ? "COMPLETED" : "QUEUED");
        job.setDocument(json.writeValueAsString(new Data(pending, 0, input.version(), 0, null, null, input.version())));
        return view(jobs.saveAndFlush(job));
    }
    @Transactional(readOnly = true)
    public Progress latest(String email, UUID id) {
        plans.get(email, id);
        return jobs.findFirstByPlanIdOrderByCreatedAtDesc(id).map(this::view).orElse(null);
    }
    @Transactional
    public Progress cancel(String email, UUID id, UUID jobId) {
        repository.findOwnedForUpdate(id, email).orElseThrow(() -> error(HttpStatus.NOT_FOUND));
        var job = jobs.lock(jobId).orElseThrow(() -> error(HttpStatus.NOT_FOUND));
        if (!job.getPlan().getId().equals(id)) throw error(HttpStatus.NOT_FOUND);
        // Cancellation takes effect between meals. Keep the lease until the current result is committed.
        if (List.of("QUEUED", "RUNNING").contains(job.getStatus())) job.setStatus("CANCELLED");
        return view(job);
    }
    @Transactional
    public Work claim(UUID id) {
        var job = jobs.lock(id).orElseThrow(); Instant now = Instant.now();
        if (!(job.getStatus().equals("QUEUED") || job.getStatus().equals("RUNNING") && job.getLeaseUntil().isBefore(now))) return null;
        Data data = read(job);
        if (data.attempts() >= 3 || job.getCreatedAt().isBefore(now.minusSeconds(3600))) {
            job.setStatus("FAILED"); job.setLeaseToken(null); job.setLeaseUntil(null);
            job.setDocument(json.writeValueAsString(new Data(data.slots(), data.cursor(), data.version(), data.attempts(), data.lastRequest(), "RECOVERY_LIMIT", data.inputVersion()))); return null;
        }
        job.setStatus("RUNNING"); job.setLeaseToken(UUID.randomUUID()); job.setLeaseUntil(now.plusSeconds(600));
        Data next = new Data(data.slots(), data.cursor(), data.version(), data.attempts() + 1, data.lastRequest(), null, data.inputVersion());
        job.setDocument(json.writeValueAsString(next));
        return new Work(id, job.getPlan().getId(), job.getPlan().getUser().getEmail(), job.getLeaseToken(), next);
    }
    @Transactional
    public void request(Work work, UUID request, long version) {
        var job = jobs.lock(work.id()).orElseThrow();
        if (!work.lease().equals(job.getLeaseToken())) throw error(HttpStatus.CONFLICT);
        Data d = read(job); job.setDocument(json.writeValueAsString(new Data(d.slots(), d.cursor(), version, d.attempts(), request, null, d.inputVersion())));
    }
    @Transactional
    public void finish(Work work, Long version, String failure) {
        var job = jobs.lock(work.id()).orElseThrow();
        if (!work.lease().equals(job.getLeaseToken())) return;
        Data d = read(job);
        int cursor = failure == null ? d.cursor() + 1 : d.cursor();
        job.setDocument(json.writeValueAsString(new Data(d.slots(), cursor, version == null ? d.version() : version,
                failure == null ? 0 : d.attempts(), null, failure, d.inputVersion())));
        if (!job.getStatus().equals("CANCELLED")) job.setStatus(failure != null ? "FAILED" : cursor == d.slots().size() ? "COMPLETED" : "QUEUED");
        job.setLeaseUntil(null); job.setLeaseToken(null);
    }
    private Data read(MealPlanGeneration job) { return json.readValue(job.getDocument(), Data.class); }
    private Progress view(MealPlanGeneration job) { Data d = read(job); return new Progress(job.getId(), job.getPlan().getId(), job.getStatus(), d.cursor(), d.slots().size(), d.error(), job.getCreatedAt()); }
    private AppException error(HttpStatus status) { return new AppException("Generation changed or is unavailable. Reload the plan.", status); }
}
