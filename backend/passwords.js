'use strict';
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { HttpError } = require('./validation');
const scrypt = promisify(crypto.scrypt);
// OWASP: scrypt N=2^17, r=8, p=1. Un hash a la vez limita el consumo de RAM.
let busy = false;
async function derive(password, salt) {
  if (busy) throw new HttpError(503, 'Estamos procesando otro acceso. Inténtalo en unos segundos.');
  busy = true;
  try { return await scrypt(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 }); }
  finally { busy = false; }
}
async function passwordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt-v1$${salt}$${(await derive(password, salt)).toString('hex')}`;
}
async function verifyPassword(password, stored) {
  // Usuarios inexistentes recorren el mismo algoritmo, sin hash rápido alternativo.
  const parts = (stored || `scrypt-v1$${'0'.repeat(32)}$${'0'.repeat(128)}`).split('$');
  if (parts[0] !== 'scrypt-v1' || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{128}$/.test(parts[2])) return false;
  const value = await derive(password, parts[1]);
  return crypto.timingSafeEqual(value, Buffer.from(parts[2], 'hex')) && Boolean(stored);
}
module.exports = { passwordHash, verifyPassword };
