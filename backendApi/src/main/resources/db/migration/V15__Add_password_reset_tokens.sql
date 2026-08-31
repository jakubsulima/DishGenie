ALTER TABLE app_user
    ADD COLUMN password_reset_token_hash VARCHAR(64),
    ADD COLUMN password_reset_expires_at TIMESTAMP;

CREATE UNIQUE INDEX idx_app_user_password_reset_token
    ON app_user (password_reset_token_hash)
    WHERE password_reset_token_hash IS NOT NULL;
