package org.jakub.backendapi.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "rate_limit_bucket")
public class RateLimitBucket {
    @Id
    @Column(name = "bucket_key", nullable = false, length = 255)
    private String bucketKey;

    @Column(name = "window_started_at", nullable = false)
    private LocalDateTime windowStartedAt;

    @Column(name = "request_count", nullable = false)
    private int requestCount;

    protected RateLimitBucket() {
    }

    public RateLimitBucket(String bucketKey, LocalDateTime windowStartedAt, int requestCount) {
        this.bucketKey = bucketKey;
        this.windowStartedAt = windowStartedAt;
        this.requestCount = requestCount;
    }

    public String getBucketKey() {
        return bucketKey;
    }

    public LocalDateTime getWindowStartedAt() {
        return windowStartedAt;
    }

    public void setWindowStartedAt(LocalDateTime windowStartedAt) {
        this.windowStartedAt = windowStartedAt;
    }

    public int getRequestCount() {
        return requestCount;
    }

    public void setRequestCount(int requestCount) {
        this.requestCount = requestCount;
    }
}
