import { API_BASE_URL } from './api';

export function obtenerFotoPerfil(usuario) {
  if (!usuario) return '';

  const id = usuario.id_echohead;
  const version = usuario.foto_personalizada_version;

  if (id && version) {
    return (
      `${API_BASE_URL}/usuarios/${encodeURIComponent(id)}/foto` +
      `?v=${encodeURIComponent(version)}`
    );
  }

  return usuario.foto_perfil || '';
}