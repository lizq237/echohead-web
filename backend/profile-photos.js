'use strict';

const sharp = require('sharp');
const { HttpError } = require('./validation');

const MAX_ORIGINAL = 2 * 1024 * 1024;
const MAX_RESULTADO = 256 * 1024;
const MAX_PIXELES = 16_000_000;

let procesando = 0;

function formatoPermitido(buffer) {
  const jpg =
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  const png = buffer.subarray(0, 8).equals(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  );

  const webp =
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP';

  return jpg || png || webp;
}

async function procesarFotoPerfil(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    throw new HttpError(400, 'Selecciona una imagen válida.');
  }

  if (buffer.length > MAX_ORIGINAL) {
    throw new HttpError(413, 'La foto debe pesar como máximo 2 MB.');
  }

  if (!formatoPermitido(buffer)) {
    throw new HttpError(415, 'Usa una imagen JPG, PNG o WebP.');
  }

  if (procesando >= 2) {
    throw new HttpError(
      503,
      'Estamos procesando otras fotos. Inténtalo en unos segundos.'
    );
  }

  procesando += 1;

  try {
    const opciones = {
      limitInputPixels: MAX_PIXELES,
      failOn: 'warning',
      animated: false,
    };

    const datos = await sharp(buffer, opciones).metadata();

    if (
      !['jpeg', 'png', 'webp'].includes(datos.format) ||
      !datos.width ||
      !datos.height ||
      datos.width * datos.height > MAX_PIXELES ||
      (datos.pages || 1) > 1
    ) {
      throw new HttpError(
        400,
        'Usa una imagen estática de hasta 16 megapíxeles.'
      );
    }

    const foto = await sharp(buffer, opciones)
      .rotate()
      .resize(512, 512, {
        fit: 'cover',
        position: 'centre',
      })
      .webp({ quality: 80 })
      .timeout({ seconds: 5 })
      .toBuffer();

    if (foto.length > MAX_RESULTADO) {
      throw new HttpError(
        413,
        'No pudimos reducir suficientemente la foto. Elige otra.'
      );
    }

    return foto;
  } catch (error) {
    if (error instanceof HttpError) throw error;

    throw new HttpError(
      400,
      'No pudimos procesar esa imagen. Prueba con otra foto.'
    );
  } finally {
    procesando -= 1;
  }
}

module.exports = { procesarFotoPerfil };