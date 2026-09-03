-- Older development databases were managed by Hibernate ddl-auto=update and can
-- contain only part of V17-V22. The Docker dev profile baselines those databases
-- at V22, then this idempotent migration brings them to the complete schema.

ALTER TABLE recipe
    ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',
    ADD COLUMN IF NOT EXISTS servings INTEGER NOT NULL DEFAULT 2,
    ADD COLUMN IF NOT EXISTS content_locale VARCHAR(2) NOT NULL DEFAULT 'en';

ALTER TABLE ingredient
    ADD COLUMN IF NOT EXISTS canonical_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS is_staple BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE ingredient
SET canonical_name = LOWER(REGEXP_REPLACE(BTRIM(name), '\\s+', ' ', 'g'))
WHERE canonical_name IS NULL;

ALTER TABLE recipe_ingredient
    ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);

UPDATE recipe_ingredient ri
SET display_name = i.name
FROM ingredient i
WHERE ri.ingredient_id = i.id
  AND ri.display_name IS NULL;

ALTER TABLE fridge_ingredient
    ADD COLUMN IF NOT EXISTS ingredient_id BIGINT,
    ADD COLUMN IF NOT EXISTS source VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN IF NOT EXISTS quantity_accuracy VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
    ADD COLUMN IF NOT EXISTS barcode VARCHAR(64),
    ADD COLUMN IF NOT EXISTS stock_state VARCHAR(16) NOT NULL DEFAULT 'IN_STOCK',
    ADD COLUMN IF NOT EXISTS last_confirmed_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS ingredient_alias (
    id BIGSERIAL PRIMARY KEY,
    ingredient_id BIGINT NOT NULL,
    normalized_alias VARCHAR(255) NOT NULL,
    locale VARCHAR(10),
    source VARCHAR(30) NOT NULL DEFAULT 'CURATED',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fridge_inventory_operation (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    client_operation_id VARCHAR(36) NOT NULL,
    source VARCHAR(32) NOT NULL,
    source_reference VARCHAR(100),
    status VARCHAR(16) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    result_json TEXT NOT NULL,
    undo_operation_id VARCHAR(36)
);

CREATE TABLE IF NOT EXISTS fridge_inventory_operation_change (
    id BIGSERIAL PRIMARY KEY,
    operation_id BIGINT NOT NULL,
    change_type VARCHAR(16) NOT NULL,
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
    before_stock_state VARCHAR(16),
    after_stock_state VARCHAR(16),
    before_source VARCHAR(32),
    after_source VARCHAR(32),
    before_quantity_accuracy VARCHAR(16),
    after_quantity_accuracy VARCHAR(16),
    before_barcode VARCHAR(64),
    after_barcode VARCHAR(64),
    before_last_confirmed_at TIMESTAMP WITH TIME ZONE,
    after_last_confirmed_at TIMESTAMP WITH TIME ZONE,
    before_ingredient_id BIGINT,
    after_ingredient_id BIGINT
);

ALTER TABLE fridge_inventory_operation
    ADD COLUMN IF NOT EXISTS undo_operation_id VARCHAR(36);

ALTER TABLE fridge_inventory_operation_change
    ADD COLUMN IF NOT EXISTS before_stock_state VARCHAR(16),
    ADD COLUMN IF NOT EXISTS after_stock_state VARCHAR(16),
    ADD COLUMN IF NOT EXISTS before_source VARCHAR(32),
    ADD COLUMN IF NOT EXISTS after_source VARCHAR(32),
    ADD COLUMN IF NOT EXISTS before_quantity_accuracy VARCHAR(16),
    ADD COLUMN IF NOT EXISTS after_quantity_accuracy VARCHAR(16),
    ADD COLUMN IF NOT EXISTS before_barcode VARCHAR(64),
    ADD COLUMN IF NOT EXISTS after_barcode VARCHAR(64),
    ADD COLUMN IF NOT EXISTS before_last_confirmed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS after_last_confirmed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS before_ingredient_id BIGINT,
    ADD COLUMN IF NOT EXISTS after_ingredient_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recipe_visibility_check') THEN
        ALTER TABLE recipe ADD CONSTRAINT recipe_visibility_check
            CHECK (visibility IN ('PRIVATE', 'PUBLIC'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recipe_content_locale_check') THEN
        ALTER TABLE recipe ADD CONSTRAINT recipe_content_locale_check
            CHECK (content_locale IN ('en', 'pl'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ingredient_alias_locale_check') THEN
        ALTER TABLE ingredient_alias ADD CONSTRAINT ingredient_alias_locale_check
            CHECK (locale IS NULL OR locale IN ('en', 'pl'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ingredient_alias_ingredient') THEN
        ALTER TABLE ingredient_alias ADD CONSTRAINT fk_ingredient_alias_ingredient
            FOREIGN KEY (ingredient_id) REFERENCES ingredient(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fridge_ingredient_ingredient') THEN
        ALTER TABLE fridge_ingredient ADD CONSTRAINT fk_fridge_ingredient_ingredient
            FOREIGN KEY (ingredient_id) REFERENCES ingredient(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fridge_ingredient_source_check') THEN
        ALTER TABLE fridge_ingredient ADD CONSTRAINT fridge_ingredient_source_check
            CHECK (source IN ('MANUAL', 'SHOPPING_LIST', 'BARCODE_SCAN', 'QUICK_ADJUSTMENT', 'COOKED_RECIPE'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fridge_ingredient_quantity_accuracy_check') THEN
        ALTER TABLE fridge_ingredient ADD CONSTRAINT fridge_ingredient_quantity_accuracy_check
            CHECK (quantity_accuracy IN ('EXACT', 'ESTIMATED', 'UNKNOWN'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fridge_ingredient_stock_state_check') THEN
        ALTER TABLE fridge_ingredient ADD CONSTRAINT fridge_ingredient_stock_state_check
            CHECK (stock_state IN ('IN_STOCK', 'LOW'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uk_fridge_inventory_operation_user_client') THEN
        ALTER TABLE fridge_inventory_operation ADD CONSTRAINT uk_fridge_inventory_operation_user_client
            UNIQUE (user_id, client_operation_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uk_fridge_inventory_operation_undo') THEN
        ALTER TABLE fridge_inventory_operation ADD CONSTRAINT uk_fridge_inventory_operation_undo
            UNIQUE (user_id, undo_operation_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fridge_inventory_operation_user') THEN
        ALTER TABLE fridge_inventory_operation ADD CONSTRAINT fk_fridge_inventory_operation_user
            FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fridge_inventory_operation_change_operation') THEN
        ALTER TABLE fridge_inventory_operation_change ADD CONSTRAINT fk_fridge_inventory_operation_change_operation
            FOREIGN KEY (operation_id) REFERENCES fridge_inventory_operation(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fridge_operation_change_before_ingredient') THEN
        ALTER TABLE fridge_inventory_operation_change ADD CONSTRAINT fk_fridge_operation_change_before_ingredient
            FOREIGN KEY (before_ingredient_id) REFERENCES ingredient(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fridge_operation_change_after_ingredient') THEN
        ALTER TABLE fridge_inventory_operation_change ADD CONSTRAINT fk_fridge_operation_change_after_ingredient
            FOREIGN KEY (after_ingredient_id) REFERENCES ingredient(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fridge_inventory_operation_source_check') THEN
        ALTER TABLE fridge_inventory_operation ADD CONSTRAINT fridge_inventory_operation_source_check
            CHECK (source IN ('MANUAL', 'SHOPPING_LIST', 'BARCODE_SCAN', 'QUICK_ADJUSTMENT', 'COOKED_RECIPE'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fridge_inventory_operation_status_check') THEN
        ALTER TABLE fridge_inventory_operation ADD CONSTRAINT fridge_inventory_operation_status_check
            CHECK (status IN ('APPLIED', 'PARTIAL'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fridge_inventory_operation_change_type_check') THEN
        ALTER TABLE fridge_inventory_operation_change ADD CONSTRAINT fridge_inventory_operation_change_type_check
            CHECK (change_type IN ('ADD', 'DECREMENT', 'FINISH', 'MARK_LOW'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fridge_inventory_operation_change_before_stock_check') THEN
        ALTER TABLE fridge_inventory_operation_change ADD CONSTRAINT fridge_inventory_operation_change_before_stock_check
            CHECK (before_stock_state IS NULL OR before_stock_state IN ('IN_STOCK', 'LOW'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fridge_inventory_operation_change_after_stock_check') THEN
        ALTER TABLE fridge_inventory_operation_change ADD CONSTRAINT fridge_inventory_operation_change_after_stock_check
            CHECK (after_stock_state IS NULL OR after_stock_state IN ('IN_STOCK', 'LOW'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fridge_inventory_operation_change_before_source_check') THEN
        ALTER TABLE fridge_inventory_operation_change ADD CONSTRAINT fridge_inventory_operation_change_before_source_check
            CHECK (before_source IS NULL OR before_source IN ('MANUAL', 'SHOPPING_LIST', 'BARCODE_SCAN', 'QUICK_ADJUSTMENT', 'COOKED_RECIPE'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fridge_inventory_operation_change_after_source_check') THEN
        ALTER TABLE fridge_inventory_operation_change ADD CONSTRAINT fridge_inventory_operation_change_after_source_check
            CHECK (after_source IS NULL OR after_source IN ('MANUAL', 'SHOPPING_LIST', 'BARCODE_SCAN', 'QUICK_ADJUSTMENT', 'COOKED_RECIPE'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fridge_inventory_operation_change_before_accuracy_check') THEN
        ALTER TABLE fridge_inventory_operation_change ADD CONSTRAINT fridge_inventory_operation_change_before_accuracy_check
            CHECK (before_quantity_accuracy IS NULL OR before_quantity_accuracy IN ('EXACT', 'ESTIMATED', 'UNKNOWN'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fridge_inventory_operation_change_after_accuracy_check') THEN
        ALTER TABLE fridge_inventory_operation_change ADD CONSTRAINT fridge_inventory_operation_change_after_accuracy_check
            CHECK (after_quantity_accuracy IS NULL OR after_quantity_accuracy IN ('EXACT', 'ESTIMATED', 'UNKNOWN'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ingredient_canonical_name ON ingredient (canonical_name);
CREATE INDEX IF NOT EXISTS idx_ingredient_alias_normalized_alias ON ingredient_alias (normalized_alias);
CREATE INDEX IF NOT EXISTS idx_fridge_ingredient_ingredient_id ON fridge_ingredient (ingredient_id);
CREATE INDEX IF NOT EXISTS idx_recipe_content_locale ON recipe (content_locale);
CREATE INDEX IF NOT EXISTS idx_fridge_inventory_operation_user ON fridge_inventory_operation (user_id);
CREATE INDEX IF NOT EXISTS idx_fridge_inventory_operation_change_operation ON fridge_inventory_operation_change (operation_id);
