'use strict';
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local'), quiet: true });
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const fs = require('node:fs');
const axios = require('axios');
const { Pool } = require('pg');
const { configuration } = require('./config');
const { createApp } = require('./app');

async function start() {
  const config = configuration();
    let conexion;

  if (process.env.DATABASE_URL) {
    conexion = { connectionString: process.env.DATABASE_URL };
  } else {
    for (const field of ['DB_USER', 'DB_HOST', 'DB_NAME', 'DB_PASSWORD']) {
      if (!process.env[field]) throw new Error(`Configura ${field}`);
    }

    const ssl = process.env.DB_SSL === 'true'
      ? {
          rejectUnauthorized: true,
          ...(process.env.DB_SSL_CA_FILE
            ? { ca: fs.readFileSync(process.env.DB_SSL_CA_FILE, 'utf8') }
            : {}),
        }
      : undefined;

    conexion = {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: Number(process.env.DB_PORT || 5432),
      ssl,
    };
  }

  const pool = new Pool({
    ...conexion,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
    idle_in_transaction_session_timeout: 10000,
  });
  pool.on('error', () => console.error('Error de conexión PostgreSQL.'));
  // No retiene un cliente del pool ni imprime credenciales en caso de error.
  await pool.query('SELECT 1');
  await pool.query('SELECT token_hash FROM echohead_sessions LIMIT 0');
  await pool.query('SELECT link_user_id FROM echohead_oauth_attempts LIMIT 0');
  await pool.query('SELECT username FROM echohead_credentials LIMIT 0');
  const http = axios.create({ timeout: 10000, maxRedirects: 0, maxContentLength: 1024 * 1024, maxBodyLength: 16384 });
  const spotify = {
    async exchange(code, verifier) {
      const response = await http.post('https://accounts.spotify.com/api/token', new URLSearchParams({
        grant_type: 'authorization_code', code, redirect_uri: config.redirectUri, code_verifier: verifier,
      }).toString(), { auth: { username: config.clientId, password: config.clientSecret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      return response.data;
    },
    async profile(accessToken) {
      const response = await http.get('https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      return response.data;
    },
  };
  const app = createApp({ pool, spotify, config });
  const server = app.listen(config.port, process.env.BIND_HOST || '127.0.0.1', () => console.log(`EchoHead backend: puerto ${config.port}`));
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  const cleanup = async () => {
    try {
      await pool.query('DELETE FROM echohead_sessions WHERE expires_at <= NOW()');
      await pool.query('DELETE FROM echohead_oauth_attempts WHERE expires_at <= NOW()');
      await pool.query('DELETE FROM echohead_auth_limits WHERE expires_at <= NOW()');
    } catch { console.error('No se pudieron limpiar las sesiones vencidas.'); }
  };
  await cleanup();
  const timer = setInterval(cleanup, 10 * 60 * 1000);
  timer.unref();
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
    clearInterval(timer);
    server.close(() => { pool.end().then(() => process.exit(0)); });
    setTimeout(() => process.exit(1), 10000).unref();
  });
}
if (require.main === module) {
  start().catch(error => {
    console.error('Tipo de error:', error.name);
console.error('Código:', error.code || 'Sin código');
console.error(
  'Ubicación:',
  String(error.stack || '')
    .split('\n')
    .slice(1, 4)
    .join('\n')
);

    const mensajes = {
      ECONNREFUSED: 'No se pudo conectar con PostgreSQL. Revisa que esté encendido y que DB_HOST y DB_PORT sean correctos.',
      ENOTFOUND: 'No se encontró el servidor indicado en DB_HOST.',
      '28P01': 'PostgreSQL rechazó el usuario o la contraseña.',
      '28000': 'PostgreSQL rechazó el acceso de esta conexión.',
      '3D000': 'La base indicada en DB_NAME no existe en ese servidor.',
      '42P01': 'Falta una tabla. Comprueba que ejecutaste la migración en echohead_pruebas.',
      '42501': 'El usuario de PostgreSQL no tiene los permisos necesarios.',
      ERR_INVALID_URL: 'FRONTEND_ORIGIN o REDIRECT_URI no contiene una URL válida.',
    };

    const mensaje = String(error.message || '');

    const configuracionReconocida =
      /^(Configura [A-Z_]+$|FRONTEND_ORIGIN |REDIRECT_URI |COOKIE_SAMESITE |PORT no válido$|TRUST_PROXY |El frontend público requiere HTTPS$|Solo se permiten cookies sin Secure en desarrollo local$)/.test(
        mensaje
      );

    console.error(
      'No se pudo iniciar:',
      mensajes[error.code] ||
        (configuracionReconocida
          ? mensaje
          : 'Error de arranque no identificado.')
    );

    process.exitCode = 1;
  });
}


module.exports = { start };
