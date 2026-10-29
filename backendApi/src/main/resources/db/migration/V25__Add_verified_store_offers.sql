CREATE TABLE store_offer (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    store VARCHAR(255) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE NOT NULL,
    active BOOLEAN NOT NULL,
    document TEXT NOT NULL,
    CONSTRAINT store_offer_dates CHECK (valid_to >= valid_from)
);
CREATE INDEX store_offer_eligibility ON store_offer(active, store, valid_from, valid_to, verified_at);
