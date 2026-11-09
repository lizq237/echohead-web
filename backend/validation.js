'use strict';
const { z } = require('zod');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const id = z.union([z.number().int(), z.string().regex(/^[1-9]\d{0,9}$/)])
  .transform(Number).pipe(z.number().int().min(1).max(2147483647));
const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
// Campo heredado: conserva Spotify IDs y acepta IDs con proveedor explícito.
const spotifyId = z.string().regex(new RegExp(`^(?:[A-Za-z0-9]{22}|mb:(?:rg|rec|artist):${uuid})$`));
const text = max => z.string().max(max).refine(s => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s));
const imageUrl = z.string().max(2048).refine(value => {
  if (value === '') return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (['scdn.co', 'spotifycdn.com'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)) ||
       (url.hostname === 'coverartarchive.org' && !url.search && !url.hash && new RegExp(`^/(?:release-group|release)/${uuid}/front-500$`).test(url.pathname)));
  } catch { return false; }
}, 'La imagen debe usar una fuente de catálogo permitida con HTTPS');
const image = imageUrl.default('');
const owner = { id_echohead: id.optional() };
const schemas = {
  description: z.object({ ...owner, nuevaDescripcion: text(255) }).strict(),
  interaction: z.object({
    ...owner, spotify_id: spotifyId, tipo: z.enum(['song', 'album']),
    nombre: text(255).min(1), artista: text(255).min(1), imagen_url: image,
    es_escuchado: z.boolean(), es_favorito: z.boolean(), es_pendiente: z.boolean(),
    calificacion: z.number().min(0).max(5).multipleOf(0.5).nullable(),
    descripcion: text(5000).nullable(),
  }).strict().refine(b => !b.spotify_id.startsWith('mb:') || b.spotify_id.startsWith(b.tipo === 'album' ? 'mb:rg:' : 'mb:rec:')),
  follow: z.object({ seguidor_id: id.optional(), seguido_id: id }).strict(),
  exchange: z.object({ code: z.string().min(1).max(4096), state: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict(),
  search: text(80),
};
const favorites = {
  artistas: { table: 'top_artistas', prefix: 'artist', name: 'artistName', image: 'artistImg' },
  albumes: { table: 'top_albumes', prefix: 'album', name: 'albumName', image: 'albumImg' },
  canciones: { table: 'top_canciones', prefix: 'song', name: 'cancionName', image: 'cancionImg' },
};
for (const [key, config] of Object.entries(favorites)) {
  schemas[key] = z.object({ ...owner, [key]: z.array(z.object({
    id: spotifyId.refine(value => !value.startsWith('mb:') || value.startsWith(key === 'artistas' ? 'mb:artist:' : key === 'albumes' ? 'mb:rg:' : 'mb:rec:')), [config.name]: text(255).min(1), [config.image]: image,
  }).strict()).max(5).refine(items => new Set(items.map(x => x.id)).size === items.length) }).strict();
}
function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, 'Datos no válidos. Revisa los campos y sus límites.');
  return result.data;
}
function own(req, claimedId) {
  if (claimedId !== undefined && claimedId !== req.user.id_echohead) throw new HttpError(403, 'No puedes modificar otro perfil.');
  return req.user.id_echohead;
}
module.exports = { HttpError, id, schemas, favorites, parse, own };
