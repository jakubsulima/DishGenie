ALTER TABLE store_offer ADD COLUMN source_type VARCHAR(32) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE store_offer ADD COLUMN ingredient_key VARCHAR(100);
CREATE INDEX store_offer_source ON store_offer(source_type, active);
