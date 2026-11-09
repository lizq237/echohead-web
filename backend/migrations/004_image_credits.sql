BEGIN;

CREATE TABLE IF NOT EXISTS echohead_image_credits (
    id UUID PRIMARY KEY,

    content_hash TEXT NOT NULL UNIQUE
        CHECK (content_hash ~ '^[a-f0-9]{64}$'),

    items JSONB NOT NULL
        CHECK (jsonb_typeof(items) = 'array')
        CHECK (jsonb_array_length(items) BETWEEN 1 AND 15)
        CHECK (octet_length(items::text) <= 131072),

    created_by INTEGER
        REFERENCES users(id_echohead)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS echohead_image_credits_creator_date
ON echohead_image_credits (created_by, created_at);

COMMIT;