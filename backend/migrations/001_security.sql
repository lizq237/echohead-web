-- Ejecutar una vez sobre una copia de prueba; no elimina datos del proyecto.
BEGIN;
CREATE TABLE IF NOT EXISTS echohead_oauth_attempts (
  state_hash CHAR(64) PRIMARY KEY,
  browser_hash CHAR(64) NOT NULL,
  verifier VARCHAR(128) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS echohead_oauth_expiry ON echohead_oauth_attempts(expires_at);
CREATE TABLE IF NOT EXISTS echohead_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id_echohead) ON DELETE CASCADE,
  csrf_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS echohead_session_expiry ON echohead_sessions(expires_at);
CREATE INDEX IF NOT EXISTS echohead_session_user ON echohead_sessions(user_id);
-- La tabla se usaba en server.js pero faltaba en esquema.sql.
CREATE TABLE IF NOT EXISTS seguidores (
  id SERIAL PRIMARY KEY,
  seguidor_id INTEGER NOT NULL REFERENCES users(id_echohead) ON DELETE CASCADE,
  seguido_id INTEGER NOT NULL REFERENCES users(id_echohead) ON DELETE CASCADE,
  CONSTRAINT uq_seguidor_seguido UNIQUE(seguidor_id, seguido_id),
  CONSTRAINT seguidores_no_self CHECK(seguidor_id <> seguido_id)
);
CREATE INDEX IF NOT EXISTS seguidores_seguido_idx ON seguidores(seguido_id);
COMMIT;
