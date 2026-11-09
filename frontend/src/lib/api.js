// Las credenciales de EchoHead se envían únicamente a su propio backend.
// En desarrollo, /backend usa el proxy de Vite; en producción, el proxy del servidor web.
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || '/backend'
).replace(/\/$/, '');

const backend = new URL(API_BASE_URL, window.location.origin);
let csrfToken = '';
let expiresAt = 0;
let expiryTimer;

export function clearSession() {
  csrfToken = '';
  expiresAt = 0;
  window.clearTimeout(expiryTimer);
}

export function establishSession({ csrf_token, expires_in }) {
  clearSession();
  csrfToken = csrf_token;
  expiresAt = Date.now() + expires_in * 1000;
  expiryTimer = window.setTimeout(() => {
    clearSession();
    window.dispatchEvent(new Event('echohead-session-expired'));
  }, expires_in * 1000);
}

export function hasSession() {
  return Boolean(csrfToken) && Date.now() < expiresAt;
}

export async function apiFetch(input, options = {}) {
  const url = new URL(input, window.location.origin);
  const isBackend = url.origin === backend.origin &&
    (url.pathname === backend.pathname || url.pathname.startsWith(`${backend.pathname.replace(/\/$/, '')}/`));
  const headers = new Headers(options.headers);
  headers.delete('X-CSRF-Token');
  if (!isBackend) {
    // Estas llamadas son a Spotify; nunca se les envía la cookie o el CSRF de EchoHead.
    return fetch(url, { ...options, headers, credentials: 'omit', referrerPolicy: 'no-referrer' });
  }
  headers.delete('Authorization');
  const method = (options.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) headers.set('X-CSRF-Token', csrfToken);
  const response = await fetch(url, { ...options, headers, credentials: 'include', referrerPolicy: 'no-referrer' });
  if (response.status === 401 && csrfToken) {
    clearSession();
    window.dispatchEvent(new Event('echohead-session-expired'));
  }
  return response;
}

export async function logout() {
  const response = await apiFetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  if (!response.ok && response.status !== 401) throw new Error('No se pudo cerrar la sesión. Inténtalo de nuevo.');
  clearSession();
  window.location.replace('/');
}
