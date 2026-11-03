package org.jakub.backendapi.controllers;
import jakarta.validation.Valid;
import org.jakub.backendapi.dto.OfferImportDto.*;
import org.jakub.backendapi.services.OfferImportService;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController
@RequestMapping("/admin/offer-imports")
public class OfferImportController {
    private final org.jakub.backendapi.services.LidlReviewCaptureService capture;
    private final OfferImportService imports;
    public OfferImportController(OfferImportService imports, org.jakub.backendapi.services.LidlReviewCaptureService capture) { this.imports = imports; this.capture = capture; }
    @GetMapping("/source-runs") public java.util.List<org.jakub.backendapi.services.LidlReviewCaptureService.Run> runs() { return capture.recent(); }
    @PostMapping("/capture-lidl-review") public org.jakub.backendapi.services.LidlReviewCaptureService.Run capture() { return capture.capture(); }
    @GetMapping public List<View> recent() { return imports.recent(); }
    @PostMapping public View ingest(@Valid @RequestBody Input input) { return imports.ingest(input); }
    @PostMapping("/{id}/review") public View review(@PathVariable UUID id, @Valid @RequestBody Review input) { return imports.review(id, input); }
}
