ALTER TABLE fridge_ingredient
    ADD COLUMN source VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN quantity_accuracy VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
    ADD COLUMN barcode VARCHAR(64),
    ADD COLUMN stock_state VARCHAR(16) NOT NULL DEFAULT 'IN_STOCK',
    ADD COLUMN last_confirmed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE fridge_ingredient
    ADD CONSTRAINT fridge_ingredient_source_check CHECK (source IN ('MANUAL', 'SHOPPING_LIST', 'BARCODE_SCAN', 'QUICK_ADJUSTMENT', 'COOKED_RECIPE')),
    ADD CONSTRAINT fridge_ingredient_quantity_accuracy_check CHECK (quantity_accuracy IN ('EXACT', 'ESTIMATED', 'UNKNOWN')),
    ADD CONSTRAINT fridge_ingredient_stock_state_check CHECK (stock_state IN ('IN_STOCK', 'LOW'));

CREATE TABLE fridge_inventory_operation (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    client_operation_id VARCHAR(36) NOT NULL,
    source VARCHAR(32) NOT NULL CHECK (source IN ('MANUAL', 'SHOPPING_LIST', 'BARCODE_SCAN', 'QUICK_ADJUSTMENT', 'COOKED_RECIPE')),
    source_reference VARCHAR(100),
    status VARCHAR(16) NOT NULL CHECK (status IN ('APPLIED', 'PARTIAL')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    result_json TEXT NOT NULL,
    CONSTRAINT uk_fridge_inventory_operation_user_client UNIQUE (user_id, client_operation_id),
    CONSTRAINT fk_fridge_inventory_operation_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
);

CREATE TABLE fridge_inventory_operation_change (
    id BIGSERIAL PRIMARY KEY,
    operation_id BIGINT NOT NULL,
    change_type VARCHAR(16) NOT NULL CHECK (change_type IN ('ADD', 'DECREMENT', 'FINISH', 'MARK_LOW')),
    fridge_item_id BIGINT,
    before_exists BOOLEAN NOT NULL,
    before_name VARCHAR(100),
    before_amount DOUBLE PRECISION,
    before_unit VARCHAR(20),
    before_expiration_date DATE,
    after_exists BOOLEAN NOT NULL,
    after_name VARCHAR(100),
    after_amount DOUBLE PRECISION,
    after_unit VARCHAR(20),
    after_expiration_date DATE,
    CONSTRAINT fk_fridge_inventory_operation_change_operation FOREIGN KEY (operation_id)
        REFERENCES fridge_inventory_operation(id) ON DELETE CASCADE
);

CREATE INDEX idx_fridge_inventory_operation_user ON fridge_inventory_operation(user_id);
CREATE INDEX idx_fridge_inventory_operation_change_operation ON fridge_inventory_operation_change(operation_id);
