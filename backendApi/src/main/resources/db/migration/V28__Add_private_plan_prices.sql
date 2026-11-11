CREATE TABLE meal_plan_item_price (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    plan_id UUID NOT NULL REFERENCES meal_plan(id) ON DELETE CASCADE,
    item_key VARCHAR(64) NOT NULL,
    store VARCHAR(255) NOT NULL,
    shopping_date DATE NOT NULL,
    document TEXT NOT NULL,
    UNIQUE(plan_id, item_key, store, shopping_date)
);
