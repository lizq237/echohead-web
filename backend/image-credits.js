'use strict';

const { createHash, randomUUID } = require('node:crypto');
const { z } = require('zod');
const { transaction } = require('./auth');
const { HttpError, parse } = require('./validation');

const texto = max =>
  z.string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value),
      'El texto contiene caracteres no permitidos.'
    );

const fuentesPermitidas = new Set([
  'commons.wikimedia.org',
  'creativecommons.org',
  'musicbrainz.org',
  'coverartarchive.org',
  'open.spotify.com',
  'www.flickr.com',
  'flickr.com',
]);

const urlFuente = z.string().max(2048).refine(value => {
  try {
    const url = new URL(value);

    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      fuentesPermitidas.has(url.hostname)
    );
  } catch {
    return false;
  }
}, 'La dirección de la fuente no está permitida.');

const entradaSchema = z.object({
  nombre: texto(200),
  textos: z.array(texto(12000)).min(1).max(6),
  enlaces: z.array(
    z.object({
      etiqueta: texto(150),
      url: urlFuente,
    }).strict()
  ).min(1).max(4),
}).strict();

const cuerpoSchema = z.object({
  items: z.array(entradaSchema).min(1).max(15),
}).strict();

const identificadorSchema = z.string().uuid();

function imageCredits({ pool }) {
  async function crear(req, res) {
    const { items } = parse(cuerpoSchema, req.body);

    // Guardamos únicamente datos de atribución.
    // No se incluyen el correo, la contraseña ni el perfil.
    const contenido = JSON.stringify(items);

    if (Buffer.byteLength(contenido, 'utf8') > 24000) {
      throw new HttpError(
        413,
        'Los créditos contienen demasiado texto.'
      );
    }

    const huella = createHash('sha256')
      .update(contenido)
      .digest('hex');

    const resultado = await transaction(pool, async client => {
      // Evita crear varias copias de los mismos créditos.
      const existente = await client.query(
        `SELECT id
         FROM echohead_image_credits
         WHERE content_hash = $1`,
        [huella]
      );

      if (existente.rows[0]) {
        return {
          id: existente.rows[0].id,
          creado: false,
        };
      }

      // Serializa las creaciones de una misma cuenta para
      // que las solicitudes simultáneas respeten el límite.
      await client.query(
        'SELECT pg_advisory_xact_lock($1::integer, $2::integer)',
        [731024, req.user.id_echohead]
      );

      const cantidad = await client.query(
        `SELECT COUNT(*)::integer AS total
         FROM echohead_image_credits
         WHERE created_by = $1
           AND created_at >= NOW() - INTERVAL '24 hours'`,
        [req.user.id_echohead]
      );

      if (cantidad.rows[0].total >= 50) {
        throw new HttpError(
          429,
          'Llegaste al límite diario de nuevas páginas de créditos.'
        );
      }

      const nuevoId = randomUUID();

      const insertado = await client.query(
        `INSERT INTO echohead_image_credits
           (id, content_hash, items, created_by)
         VALUES ($1, $2, $3::jsonb, $4)
         ON CONFLICT (content_hash) DO NOTHING
         RETURNING id`,
        [
          nuevoId,
          huella,
          contenido,
          req.user.id_echohead,
        ]
      );

      if (insertado.rows[0]) {
        return {
          id: insertado.rows[0].id,
          creado: true,
        };
      }

      // Otra solicitud pudo guardar el mismo contenido
      // mientras se procesaba esta.
      const compartido = await client.query(
        `SELECT id
         FROM echohead_image_credits
         WHERE content_hash = $1`,
        [huella]
      );

      if (!compartido.rows[0]) {
        throw new HttpError(
          503,
          'No pudimos guardar los créditos. Inténtalo de nuevo.'
        );
      }

      return {
        id: compartido.rows[0].id,
        creado: false,
      };
    });

    res.set('Cache-Control', 'no-store');

    return res.status(resultado.creado ? 201 : 200).json({
      id: resultado.id,
      ruta: `/creditos/${resultado.id}`,
    });
  }

  async function consultar(req, res) {
    const identificador = parse(
      identificadorSchema,
      req.params.id
    );

    const resultado = await pool.query(
      `SELECT id, items
       FROM echohead_image_credits
       WHERE id = $1`,
      [identificador]
    );

    if (!resultado.rows[0]) {
      throw new HttpError(
        404,
        'No encontramos esta página de créditos.'
      );
    }

    res.set('Cache-Control', 'no-store');

    return res.json(resultado.rows[0]);
  }

  return { crear, consultar };
}

module.exports = { imageCredits };