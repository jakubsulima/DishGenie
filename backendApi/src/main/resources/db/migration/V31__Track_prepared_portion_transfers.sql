ALTER TABLE meal_plan ADD COLUMN cycle_revision BIGINT NOT NULL DEFAULT 0;
CREATE TABLE prepared_portion_transfer (
    id UUID PRIMARY KEY,
    source_plan_id UUID NOT NULL REFERENCES meal_plan(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL,
    target_plan_id UUID NOT NULL REFERENCES meal_plan(id) ON DELETE CASCADE,
    slot_id UUID NOT NULL,
    portions INTEGER NOT NULL CHECK (portions > 0),
    eaten INTEGER NOT NULL DEFAULT 0 CHECK (eaten >= 0 AND eaten <= portions),
    released BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX prepared_portion_source ON prepared_portion_transfer(source_plan_id,batch_id);
CREATE UNIQUE INDEX prepared_portion_active_slot ON prepared_portion_transfer(target_plan_id,slot_id) WHERE released=FALSE;
