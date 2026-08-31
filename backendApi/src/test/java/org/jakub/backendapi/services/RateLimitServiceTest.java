package org.jakub.backendapi.services;

import org.jakub.backendapi.entities.RateLimitBucket;
import org.jakub.backendapi.exceptions.AppException;
import org.jakub.backendapi.repositories.RateLimitBucketRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.Optional;
import javax.sql.DataSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class RateLimitServiceTest {

    private final RateLimitBucketRepository repository = mock(RateLimitBucketRepository.class);
    private final DataSource dataSource = mock(DataSource.class);
    private final RateLimitService service = new RateLimitService(repository, dataSource);

    @Test
    void persistsConsumptionSoMultipleApplicationInstancesShareTheLimit() {
        when(repository.findByBucketKeyForUpdate("login_127.0.0.1"))
                .thenReturn(Optional.empty());

        service.assertAllowed("login_127.0.0.1", 2, 60_000, "limited");

        verify(repository).save(argThat(bucket ->
                bucket.getBucketKey().equals("login_127.0.0.1")
                        && bucket.getRequestCount() == 1));
    }

    @Test
    void rejectsRequestsOnceThePersistedLimitIsReached() {
        RateLimitBucket bucket = new RateLimitBucket("login_127.0.0.1", LocalDateTime.now(), 2);
        when(repository.findByBucketKeyForUpdate("login_127.0.0.1"))
                .thenReturn(Optional.of(bucket));

        AppException exception = assertThrows(
                AppException.class,
                () -> service.assertAllowed("login_127.0.0.1", 2, 60_000, "limited")
        );

        assertThat(exception.getMessage()).isEqualTo("limited");
        verify(repository, never()).save(any());
    }
}
