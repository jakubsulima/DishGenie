-- Close the public test rollout, including installations that already applied V33.
ALTER TABLE offer_feature_setting ALTER COLUMN enabled_for_users SET DEFAULT FALSE;
UPDATE offer_feature_setting
SET enabled_for_users = FALSE,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP,
    updated_by = NULL
WHERE enabled_for_users = TRUE;
