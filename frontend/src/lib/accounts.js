import { apiFetch, API_BASE_URL } from './api';

export async function accountRequest(path, body) {
  const response = await apiFetch(`${API_BASE_URL}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No pudimos completar la solicitud.');
  return data;
}
