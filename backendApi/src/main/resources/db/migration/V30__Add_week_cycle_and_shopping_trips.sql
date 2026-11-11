CREATE TABLE cycle_request (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    input TEXT NOT NULL,
    result TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE TABLE shopping_trip (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES meal_plan(id) ON DELETE CASCADE,
    version BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    document TEXT NOT NULL,
    CONSTRAINT shopping_trip_status CHECK (status IN ('DRAFT','IN_PROGRESS','COMPLETED','CANCELLED'))
);
CREATE UNIQUE INDEX shopping_trip_one_open ON shopping_trip(plan_id) WHERE status IN ('DRAFT','IN_PROGRESS');
CREATE INDEX shopping_trip_user_history ON shopping_trip(user_id,created_at DESC);
