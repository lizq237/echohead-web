import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL, apiFetch } from '../lib/api';

function leerBase64(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();

    lector.onload = () => {
      resolve(String(lector.result).split(',')[1]);
    };

    lector.onerror = () => {
      reject(new Error('No pudimos leer la imagen.'));
    };

    lector.onabort = () => {
      reject(new Error('La lectura de la imagen se canceló.'));
    };

    lector.readAsDataURL(archivo);
  });
}

export default function FotoPerfilControl({
  usuario,
  onActualizada,
  disabled = false,
}) {
  const input = useRef(null);
  const enCurso = useRef(false);
  const activo = useRef(true);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    activo.current = true;

    return () => {
      activo.current = false;
    };
  }, []);

  async function actualizar(archivo = null) {
    if (enCurso.current || disabled) return;

    enCurso.current = true;
    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      let body = {};

      if (archivo) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) {
          throw new Error('Selecciona una imagen JPG, PNG o WebP.');
        }

        if (archivo.size > 2 * 1024 * 1024) {
          throw new Error('La foto debe pesar como máximo 2 MB.');
        }

        body = { imagen: await leerBase64(archivo) };
      }

      if (!activo.current) return;

      const response = await apiFetch(
        `${API_BASE_URL}/usuarios/foto`,
        {
          method: archivo ? 'PUT' : 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );

      const datos = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(datos.error || 'No pudimos actualizar la foto.');
      }

      if (!activo.current) return;

      onActualizada({
        ...usuario,
        ...datos,
      });

      setMensaje(
        archivo ? 'Foto actualizada.' : 'Foto personalizada eliminada.'
      );
    } catch (err) {
      if (activo.current) {
        setError(err.message || 'No pudimos actualizar la foto.');
      }
    } finally {
      enCurso.current = false;

      if (activo.current) {
        setGuardando(false);
      }
    }
  }

  return (
    <div className="ep-photo-control" aria-busy={guardando}>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Seleccionar foto de perfil"
        hidden
        disabled={disabled || guardando}
        onChange={event => {
          const archivo = event.target.files?.[0];
          event.target.value = '';

          if (archivo) actualizar(archivo);
        }}
      />

      <div className="ep-photo-control__actions">
        <button
          type="button"
          disabled={disabled || guardando}
          onClick={() => input.current?.click()}
        >
          {guardando ? 'Guardando…' : 'Cambiar foto'}
        </button>

        {usuario.foto_personalizada_version && (
          <button
            type="button"
            disabled={disabled || guardando}
            onClick={() => actualizar()}
          >
            Quitar foto
          </button>
        )}
      </div>

      <p className="ep-photo-control__hint">
        JPG, PNG o WebP · Máximo 2 MB. La foto se guarda al seleccionarla.
      </p>

      {error && <p role="alert">{error}</p>}
      <p role="status">{mensaje}</p>
    </div>
  );
}