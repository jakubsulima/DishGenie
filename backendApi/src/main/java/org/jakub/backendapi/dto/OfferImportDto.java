package org.jakub.backendapi.dto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.jakub.backendapi.dto.MealPlanDto.Store;
import java.time.*;
import java.util.*;
public final class OfferImportDto {
    private OfferImportDto() {}
    public record Candidate(@NotBlank @Size(max = 200) String sourceProductId,
            @NotBlank @Size(max = 1000) String sourceUrl, @NotBlank @Size(max = 10000) String evidence) {}
    public record Input(@NotBlank @Pattern(regexp = "[A-Za-z0-9_.-]{1,100}") String adapter,
            @NotBlank @Size(max = 200) String sourceBatchId, @NotNull Store store,
            @NotNull Instant fetchedAt, Instant sourceUpdatedAt, boolean complete,
            @Min(1) @Max(500) int expectedCount, @NotEmpty @Size(max = 500) List<@Valid Candidate> candidates) {}
    public record Row(Candidate source, String status, String reason, StoreOfferDto.Offer published) {}
    public record Batch(UUID id, Instant importedAt, String status, Input input, List<Row> rows) {}
    public record Review(@Min(0) long version, @Min(0) @Max(499) int index, boolean reject,
                         @Size(max = 1000) String reason, @Valid StoreOfferDto.Publish offer) {}
    public record View(long version, Batch batch) {}
}
