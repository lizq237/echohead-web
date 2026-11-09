'use strict';

const {
  randomBytes,
  createCipheriv,
  createDecipheriv,
} = require('node:crypto');

function obtenerClave() {
  const valor = process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY?.trim() || '';

  if (!/^[a-f0-9]{64}$/i.test(valor)) {
    throw new Error('Revisa SPOTIFY_TOKEN_ENCRYPTION_KEY en backend/.env.');
  }

  return Buffer.from(valor, 'hex');
}

function cifrarToken(token) {
  const iv = randomBytes(12);
  const cifrador = createCipheriv('aes-256-gcm', obtenerClave(), iv);

  const contenido = Buffer.concat([
    cifrador.update(token, 'utf8'),
    cifrador.final(),
  ]);

  return [
    iv.toString('base64url'),
    cifrador.getAuthTag().toString('base64url'),
    contenido.toString('base64url'),
  ].join('.');
}

function descifrarToken(valor) {
  const partes = valor.split('.');

  if (partes.length !== 3) {
    throw new Error('El token guardado tiene un formato inválido.');
  }

  const [iv, etiqueta, contenido] = partes.map(
    parte => Buffer.from(parte, 'base64url')
  );

  const descifrador = createDecipheriv('aes-256-gcm', obtenerClave(), iv, {
    authTagLength: 16,
  });

  descifrador.setAuthTag(etiqueta);

  return Buffer.concat([
    descifrador.update(contenido),
    descifrador.final(),
  ]).toString('utf8');
}

module.exports = { cifrarToken, descifrarToken };