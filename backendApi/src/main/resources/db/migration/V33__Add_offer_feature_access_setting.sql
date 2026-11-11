CREATE TABLE offer_feature_setting (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version BIGINT NOT NULL DEFAULT 0,
    enabled_for_users BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_by VARCHAR(320)
);
INSERT INTO offer_feature_setting (id, version, enabled_for_users, updated_at)
VALUES (1, 0, TRUE, CURRENT_TIMESTAMP);
