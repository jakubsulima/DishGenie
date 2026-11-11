-- V31 may already be applied by a running developer stack. Keep it immutable.
ALTER TABLE prepared_portion_transfer
    ADD COLUMN discarded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE prepared_portion_transfer
    ADD CONSTRAINT prepared_portion_discarded_check
    CHECK (discarded >= 0 AND eaten + discarded <= portions);
