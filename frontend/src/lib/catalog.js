import { API_BASE_URL, apiFetch } from './api';

// Una interfaz de catálogo para las pantallas existentes; conserva IDs de cada proveedor.
export async function searchCatalog({ query, type, token = '', signal, offset = 0 }) {
  let url;
  if (token) {
    const params = new URLSearchParams({
  q: query,
  type,
  market: 'MX',
  limit: '10',
  offset: String(offset),
});
    url = `https://api.spotify.com/v1/search?${params}`;
  } else {
    const params = new URLSearchParams({ q: query, type: type === 'track' ? 'song' : type, offset: String(offset) });
    url = `${API_BASE_URL}/catalog/search?${params}`;
  }
  const response = await apiFetch(url, { signal, ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
  if (token && response.status === 401) {
    window.dispatchEvent(
      new Event('echohead-spotify-expired')
    );
  }

  throw new Error(
    token
      ? `No pudimos buscar en Spotify (HTTP ${response.status}). Revisa la conexión en Cuenta.`
      : data.error || 'No pudimos buscar. Inténtalo otra vez.'
  );
}
  if (token) return { ...data, hasMore: Boolean(data[`${type}s`]?.next) && offset < 200 };
  const items = (data.items || []).map(item => ({
    id: item.id, name: item.name, artists: [{ name: item.artista }],
    images: item.image ? [{ url: item.image }] : [],
    album: { images: item.image ? [{ url: item.image }] : [] },
    external_urls: { musicbrainz: item.url }, source: 'musicbrainz',
  }));
  return { [`${type}s`]: { items }, hasMore: data.hasMore };
}
