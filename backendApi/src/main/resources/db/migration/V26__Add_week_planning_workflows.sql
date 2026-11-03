CREATE TABLE shopping_preferences (
    user_id BIGINT PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
    document TEXT NOT NULL
);
CREATE TABLE meal_plan_generation (
    id UUID PRIMARY KEY,
    plan_id UUID NOT NULL REFERENCES meal_plan(id) ON DELETE CASCADE,
    status VARCHAR(255) NOT NULL,
    document TEXT NOT NULL,
    lease_until TIMESTAMP WITH TIME ZONE,
    lease_token UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX meal_plan_generation_ready ON meal_plan_generation(status, lease_until);
CREATE INDEX meal_plan_generation_plan ON meal_plan_generation(plan_id, created_at DESC);
CREATE UNIQUE INDEX meal_plan_one_active_generation ON meal_plan_generation(plan_id) WHERE status IN ('QUEUED', 'RUNNING');
CREATE TABLE meal_plan_revision (
    id UUID PRIMARY KEY,
    plan_id UUID NOT NULL REFERENCES meal_plan(id) ON DELETE CASCADE,
    status VARCHAR(255) NOT NULL,
    document TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX meal_plan_revision_plan ON meal_plan_revision(plan_id, created_at DESC);
CREATE TABLE offer_import_batch (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(255) NOT NULL,
    document TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX offer_import_created ON offer_import_batch(created_at DESC);
CREATE TABLE offer_source_run (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(255) NOT NULL,
    document TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX offer_source_run_created ON offer_source_run(created_at DESC);
CREATE TABLE recipe_generation_reservation (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    status VARCHAR(255) NOT NULL,
    charged_on DATE NOT NULL
);
CREATE TABLE meal_plan_shopping_issue (
    id UUID PRIMARY KEY,
    plan_id UUID NOT NULL REFERENCES meal_plan(id) ON DELETE CASCADE,
    status VARCHAR(255) NOT NULL,
    document TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX meal_plan_shopping_issue_plan ON meal_plan_shopping_issue(plan_id, created_at DESC);
