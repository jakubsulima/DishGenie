CREATE TABLE meal_plan (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    document TEXT NOT NULL
);
CREATE INDEX meal_plan_owner_created ON meal_plan(user_id, created_at DESC);
