'use strict';

const axios = require('axios');
const { HttpError } = require('./validation');

const UUID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

const http = axios.create({
  timeout: 7000,
  maxRedirects: 0,
  maxContentLength: 1024 * 1024,
});

function safeUrl(value, host, path) {
  try {
    const url = new URL(value);

    const valid =
      url.protocol === 'https:' &&
      url.hostname === host &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.search &&
      !url.hash &&
      path.test(url.pathname);

    return valid ? url.href : null;
  } catch {
    return null;
  }
}

// Convierte los créditos recibidos a texto.
// En el frontend los mostraremos como texto, nunca como HTML.
function plain(value) {
  if (typeof value !== 'string' || value.length > 12000) {
    return '';
  }

  const entities = {
    amp: '&',
    quot: '"',
    apos: "'",
    lt: '<',
    gt: '>',
    nbsp: ' ',
  };

  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, number) => {
      const code = number[0].toLowerCase() === 'x'
        ? parseInt(number.slice(1), 16)
        : Number(number);

      return code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : '';
    })
    .replace(
      /&(amp|quot|apos|lt|gt|nbsp);/g,
      (_, name) => entities[name]
    )
    .replace(/\s+/g, ' ')
    .trim();
}
function safeImageUrl(value) {
  try {
    const url = new URL(value);

    if (
      !['upload.wikimedia.org', 'thumb.wikimedia.org']
        .includes(url.hostname)
    ) {
      return null;
    }

    // Conservamos la ruta de la imagen y quitamos el seguimiento.
    url.search = '';
    url.hash = '';

    return safeUrl(
      url.href,
      url.hostname,
      /^\/wikipedia\/commons\//
    );
  } catch {
    return null;
  }
}


function photoFromInfo(info, title) {
  const metadata = info?.extmetadata || {};
  const rawLicense = metadata.LicenseUrl?.value;

  const licenseUrl = safeUrl(
    typeof rawLicense === 'string'
      ? rawLicense.replace(/^http:/, 'https:')
      : '',
    'creativecommons.org',
    /^\/(?:licenses\/by(?:-sa)?\/(?:2\.0|2\.5|3\.0|4\.0)|publicdomain\/zero\/1\.0)\/?$/
  );

  const image = safeImageUrl(info?.thumburl);

  const source = safeUrl(
    info?.descriptionurl,
    'commons.wikimedia.org',
    /^\/wiki\/File:/
  );

  const author = plain(metadata.Artist?.value);
  const license = plain(metadata.LicenseShortName?.value);
  const credit = plain(
    metadata.Attribution?.value || metadata.Credit?.value
  );

  if (
    !image ||
    !source ||
    !licenseUrl ||
    !author ||
    !license ||
    plain(metadata.Restrictions?.value)
  ) {
    return null;
  }

  return {
    image,
    source,
    author,
    credit,
    license,
    licenseUrl,
    title: plain(title),
    notice: 'Imagen redimensionada, sin recorte.',
  };
}

async function buscarFotoArtista(id, contacto) {
  if (typeof id !== 'string' || !UUID.test(id)) {
    throw new HttpError(400, 'Identificador de artista no válido.');
  }

  if (
    typeof contacto !== 'string' ||
    !contacto.trim() ||
    contacto.length > 300 ||
    /[\r\n]/.test(contacto)
  ) {
    throw new HttpError(
      503,
      'Revisa MUSICBRAINZ_CONTACT en la configuración del backend.'
    );
  }

  const headers = {
    'User-Agent': `EchoHead/2.1 (${contacto.trim()})`,
    Accept: 'application/json',
  };

  // El identificador se valida antes de incorporarlo a la consulta.
  const query = `
    PREFIX wdt: <http://www.wikidata.org/prop/direct/>

    SELECT DISTINCT ?image WHERE {
      ?artist wdt:P434 "${id}";
              wdt:P18 ?image.
    }
    LIMIT 2
  `;

  const respuesta = await http.get(
    'https://query.wikidata.org/sparql',
    {
      params: { query, format: 'json' },
      headers,
    }
  );

  const resultados = respuesta.data?.results?.bindings;

  if (!Array.isArray(resultados)) {
    throw new HttpError(502, 'La fuente de fotografías no respondió correctamente.');
  }
  const titulos = [];

  for (const resultado of resultados.slice(0, 2)) {
    let titulo;

    try {
      const url = new URL(resultado.image?.value);
      const prefijo = '/wiki/Special:FilePath/';

      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.hostname !== 'commons.wikimedia.org' ||
        url.username ||
        url.password ||
        url.port ||
        url.search ||
        url.hash ||
        !url.pathname.startsWith(prefijo)
      ) {
        continue;
      }

      titulo = decodeURIComponent(url.pathname.slice(prefijo.length));

      if (
        !titulo ||
        titulo.length > 240 ||
        /[|\u0000-\u001f\u007f]/.test(titulo)
      ) {
        continue;
      }
    } catch {
      continue;
    }
    titulos.push(`File:${titulo}`);
  }

  if (titulos.length === 0) return [];

  const metadata = await http.get(
    'https://commons.wikimedia.org/w/api.php',
    {
      headers,
      params: {
        action: 'query',
        format: 'json',
        formatversion: 2,
        prop: 'imageinfo',
        titles: titulos.join('|'),
        iiprop: 'url|extmetadata',
        iiurlwidth: 500,
      },
    }
  );

  const paginas = metadata.data?.query?.pages;

  if (!Array.isArray(paginas)) {
    throw new HttpError(502, 'No pudimos consultar los créditos de las fotos.');
  }

  const fotos = [];

  for (const pagina of paginas) {
    const titulo = (pagina.title || '').replace(/^File:/, '');
    const foto = photoFromInfo(pagina.imageinfo?.[0], titulo);

    if (foto && !fotos.some(guardada => guardada.image === foto.image)) {
      fotos.push(foto);
    }
  }

  return fotos;
}

function artistPhotos({ config }) {
  const cache = new Map();
  const pendientes = new Map();

  let cola = Promise.resolve();
  let ultimaConsulta = 0;
  let bloqueadoHasta = 0;

  async function resolver(id) {
    if (typeof id !== 'string' || !UUID.test(id)) {
      throw new HttpError(400, 'Identificador de artista no válido.');
    }

    const guardado = cache.get(id);

    if (guardado && guardado.vence > Date.now()) {
      return guardado.valor;
    }

    if (pendientes.has(id)) {
      return pendientes.get(id);
    }

    if (Date.now() < bloqueadoHasta) {
      throw new HttpError(
        503,
        'La fuente de fotografías está ocupada. Inténtalo más tarde.'
      );
    }

    if (pendientes.size >= 8) {
      throw new HttpError(
        503,
        'Hay varias fotografías en espera. Inténtalo en unos segundos.'
      );
    }

    const trabajo = cola.then(async () => {
      if (Date.now() < bloqueadoHasta) {
        throw new HttpError(
          503,
          'La fuente de fotografías está ocupada. Inténtalo más tarde.'
        );
      }

      const espera = Math.max(
        0,
        1100 - (Date.now() - ultimaConsulta)
      );

      if (espera > 0) {
        await new Promise(resolve => setTimeout(resolve, espera));
      }

      ultimaConsulta = Date.now();

      let valor;
      let duracion;

      try {
        const fotos = await buscarFotoArtista(id, config.musicbrainzContact);
const foto = fotos[0] || null;

valor = {
  photo: foto,
  alternativas: fotos.slice(1),
  status: foto ? 'available' : 'unavailable',
};

duracion = foto ? 24 * 60 * 60_000 : 60 * 60_000;
      } catch (error) {
        if ([429, 503].includes(error.response?.status)) {
          bloqueadoHasta = Date.now() + 60_000;
        }

        // Un fallo temporal no significa que el artista no tenga foto.
        valor = {
          photo: null,
          status: 'temporary-error',
        };

        duracion = 60_000;
      }

      cache.delete(id);

      if (cache.size >= 500) {
        cache.delete(cache.keys().next().value);
      }

      cache.set(id, {
        valor,
        vence: Date.now() + duracion,
      });

      return valor;
    });

    pendientes.set(id, trabajo);
    cola = trabajo.catch(() => {});

    try {
      return await trabajo;
    } finally {
      pendientes.delete(id);
    }
  }

  return {
    resolver,
    handler: async (req, res) => {
      res.json(await resolver(req.params.id));
    },
  };
}

module.exports = {
  photoFromInfo,
  buscarFotoArtista,
  artistPhotos,
};