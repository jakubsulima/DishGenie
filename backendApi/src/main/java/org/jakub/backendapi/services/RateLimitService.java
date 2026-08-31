package org.jakub.backendapi.services;

import org.jakub.backendapi.entities.RateLimitBucket;
import org.jakub.backendapi.exceptions.AppException;
import org.jakub.backendapi.repositories.RateLimitBucketRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.sql.Connection;
import java.sql.SQLException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.concurrent.atomic.AtomicLong;
import javax.sql.DataSource;

@Service
public class RateLimitService {
    private static final long CLEANUP_INTERVAL = 256;
    private static final long STALE_BUCKET_AGE_MILLIS = 24 * 60 * 60 * 1000L;

    private final RateLimitBucketRepository bucketRepository;
    private final DataSource dataSource;
    private final AtomicLong requestCounter = new AtomicLong();
    private volatile Boolean postgresDatabase;

    public RateLimitService(RateLimitBucketRepository bucketRepository, DataSource dataSource) {
        this.bucketRepository = bucketRepository;
        this.dataSource = dataSource;
    }

    @Transactional
    public void assertAllowed(String key, int maxRequests, long windowMillis, String errorMessage) {
        String normalizedKey = normalizeKey(key);
        LocalDateTime now = LocalDateTime.now(java.time.Clock.systemUTC());
        if (isPostgresDatabase()) {
            // A row lock cannot protect the first insert. A transaction-scoped
            // advisory lock serializes creation of the same dynamic bucket key
            // across every backend replica.
            bucketRepository.lockBucketKey(normalizedKey);
        }
        RateLimitBucket bucket = bucketRepository.findByBucketKeyForUpdate(normalizedKey)
                .orElseGet(() -> new RateLimitBucket(normalizedKey, now, 0));

        if (bucket.getWindowStartedAt().plus(java.time.Duration.ofMillis(windowMillis)).isBefore(now)) {
            bucket.setWindowStartedAt(now);
            bucket.setRequestCount(0);
        }

        if (bucket.getRequestCount() >= maxRequests) {
            throw new AppException(errorMessage, HttpStatus.TOO_MANY_REQUESTS);
        }

        bucket.setRequestCount(bucket.getRequestCount() + 1);
        bucketRepository.save(bucket);
        cleanupStaleBuckets(now);
    }

    private boolean isPostgresDatabase() {
        Boolean cached = postgresDatabase;
        if (cached != null) {
            return cached;
        }

        synchronized (this) {
            if (postgresDatabase == null) {
                try (Connection connection = dataSource.getConnection()) {
                    postgresDatabase = connection.getMetaData()
                            .getDatabaseProductName()
                            .toLowerCase(java.util.Locale.ROOT)
                            .contains("postgresql");
                } catch (SQLException | RuntimeException exception) {
                    postgresDatabase = false;
                }
            }
            return postgresDatabase;
        }
    }

    @Transactional(readOnly = true)
    public int getCurrentRequestCount(String key, long windowMillis) {
        LocalDateTime now = LocalDateTime.now(java.time.Clock.systemUTC());
        return bucketRepository.findById(normalizeKey(key))
                .filter(bucket -> bucket.getWindowStartedAt().plus(java.time.Duration.ofMillis(windowMillis)).isAfter(now))
                .map(RateLimitBucket::getRequestCount)
                .orElse(0);
    }

    private String normalizeKey(String key) {
        String safeKey = key == null ? "unknown" : key.trim();
        if (safeKey.isEmpty()) {
            safeKey = "unknown";
        }
        if (safeKey.length() <= 255) {
            return safeKey;
        }
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(safeKey.getBytes(StandardCharsets.UTF_8));
            return "sha256:" + HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    private void cleanupStaleBuckets(LocalDateTime now) {
        if (requestCounter.incrementAndGet() % CLEANUP_INTERVAL == 0) {
            bucketRepository.deleteByWindowStartedAtBefore(
                    now.minus(java.time.Duration.ofMillis(STALE_BUCKET_AGE_MILLIS))
            );
        }
    }
}
