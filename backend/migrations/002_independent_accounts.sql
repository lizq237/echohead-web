-- Ejecutar DESPUÉS de 001_security.sql, sobre una copia de prueba.
-- Conserva IDs, perfiles, reseñas, favoritos y seguidores existentes.
BEGIN;
ALTER TABLE users ALTER COLUMN spotify_id DROP NOT NULL;
CREATE TABLE IF NOT EXISTS echohead_credentials (
  user_id INTEGER PRIMARY KEY REFERENCES users(id_echohead) ON DELETE CASCADE,
  username VARCHAR(32) NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_]{3,32}$'),
  password_hash TEXT NOT NULL,
  recovery_hash CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS echohead_auth_limits (
  key_hash CHAR(64) PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE echohead_sessions ADD COLUMN IF NOT EXISTS authenticated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE echohead_oauth_attempts ADD COLUMN IF NOT EXISTS link_user_id INTEGER REFERENCES users(id_echohead) ON DELETE CASCADE;
ALTER TABLE echohead_oauth_attempts ADD COLUMN IF NOT EXISTS link_session_hash CHAR(64);
-- Los IDs antiguos siguen intactos. Los nuevos usan mb:rg:<UUID>, mb:rec:<UUID>
-- o mb:artist:<UUID>; caben en los campos existentes y no colisionan con Spotify.
COMMIT;
