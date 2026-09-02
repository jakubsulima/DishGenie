ALTER TABLE recipe
    ADD COLUMN content_locale VARCHAR(2) NOT NULL DEFAULT 'en';

ALTER TABLE recipe
    ADD CONSTRAINT recipe_content_locale_check CHECK (content_locale IN ('en', 'pl'));

CREATE INDEX idx_recipe_content_locale ON recipe (content_locale);
