ALTER TABLE ingredient
    ADD COLUMN canonical_name VARCHAR(255),
    ADD COLUMN is_staple BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE ingredient
SET canonical_name = LOWER(REGEXP_REPLACE(BTRIM(name), '\\s+', ' ', 'g'))
WHERE canonical_name IS NULL;

CREATE INDEX idx_ingredient_canonical_name ON ingredient (canonical_name);

CREATE TABLE ingredient_alias (
    id BIGSERIAL PRIMARY KEY,
    ingredient_id BIGINT NOT NULL,
    normalized_alias VARCHAR(255) NOT NULL,
    locale VARCHAR(10),
    source VARCHAR(30) NOT NULL DEFAULT 'CURATED',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ingredient_alias_locale_check CHECK (locale IS NULL OR locale IN ('en', 'pl')),
    CONSTRAINT fk_ingredient_alias_ingredient FOREIGN KEY (ingredient_id)
        REFERENCES ingredient(id) ON DELETE CASCADE
);

CREATE INDEX idx_ingredient_alias_normalized_alias ON ingredient_alias (normalized_alias);

ALTER TABLE recipe_ingredient
    ADD COLUMN display_name VARCHAR(255);

UPDATE recipe_ingredient ri
SET display_name = i.name
FROM ingredient i
WHERE ri.ingredient_id = i.id
  AND ri.display_name IS NULL;

ALTER TABLE fridge_ingredient
    ADD COLUMN ingredient_id BIGINT,
    ADD CONSTRAINT fk_fridge_ingredient_ingredient FOREIGN KEY (ingredient_id)
        REFERENCES ingredient(id) ON DELETE SET NULL;

CREATE INDEX idx_fridge_ingredient_ingredient_id ON fridge_ingredient (ingredient_id);
