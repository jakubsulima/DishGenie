package org.jakub.backendapi.repositories;

import jakarta.persistence.LockModeType;
import org.jakub.backendapi.entities.RateLimitBucket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface RateLimitBucketRepository extends JpaRepository<RateLimitBucket, String> {
    @Query(value = "SELECT pg_advisory_xact_lock(hashtext(:key)) IS NULL", nativeQuery = true)
    boolean lockBucketKey(@Param("key") String key);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT bucket FROM RateLimitBucket bucket WHERE bucket.bucketKey = :key")
    Optional<RateLimitBucket> findByBucketKeyForUpdate(@Param("key") String key);

    long deleteByWindowStartedAtBefore(LocalDateTime cutoff);
}
