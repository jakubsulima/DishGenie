CREATE TABLE rate_limit_bucket (
    bucket_key VARCHAR(255) PRIMARY KEY,
    window_started_at TIMESTAMP NOT NULL,
    request_count INTEGER NOT NULL CHECK (request_count >= 0)
);

CREATE INDEX idx_rate_limit_bucket_window_started_at
    ON rate_limit_bucket (window_started_at);
