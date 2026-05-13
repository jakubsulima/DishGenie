package org.jakub.backendapi.repositories.projections;

import java.time.Instant;

public interface RecipeSitemapEntry {
    Long getId();
    Instant getUpdatedAt();
}
