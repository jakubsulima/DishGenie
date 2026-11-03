package org.jakub.backendapi.services;
import org.jakub.backendapi.dto.OfferImportDto.*;
import org.jakub.backendapi.entities.OfferImportBatch;
import org.jakub.backendapi.repositories.OfferImportBatchRepository;
import org.jakub.backendapi.exceptions.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
@Service
public class OfferImportService {
    private final OfferImportBatchRepository batches;
    private final StoreOfferService offers;
    private final ObjectMapper json;
    public OfferImportService(OfferImportBatchRepository batches, StoreOfferService offers, ObjectMapper json) { this.batches = batches; this.offers = offers; this.json = json; }
    @Transactional
    public View ingest(Input input) {
        if (input.fetchedAt().isAfter(Instant.now()) || input.sourceUpdatedAt() != null && input.sourceUpdatedAt().isAfter(input.fetchedAt()))
            throw error("Invalid source timestamps.", HttpStatus.BAD_REQUEST);
        UUID id = UUID.nameUUIDFromBytes((input.adapter() + "|" + input.store() + "|" + input.sourceBatchId()).getBytes(StandardCharsets.UTF_8));
        var existing = batches.findById(id);
        if (existing.isPresent()) {
            var previous = read(existing.get());
            if (!signature(previous.input()).equals(signature(input))) throw error("Source batch ID reused with different content.", HttpStatus.CONFLICT);
            return new View(existing.get().getVersion(), previous);
        }
        Set<String> ids = new HashSet<>();
        boolean complete = input.complete() && input.expectedCount() == input.candidates().size()
                && input.candidates().stream().allMatch(c -> ids.add(c.sourceProductId()));
        var rows = input.candidates().stream().map(c -> new Row(c, "NEEDS_REVIEW", complete ? "VERIFY_MAPPING_SCOPE_PRICE_AND_CONDITIONS" : "INCOMPLETE_BATCH", null)).toList();
        var batch = new Batch(id, Instant.now(), complete ? "NEEDS_REVIEW" : "INCOMPLETE", input, rows);
        var entity = new OfferImportBatch(); entity.setId(id); entity.setCreatedAt(batch.importedAt()); entity.setStatus(batch.status()); entity.setDocument(json.writeValueAsString(batch));
        return new View(batches.saveAndFlush(entity).getVersion(), batch);
    }
    @Transactional(readOnly = true)
    public List<View> recent() { return batches.findTop30ByOrderByCreatedAtDesc().stream().map(e -> new View(e.getVersion(), read(e))).toList(); }
    @Transactional
    public View review(UUID id, Review review) {
        var entity = batches.lock(id).orElseThrow(() -> error("Import not found.", HttpStatus.NOT_FOUND)); Batch batch = read(entity);
        if (entity.getVersion() != review.version()) throw error("Import changed. Reload before reviewing.", HttpStatus.CONFLICT);
        if (batch.status().equals("INCOMPLETE") || review.index() >= batch.rows().size()) throw error("Incomplete batch cannot publish prices.", HttpStatus.CONFLICT);
        var rows = new ArrayList<>(batch.rows()); var row = rows.get(review.index());
        if (!row.status().equals("NEEDS_REVIEW")) throw error("Candidate already reviewed.", HttpStatus.CONFLICT);
        if (review.reject()) rows.set(review.index(), new Row(row.source(), "REJECTED", review.reason(), null));
        else {
            var offer = review.offer();
            if (offer == null || offer.store() != batch.input().store() || !offer.sourceUrl().equals(row.source().sourceUrl())) throw error("Confirm source and store before publication.", HttpStatus.BAD_REQUEST);
            // Stable product + validity identity; changed prices require the current offer version.
            UUID offerId = UUID.nameUUIDFromBytes((offer.store() + "|" + row.source().sourceProductId() + "|" + offer.validFrom() + "|" + offer.validTo()).getBytes(StandardCharsets.UTF_8));
            var published = offers.publish(offerId, offer);
            rows.set(review.index(), new Row(row.source(), "PUBLISHED", review.reason(), published));
        }
        String status = rows.stream().anyMatch(r -> r.status().equals("NEEDS_REVIEW")) ? "NEEDS_REVIEW" : "REVIEWED";
        Batch result = new Batch(batch.id(), batch.importedAt(), status, batch.input(), List.copyOf(rows));
        entity.setStatus(status); entity.setDocument(json.writeValueAsString(result));
        return new View(batches.saveAndFlush(entity).getVersion(), result);
    }
    private String signature(Input input) {
        return json.writeValueAsString(new Input(input.adapter(), input.sourceBatchId(), input.store(), Instant.EPOCH,
                input.sourceUpdatedAt(), input.complete(), input.expectedCount(), input.candidates()));
    }
    private Batch read(OfferImportBatch entity) { return json.readValue(entity.getDocument(), Batch.class); }
    private AppException error(String message, HttpStatus status) { return new AppException(message, status); }
}
