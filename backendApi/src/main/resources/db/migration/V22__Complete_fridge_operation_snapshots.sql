ALTER TABLE fridge_inventory_operation_change
    ADD COLUMN before_source VARCHAR(32),
    ADD COLUMN after_source VARCHAR(32),
    ADD COLUMN before_quantity_accuracy VARCHAR(16),
    ADD COLUMN after_quantity_accuracy VARCHAR(16),
    ADD COLUMN before_barcode VARCHAR(64),
    ADD COLUMN after_barcode VARCHAR(64),
    ADD COLUMN before_last_confirmed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN after_last_confirmed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN before_ingredient_id BIGINT,
    ADD COLUMN after_ingredient_id BIGINT;

ALTER TABLE fridge_inventory_operation_change
    ADD CONSTRAINT fridge_inventory_operation_change_before_source_check
        CHECK (before_source IS NULL OR before_source IN ('MANUAL', 'SHOPPING_LIST', 'BARCODE_SCAN', 'QUICK_ADJUSTMENT', 'COOKED_RECIPE')),
    ADD CONSTRAINT fridge_inventory_operation_change_after_source_check
        CHECK (after_source IS NULL OR after_source IN ('MANUAL', 'SHOPPING_LIST', 'BARCODE_SCAN', 'QUICK_ADJUSTMENT', 'COOKED_RECIPE')),
    ADD CONSTRAINT fridge_inventory_operation_change_before_accuracy_check
        CHECK (before_quantity_accuracy IS NULL OR before_quantity_accuracy IN ('EXACT', 'ESTIMATED', 'UNKNOWN')),
    ADD CONSTRAINT fridge_inventory_operation_change_after_accuracy_check
        CHECK (after_quantity_accuracy IS NULL OR after_quantity_accuracy IN ('EXACT', 'ESTIMATED', 'UNKNOWN')),
    ADD CONSTRAINT fk_fridge_operation_change_before_ingredient
        FOREIGN KEY (before_ingredient_id) REFERENCES ingredient(id),
    ADD CONSTRAINT fk_fridge_operation_change_after_ingredient
        FOREIGN KEY (after_ingredient_id) REFERENCES ingredient(id);
