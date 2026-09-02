ALTER TABLE fridge_inventory_operation
    ADD COLUMN undo_operation_id VARCHAR(36);

ALTER TABLE fridge_inventory_operation
    ADD CONSTRAINT uk_fridge_inventory_operation_undo UNIQUE (user_id, undo_operation_id);

ALTER TABLE fridge_inventory_operation_change
    ADD COLUMN before_stock_state VARCHAR(16),
    ADD COLUMN after_stock_state VARCHAR(16);

ALTER TABLE fridge_inventory_operation_change
    ADD CONSTRAINT fridge_inventory_operation_change_before_stock_check
        CHECK (before_stock_state IS NULL OR before_stock_state IN ('IN_STOCK', 'LOW')),
    ADD CONSTRAINT fridge_inventory_operation_change_after_stock_check
        CHECK (after_stock_state IS NULL OR after_stock_state IN ('IN_STOCK', 'LOW'));
