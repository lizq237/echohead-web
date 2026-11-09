'use strict';
const express = require('express');
const { accounts } = require('./accounts');
const { catalog } = require('./catalog');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { rateLimit } = require('express-rate-limit');
const { auth, transaction, PUBLIC_USER } = require('./auth');
const { HttpError, id, schemas, favorites, parse, own } = require('./validation');
const { randomUUID, createHash } = require('node:crypto');
const { procesarFotoPerfil } = require('./profile-photos');
const { artistPhotos } = require('./artist-photos');
const { imageCredits } = require('./image-credits');

function createApp({ pool, spotify, config, musicbrainz, logger = console, limits = {} }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.set('query parser', 'simple');
  app.use((req, res, next) => {
    if (!config.trustProxy) { delete req.headers['x-forwarded-for']; delete req.headers.forwarded; }
    next();
  });
  app.use(helmet({ strictTransportSecurity: config.secureCookies ? undefined : false }));
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    // CORS no autentica: también se comprueba Origin antes de cualquier escritura.
    const origin = req.get('Origin');
    if (origin && origin !== config.frontendOrigin) return next(new HttpError(403, 'Origen no autorizado.'));
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && origin !== config.frontendOrigin) {
      return next(new HttpError(403, 'La solicitud debe venir de EchoHead.'));
    }
    next();
  });
  app.use(cors({ origin: config.frontendOrigin, credentials: true,
    methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','X-CSRF-Token'] }));
  const limiter = (limit, windowMs, options = {}) => rateLimit({ windowMs, limit,
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes. Espera antes de intentarlo de nuevo.' }, ...options });
  app.use(limiter(limits.global || 300, 60_000));
  app.use((req, res, next) => {
    if (['POST', 'PUT', 'DELETE'].includes(req.method) && !req.is('application/json')) {
      return next(new HttpError(415, 'Usa Content-Type: application/json.'));
    }
    next();
  });
  const jsonNormal = express.json({
  limit: '32kb',
  strict: true,
  inflate: false,
});

app.use((req, res, next) => {
  // La foto se leerá después de comprobar la sesión y el CSRF.
  const esSubidaFoto =
    req.method === 'PUT' &&
    /^\/usuarios\/foto\/?$/i.test(req.path);

  if (esSubidaFoto) return next();

  return jsonNormal(req, res, next);
});
  app.use(cookieParser());
  const session = auth({ pool, spotify, config });
  const loginLimiter = limiter(limits.login || 15, 10 * 60_000);
  app.get('/health', (req, res) => res.json({ ok: true }));
  app.get('/login', loginLimiter, session.login);
  app.post('/intercambiar-token', loginLimiter, session.exchange);
  const account = accounts({ pool, session });
  const credentialLimiter = limiter(limits.credentials || 20, 15 * 60_000);
  app.post('/auth/register', credentialLimiter, account.register);
  app.post('/auth/login', credentialLimiter, account.login);
  app.post('/auth/recover', credentialLimiter, account.recover);
  app.post('/auth/restore', session.restore);
  app.get('/auth/options', (req,res) => res.json({ spotify: Boolean(config.clientId && config.clientSecret) }));
  const creditosImagenes = imageCredits({ pool });

// Consulta pública: permite abrir los créditos de una descarga
// sin iniciar sesión. No devuelve datos privados de la cuenta.
app.get(
  '/image-credits/:id',
  limiter(60, 60_000),
  creditosImagenes.consultar
);
  // Todo endpoint de datos queda cerrado por defecto.
  app.use(session.required);
  app.use((req, res, next) => {
    if (['GET', 'HEAD'].includes(req.method)) return next();
    return writeLimiter(req, res, next);
  });
  const writeLimiter = limiter(limits.write || 60, 60_000, { keyGenerator: req => String(req.user.id_echohead) });
  app.post('/auth/logout', session.logout);
  // Crear créditos requiere sesión y pasa por las
// comprobaciones existentes de CSRF y límite de escritura.
app.post(
  '/image-credits',
  limiter(10, 60_000, {
    keyGenerator: req => String(req.user.id_echohead),
  }),
  creditosImagenes.crear
);
  app.get('/auth/account', account.status);
  app.get('/lastfm/resumen-mensual', async (req, res) => {
  const cuenta = await pool.query(
    'SELECT lastfm_username FROM users WHERE id_echohead = $1',
    [req.user.id_echohead]
  );

  const usuario = cuenta.rows[0]?.lastfm_username;

  if (!usuario) {
    return res.json({
      conectado: false,
      artistas: [],
      albumes: [],
      canciones: [],
    });
  }

  if (!config.lastfmApiKey) {
    throw new HttpError(503, 'Last.fm aún no está configurado.');
  }

  async function consultarTop(metodo, grupo, tipo) {
    const url = new URL('https://ws.audioscrobbler.com/2.0/');

    url.search = new URLSearchParams({
      method: metodo,
      user: usuario,
      api_key: config.lastfmApiKey,
      period: '1month',
      limit: '3',
      format: 'json',
    }).toString();

    const respuesta = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    });

    if (!respuesta.ok) {
      throw new Error('Falló la consulta a Last.fm.');
    }

    const datos = await respuesta.json();
    const items = datos[grupo]?.[tipo];

    if (datos.error || !Array.isArray(items)) {
      throw new Error('Last.fm devolvió una respuesta inesperada.');
    }

    return items.slice(0, 3).map(item => {
      const imagenes = Array.isArray(item.image) ? item.image : [];
      const portada = [...imagenes].reverse().find(img => img?.['#text']);
      const images = portada ? [{ url: portada['#text'] }] : [];

      const resultado = {
        id: item.mbid || item.url || `${tipo}-${item.artist?.name || ''}-${item.name}`,
        name: item.name,
      };

      if (tipo === 'track') {
        return {
  ...resultado,
  artista: item.artist?.name || '',
  album: { images },
};
      }

      return { ...resultado, images };
    });
  }

  try {
    const [artistas, albumes, canciones] = await Promise.all([
      consultarTop('user.getTopArtists', 'topartists', 'artist'),
      consultarTop('user.getTopAlbums', 'topalbums', 'album'),
      consultarTop('user.getTopTracks', 'toptracks', 'track'),
    ]);
    const estrellaLastfm = '2a96cbd8b46e442fc41c2b86b821562f';

function esPortada(url) {
  return typeof url === 'string'
    && url.startsWith('https://')
    && !url.includes(estrellaLastfm);
}

function normalizar(texto) {
  return (texto || '').normalize('NFC').trim().toLowerCase();
}

const sinPortada = canciones.filter(
  cancion => !esPortada(cancion.album.images[0]?.url)
);

if (sinPortada.length) {
  // Si Last.fm no tiene portada, EchoHead usará su disco de respaldo.
  for (const cancion of sinPortada) {
    cancion.album.images = [];
  }

  try {
    const url = new URL('https://ws.audioscrobbler.com/2.0/');
    url.search = new URLSearchParams({
      method: 'user.getRecentTracks',
      user: usuario,
      api_key: config.lastfmApiKey,
      limit: '200',
      format: 'json',
    }).toString();

    const respuesta = await fetch(url, {
      signal: AbortSignal.timeout(4000),
    });

    if (respuesta.ok) {
      const datos = await respuesta.json();
      const escuchas = datos.recenttracks?.track;

      if (Array.isArray(escuchas)) {
        for (const cancion of sinPortada) {
          if (!cancion.artista) continue;

          for (const escucha of escuchas) {
            if (
              !escucha.date?.uts ||
              normalizar(escucha.name) !== normalizar(cancion.name) ||
              normalizar(escucha.artist?.['#text']) !== normalizar(cancion.artista)
            ) {
              continue;
            }

            const imagenes = Array.isArray(escucha.image) ? escucha.image : [];
            const portada = [...imagenes].reverse().find(
              imagen => esPortada(imagen['#text'])
            );

            if (portada) {
              cancion.album.images = [{ url: portada['#text'] }];
              break;
            }
          }
        }
      }
    }
  } catch {
    // El resumen sigue disponible si falla la consulta de portadas.
  }
}

    return res.json({ conectado: true, artistas, albumes, canciones });
  } catch {
    throw new HttpError(
      503,
      'No pudimos cargar tu resumen de Last.fm. Inténtalo de nuevo.'
    );
  }
});
  app.post('/auth/credentials', credentialLimiter, account.attach);
  app.post('/auth/password', credentialLimiter, account.change);
  app.post('/auth/spotify/connect', loginLimiter, session.connect);
  app.post('/auth/lastfm/connect', loginLimiter, async (req, res) => {
  if (!config.lastfmApiKey || !config.lastfmSharedSecret) {
    throw new HttpError(503, 'La conexión con Last.fm aún no está configurada.');
  }

  const state = randomUUID();

  const intento = await pool.query(
    `UPDATE echohead_sessions
        SET lastfm_link_state = $1,
            lastfm_link_expires_at = NOW() + INTERVAL '10 minutes'
      WHERE token_hash = $2 AND expires_at > NOW()`,
    [state, req.sessionHash]
  );

  if (intento.rowCount !== 1) {
    throw new HttpError(401, 'Vuelve a iniciar sesión en EchoHead.');
  }

  const retorno = new URL(config.lastfmCallbackUrl);
  retorno.searchParams.set('state', state);

  const autorizacion = new URL('https://www.last.fm/api/auth/');
  autorizacion.searchParams.set('api_key', config.lastfmApiKey);
  autorizacion.searchParams.set('cb', retorno.href);

  res.set('Cache-Control', 'no-store');
  res.json({ url: autorizacion.href });
});

app.get('/auth/lastfm/callback', async (req, res) => {
  const { state, token } = req.query;
  const volver = new URL('/cuenta', config.frontendOrigin);

  function terminar(resultado) {
    volver.searchParams.set('lastfm', resultado);
    return res.redirect(303, volver.href);
  }

  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (typeof state !== 'string' || !uuid.test(state)) {
    return terminar('intento-invalido');
  }

  if (typeof token !== 'string' || !token || token.length > 512) {
    return terminar('sin-autorizacion');
  }

  const parametrosIntento = [req.sessionHash, state];
  const intentoVigente = `
    token_hash = $1
    AND lastfm_link_state = $2
    AND lastfm_link_expires_at > NOW()
    AND expires_at > NOW()
  `;

  const intento = await pool.query(
    `SELECT 1 FROM echohead_sessions WHERE ${intentoVigente}`,
    parametrosIntento
  );

  if (!intento.rowCount) return terminar('intento-invalido');

  const metodo = 'auth.getSession';
  const firma = createHash('md5')
    .update(`api_key${config.lastfmApiKey}method${metodo}token${token}${config.lastfmSharedSecret}`)
    .digest('hex');

  const url = new URL('https://ws.audioscrobbler.com/2.0/');
  url.search = new URLSearchParams({
    method: metodo,
    api_key: config.lastfmApiKey,
    token,
    api_sig: firma,
    format: 'json',
  }).toString();

  let nombre;

  try {
    const respuesta = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
    });
    const datos = await respuesta.json();

    if ([4, 14, 15].includes(Number(datos.error))) {
      return terminar('sin-autorizacion');
    }

    nombre = datos.session?.name?.trim();

    if (!respuesta.ok || datos.error || !nombre) {
      return terminar('error');
    }
  } catch {
    return terminar('error');
  }

  const guardado = await transaction(pool, async client => {
    const usado = await client.query(
      `UPDATE echohead_sessions
          SET lastfm_link_state = NULL, lastfm_link_expires_at = NULL
        WHERE ${intentoVigente}
        RETURNING user_id`,
      parametrosIntento
    );

    if (!usado.rowCount) return false;

    await client.query(
      'UPDATE users SET lastfm_username = $1 WHERE id_echohead = $2',
      [nombre, usado.rows[0].user_id]
    );

    return true;
  });

  return terminar(guardado ? 'conectado' : 'intento-invalido');
});

  const music = catalog({ musicbrainz, config });
  app.get('/catalog/search', limiter(30,60_000,{keyGenerator:req=>String(req.user.id_echohead)}), music.search);
  // Mostrar la foto personalizada a usuarios con sesión iniciada.
app.get('/usuarios/:id/foto', async (req, res) => {
  const userId = parse(id, req.params.id);

  const resultado = await pool.query(
    `SELECT foto_personalizada
     FROM users
     WHERE id_echohead = $1`,
    [userId]
  );

  const foto = resultado.rows[0]?.foto_personalizada;

  if (!foto) {
    throw new HttpError(404, 'Este usuario no tiene foto personalizada.');
  }

  res.set({
    'Content-Type': 'image/webp',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });

  res.send(foto);
});

// Quitar únicamente la foto personalizada del usuario actual.
app.delete('/usuarios/foto', async (req, res) => {
  if (
    !req.body ||
    Array.isArray(req.body) ||
    Object.keys(req.body).length !== 0
  ) {
    throw new HttpError(400, 'Envía un objeto vacío para quitar la foto.');
  }

  const resultado = await pool.query(
    `UPDATE users
     SET foto_personalizada = NULL,
         foto_personalizada_version = NULL
     WHERE id_echohead = $1
     RETURNING id_echohead, foto_perfil, foto_personalizada_version`,
    [req.user.id_echohead]
  );

  if (!resultado.rowCount) {
    throw new HttpError(404, 'Usuario no encontrado.');
  }

  res.json({
    mensaje: 'Foto personalizada eliminada.',
    ...resultado.rows[0],
  });
});
  app.get('/auth/me', (req, res) => res.json(req.user));
  const fotosArtistas = artistPhotos({ config });

app.get(
  '/catalog/artists/:id/photo',
  limiter(60, 60_000, {
    keyGenerator: req => String(req.user.id_echohead),
  }),
  fotosArtistas.handler
);
  const limiteFotos = limiter(6, 60_000, {
  keyGenerator: req => String(req.user.id_echohead),
});

app.put(
  '/usuarios/foto',
  limiteFotos,
  express.json({
    limit: '3mb',
    strict: true,
    inflate: false,
  }),
  async (req, res) => {
    const body = req.body;

    if (
      !body ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      typeof body.imagen !== 'string'
    ) {
      throw new HttpError(400, 'Envía únicamente la imagen.');
    }

    // Base64 permite enviar la imagen dentro del JSON.
    const maxBase64 = 4 * Math.ceil((2 * 1024 * 1024) / 3);

    if (body.imagen.length > maxBase64) {
      throw new HttpError(
        413,
        'La foto debe pesar como máximo 2 MB.'
      );
    }

    if (
      body.imagen.length === 0 ||
      body.imagen.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(body.imagen)
    ) {
      throw new HttpError(400, 'La imagen no tiene un formato válido.');
    }

    const original = Buffer.from(body.imagen, 'base64');

    if (original.toString('base64') !== body.imagen) {
      throw new HttpError(400, 'La imagen no tiene un formato válido.');
    }

    const foto = await procesarFotoPerfil(original);
    const version = randomUUID();

    // El usuario se obtiene de la sesión, nunca del formulario.
    const resultado = await pool.query(
      `UPDATE users
       SET foto_personalizada = $1,
           foto_personalizada_version = $2
       WHERE id_echohead = $3
       RETURNING id_echohead, foto_personalizada_version`,
      [foto, version, req.user.id_echohead]
    );

    if (!resultado.rowCount) {
      throw new HttpError(404, 'Usuario no encontrado.');
    }

    res.json({
      mensaje: 'Foto de perfil actualizada.',
      ...resultado.rows[0],
    });
  }
);
  // Compatibilidad sin permitir suplantación: no acepta datos de identidad del cliente.
  app.post('/usuarios/sync', (req, res) => {
    if (!req.body || Object.keys(req.body).length) throw new HttpError(400, 'El perfil se obtiene de Spotify, no del cliente.');
    res.json(req.user);
  });
  app.get('/usuarios/:id', async (req, res) => {
    const userId = parse(id, req.params.id);
    const result = await pool.query(`SELECT ${PUBLIC_USER} FROM users WHERE id_echohead=$1`, [userId]);
    if (!result.rowCount) throw new HttpError(404, 'Usuario no encontrado.');
    res.json(result.rows[0]);
  });
  app.put('/usuarios/descripcion', async (req, res) => {
    const body = parse(schemas.description, req.body);
    const userId = own(req, body.id_echohead);
    const result = await pool.query(`UPDATE users SET descripcion=$1 WHERE id_echohead=$2 RETURNING ${PUBLIC_USER}`, [body.nuevaDescripcion, userId]);
    res.json({ mensaje: 'Descripción actualizada.', usuario: result.rows[0] });
  });
  // Los nombres de tabla/columnas provienen SOLO de constantes, nunca de la petición.
  for (const [key, f] of Object.entries(favorites)) {
    app.put(`/usuarios/${key}`, async (req, res) => {
      const body = parse(schemas[key], req.body);
      const userId = own(req, body.id_echohead);
      await transaction(pool, async client => {
        // Serializa reemplazos concurrentes del mismo perfil.
        await client.query('SELECT id_echohead FROM users WHERE id_echohead=$1 FOR UPDATE', [userId]);
        await client.query(`DELETE FROM ${f.table} WHERE user_id=$1`, [userId]);
        for (const item of body[key]) {
          await client.query(`INSERT INTO ${f.table}(user_id,${f.prefix}_spotify_id,${f.prefix}_name,${f.prefix}_img)
            VALUES($1,$2,$3,$4)`, [userId, item.id, item[f.name], item[f.image]]);
        }
      });
      res.json({ mensaje: 'Selección actualizada.' });
    });
    app.get(`/usuarios/:id/${key}`, async (req, res) => {
      const userId = parse(id, req.params.id);
      const result = await pool.query(`SELECT ${f.prefix}_spotify_id,${f.prefix}_name,${f.prefix}_img FROM ${f.table} WHERE user_id=$1 ORDER BY id`, [userId]);
      res.json(result.rows.map(row => ({ id: row[`${f.prefix}_spotify_id`], [f.name]: row[`${f.prefix}_name`], [f.image]: row[`${f.prefix}_img`] })));
    });
  }
  app.post('/usuarios/interacciones', async (req, res) => {
    const b = parse(schemas.interaction, req.body);
    const userId = own(req, b.id_echohead);
    // Mantener coherencia con las acciones del frontend.
    const listened =
    b.es_escuchado ||
    b.es_favorito ||
    (b.calificacion || 0) > 0;
    const result = await pool.query(`INSERT INTO interacciones
      (id_echohead,spotify_id,tipo,nombre,artista,imagen_url,es_escuchado,es_favorito,es_pendiente,calificacion,descripcion)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT(id_echohead,spotify_id) DO UPDATE SET
      nombre=EXCLUDED.nombre,artista=EXCLUDED.artista,imagen_url=EXCLUDED.imagen_url,
      es_escuchado=EXCLUDED.es_escuchado,es_favorito=EXCLUDED.es_favorito,es_pendiente=EXCLUDED.es_pendiente,
      calificacion=EXCLUDED.calificacion,descripcion=EXCLUDED.descripcion,fecha_interaccion=CURRENT_TIMESTAMP
      WHERE interacciones.tipo=EXCLUDED.tipo RETURNING spotify_id`,
    [userId,b.spotify_id,b.tipo,b.nombre,b.artista,b.imagen_url,listened,b.es_favorito,
    b.es_pendiente,b.calificacion || null,b.descripcion || null]);
    if (!result.rowCount) throw new HttpError(409, 'El identificador ya está registrado con otro tipo de contenido.');
    res.json({ mensaje: 'Interacción guardada.' });
  });
  for (const key of ['albumes', 'canciones']) {
    const f = favorites[key];
    const type = key === 'albumes' ? 'album' : 'song';
    app.get(`/api/perfil/:id_echohead/${key}`, async (req, res) => {
      const userId = parse(id, req.params.id_echohead);
      const result = await pool.query(`SELECT a.${f.prefix}_spotify_id,a.${f.prefix}_name,a.${f.prefix}_img,
        i.es_favorito,i.es_escuchado,i.es_pendiente,i.calificacion,i.descripcion
        FROM ${f.table} a LEFT JOIN interacciones i ON a.${f.prefix}_spotify_id=i.spotify_id
        AND a.user_id=i.id_echohead AND i.tipo=$2 WHERE a.user_id=$1 ORDER BY a.id`, [userId, type]);
      res.json(result.rows.map(row => ({ id: row[`${f.prefix}_spotify_id`], [f.name]: row[`${f.prefix}_name`],
        [f.image]: row[`${f.prefix}_img`], es_favorito: row.es_favorito === true,
        es_escuchado: row.es_escuchado === true, es_pendiente: row.es_pendiente === true,
        calificacion: Number(row.calificacion) || 0, descripcion: row.descripcion || '' })));
    });
  }
  app.get('/api/mi-mes', async (req, res) => {
  // Consultamos exclusivamente al usuario de la sesión.
  const userId = req.user.id_echohead;

  const resultado = await pool.query(
    `
    WITH recientes AS (
      SELECT
        spotify_id,
        nombre,
        artista,
        imagen_url,
        tipo,
        es_escuchado,
        es_favorito,
        es_pendiente,
        calificacion,

        COUNT(*) OVER (
          PARTITION BY tipo
        ) AS total_tipo,

        ROW_NUMBER() OVER (
          PARTITION BY tipo
          ORDER BY fecha_interaccion DESC, id DESC
        ) AS posicion

      FROM interacciones

      WHERE id_echohead = $1
        AND fecha_interaccion >=
          CURRENT_TIMESTAMP - INTERVAL '30 days'
        AND fecha_interaccion <= CURRENT_TIMESTAMP
        AND tipo IN ('album', 'song')

        AND (
          es_escuchado
          OR es_favorito
          OR es_pendiente
          OR COALESCE(calificacion, 0) > 0
          OR NULLIF(BTRIM(descripcion), '') IS NOT NULL
        )
    )

    SELECT *
    FROM recientes
    WHERE posicion <= 3
    ORDER BY tipo, posicion
    `,
    [userId]
  );

  function agrupar(tipo) {
    const filas = resultado.rows.filter(
      item => item.tipo === tipo
    );

    return {
      total: Number(filas[0]?.total_tipo || 0),

      items: filas.map(item => ({
        spotify_id: item.spotify_id,
        nombre: item.nombre,
        artista: item.artista,
        imagen_url: item.imagen_url,
        tipo: item.tipo,
        es_escuchado: item.es_escuchado === true,
        es_favorito: item.es_favorito === true,
        es_pendiente: item.es_pendiente === true,
        calificacion: Number(item.calificacion) || 0,
      })),
    };
  }

  res.json({
    periodo: 'ultimos_30_dias',
    albumes: agrupar('album'),
    canciones: agrupar('song'),
  });
});
  app.get('/api/interacciones/:id_echohead', async (req, res) => {
    const userId = parse(id, req.params.id_echohead);
    const result = await pool.query(`SELECT spotify_id,nombre,artista,imagen_url,tipo,es_escuchado,es_favorito,
      es_pendiente,calificacion,descripcion FROM interacciones WHERE id_echohead=$1 ORDER BY id`, [userId]);
    res.json(result.rows.map(row => ({ ...row, calificacion: Number(row.calificacion) || 0, descripcion: row.descripcion || '' })));
  });
  app.get('/api/usuarios/buscar', async (req, res) => {
    const q = parse(schemas.search, req.query.q ?? '').trim();
    if (q.length < 2) return res.json([]);
    // %, _ y \ se buscan como texto, no como comodines SQL.
    const escaped = q.replace(/[\\%_]/g, '\\$&');
    const result = await pool.query(`SELECT id_echohead,nombre,foto_perfil,foto_personalizada_version FROM users
      WHERE nombre ILIKE $1 ESCAPE '\\' ORDER BY nombre,id_echohead LIMIT 10`, [`%${escaped}%`]);
    res.json(result.rows);
  });
  async function follow(req, res) {
    const b = parse(schemas.follow, req.body);
    const userId = own(req, b.seguidor_id);
    if (userId === b.seguido_id) throw new HttpError(400, 'No puedes seguirte a ti mismo.');
    if (req.method === 'POST') {
      await pool.query(`INSERT INTO seguidores(seguidor_id,seguido_id) VALUES($1,$2)
        ON CONFLICT(seguidor_id,seguido_id) DO NOTHING`, [userId, b.seguido_id]);
    } else {
      await pool.query('DELETE FROM seguidores WHERE seguidor_id=$1 AND seguido_id=$2', [userId, b.seguido_id]);
    }
    res.json({ mensaje: req.method === 'POST' ? 'Usuario seguido.' : 'Dejaste de seguir al usuario.' });
  }
  app.post('/api/seguidores', follow);
  app.delete('/api/seguidores', follow);
  app.get('/api/usuarios/:id_echohead/siguiendo', async (req, res) => {
    const userId = parse(id, req.params.id_echohead);
    const result = await pool.query('SELECT seguido_id FROM seguidores WHERE seguidor_id=$1 ORDER BY seguido_id', [userId]);
    res.json(result.rows.map(row => row.seguido_id));
  });
  for (const [path, join, where] of [
    ['lista-siguiendo', 'seguido_id', 'seguidor_id'],
    ['lista-seguidores', 'seguidor_id', 'seguido_id'],
  ]) {
    app.get(`/api/usuarios/:id_echohead/${path}`, async (req, res) => {
      const userId = parse(id, req.params.id_echohead);
      const result = await pool.query(`SELECT u.id_echohead,u.nombre,u.foto_perfil,u.foto_personalizada_version FROM seguidores s
        JOIN users u ON s.${join}::text=u.id_echohead::text WHERE s.${where}::text=$1::text ORDER BY u.nombre,u.id_echohead`, [userId]);
      res.json(result.rows);
    });
  }
  app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    let status = error instanceof HttpError ? error.status : 500;
    let message = error instanceof HttpError ? error.message : 'Error interno del servidor.';
    if (error.type === 'entity.too.large') { status = 413; message = 'El cuerpo de la solicitud es demasiado grande.'; }
    if (error.type === 'entity.parse.failed') { status = 400; message = 'JSON no válido.'; }
    if (error.type === 'encoding.unsupported') { status = 415; message = 'Codificación no admitida.'; }
    if (error.code === '23503') { status = 404; message = 'El recurso solicitado no existe.'; }
    if (error.code === '23505') { status = 409; message = 'Los datos entran en conflicto con un registro existente.'; }
    if (['57014','53300'].includes(error.code)) { status = 503; message = 'Servicio ocupado. Inténtalo más tarde.'; }
    if (status >= 500) logger.error({ event: 'request_failed', code: /^[A-Z0-9]{5}$/.test(error.code || '') ? error.code : 'INTERNAL' });
    // Sin cuerpos, cookies, tokens, SQL, datos personales ni errores de Axios en logs/respuestas.
    res.status(status).json({ error: message });
  });
  return app;
}
module.exports = { createApp };
