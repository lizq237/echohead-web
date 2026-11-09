BEGIN;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS foto_personalizada BYTEA
CHECK (
    foto_personalizada IS NULL
    OR octet_length(foto_personalizada) BETWEEN 1 AND 262144
);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS foto_personalizada_version UUID;

COMMIT;