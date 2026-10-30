package org.jakub.backendapi.controllers;

import jakarta.validation.Valid;
import org.jakub.backendapi.dto.MealPlanDto.Version;
import org.jakub.backendapi.dto.StoreOfferDto.*;
import org.jakub.backendapi.services.StoreOfferService;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.jakub.backendapi.dto.ErrorDto;

/** Protected by the existing admin role rule and CSRF. */
@RestController
@RequestMapping("/admin/store-offers")
public class StoreOfferController {
    private final StoreOfferService offers;
    public StoreOfferController(StoreOfferService offers) { this.offers = offers; }
    @ExceptionHandler({OptimisticLockingFailureException.class, DataIntegrityViolationException.class})
    public ResponseEntity<ErrorDto> concurrentWrite() {
        return ResponseEntity.status(409).body(new ErrorDto("Offer changed. Reload before editing."));
    }
    @GetMapping public List<Offer> list() { return offers.recent(); }
    @PutMapping("/{id}") public Offer publish(@PathVariable UUID id, @Valid @RequestBody Publish input) { return offers.publish(id, input); }
    @PostMapping("/{id}/withdraw") public void withdraw(@PathVariable UUID id, @Valid @RequestBody Version input) { offers.withdraw(id, input.version()); }
}
