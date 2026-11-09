'use strict';

function configuration(env = process.env) {
  function required(name) {
    const value = env[name]?.trim();
    if (!value || value === '....') throw new Error(`Configura ${name}`);
    return value;
  }
  const frontend = new URL(required('FRONTEND_ORIGIN'));
  const redirect = new URL(env.REDIRECT_URI?.trim() || '/callback', frontend);
  const production = env.NODE_ENV === 'production';
  const secureCookies = env.COOKIE_SECURE !== 'false';
  const sameSite = env.COOKIE_SAMESITE || 'lax';
  const loopback = host => ['localhost', '127.0.0.1', '[::1]'].includes(host);
  if (!['http:', 'https:'].includes(frontend.protocol) || frontend.username || frontend.password || frontend.pathname !== '/' || frontend.search || frontend.hash) {
    throw new Error('FRONTEND_ORIGIN debe contener solo protocolo y dominio');
  }
  if (redirect.origin !== frontend.origin || redirect.search || redirect.hash || redirect.username || redirect.password) {
    throw new Error('REDIRECT_URI debe ser una ruta fija del frontend, sin parámetros');
  }
  if (frontend.protocol !== 'https:' && (production || !loopback(frontend.hostname))) throw new Error('El frontend público requiere HTTPS');
  if (!secureCookies && (production || !loopback(frontend.hostname))) throw new Error('Solo se permiten cookies sin Secure en desarrollo local');
  if (!['lax', 'strict', 'none'].includes(sameSite) || (sameSite === 'none' && !secureCookies)) throw new Error('COOKIE_SAMESITE no válido');
  const port = Number(env.PORT || 8888);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT no válido');
  // Nunca confiar indiscriminadamente en X-Forwarded-For.
  const trustProxy = env.TRUST_PROXY ? env.TRUST_PROXY.split(',').map(x => x.trim()) : false;
  if (trustProxy && trustProxy.some(x => ['true', '*', '0.0.0.0/0', '::/0', ''].includes(x) || /^\d+$/.test(x))) throw new Error('TRUST_PROXY requiere IPs o subredes de proxies conocidos');
  return {
    frontendOrigin: frontend.origin, redirectUri: redirect.href,
    clientId: env.SPOTIFY_CLIENT_ID?.trim() || '', clientSecret: env.SPOTIFY_CLIENT_SECRET?.trim() || '',
    musicbrainzContact: env.MUSICBRAINZ_CONTACT?.trim() || '',
    lastfmApiKey: env.LASTFM_API_KEY?.trim() || '',
    lastfmSharedSecret: env.LASTFM_SHARED_SECRET?.trim() || '',
    lastfmCallbackUrl: new URL('/backend/auth/lastfm/callback', frontend.origin).href,
    production, secureCookies, sameSite, trustProxy, port,
  };
}
module.exports = { configuration };
