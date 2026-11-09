import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL, apiFetch } from '../lib/api';
import './ArtistPortrait.css';

const cache = new Map();
let cola = Promise.resolve();

function cargarFoto(id) {
  const guardado = cache.get(id);

  if (guardado && guardado.vence > Date.now()) {
    return guardado.promesa;
  }

  const promesa = cola
    .then(async () => {
      const response = await apiFetch(
        `${API_BASE_URL}/catalog/artists/${encodeURIComponent(id)}/photo`,
        { signal: AbortSignal.timeout(30000) }
      );

      if (!response.ok) {
        throw new Error('No pudimos consultar la foto.');
      }

      return response.json();
    })
    .catch(() => ({
      photo: null,
      status: 'temporary-error',
    }));

  cola = promesa.then(() => {});

  if (cache.size >= 200) {
    cache.delete(cache.keys().next().value);
  }

  cache.set(id, {
    promesa,
    vence: Date.now() + 60_000,
  });

  return promesa;
}

export default function ArtistPortrait({
  id,
  name,
  src = '',
  selectable = false,
  selected = false,
  disabled = false,
  onSelect,
}) {
  const contenedor = useRef(null);
  const [resultado, setResultado] = useState(null);
  const [imagenFallida, setImagenFallida] = useState('');

  const mbid =
    typeof id === 'string' && id.startsWith('mb:artist:')
      ? id.slice(10)
      : null;

  useEffect(() => {
    if (!mbid) return;

    let activo = true;
    let iniciado = false;

    const observer = new IntersectionObserver(
      entries => {
        if (
          iniciado ||
          !entries.some(entry => entry.isIntersecting)
        ) {
          return;
        }

        iniciado = true;
        observer.disconnect();

        cargarFoto(mbid).then(datos => {
          if (activo) {
            setResultado({ id: mbid, datos });
          }
        });
      },
      { rootMargin: '80px' }
    );

    if (contenedor.current) {
      observer.observe(contenedor.current);
    }

    return () => {
      activo = false;
      observer.disconnect();
    };
  }, [mbid]);

  const datos =
    resultado?.id === mbid ? resultado.datos : null;

  const foto = mbid ? datos?.photo : null;
  const url = mbid ? foto?.image || '' : src;
  const mostrarImagen = Boolean(url && imagenFallida !== url);

  const iniciales = (name || 'Artista')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(palabra => Array.from(palabra)[0])
    .join('')
    .toUpperCase();

  let estado = '';

  if (selected) {
    estado = 'Agregado';
  } else if (mbid && !datos) {
    estado = 'Buscando fotografía…';
  } else if (datos?.status === 'temporary-error') {
    estado = 'Fotografía no disponible temporalmente';
  } else if (!mostrarImagen) {
    estado = 'Sin fotografía disponible';
  }

  const retrato = mostrarImagen ? (
    <img
      src={url}
      alt={name || 'Artista'}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setImagenFallida(url)}
    />
  ) : (
    <span
      className="eh-artist-initials"
      role="img"
      aria-label={`${name || 'Artista'}: sin fotografía`}
    >
      {iniciales}
    </span>
  );

  return (
    <div
      ref={contenedor}
      className={
        `eh-artist-photo${selectable ? ' eh-artist-photo--result' : ''}`
      }
    >
      {selectable ? (
        <button
          type="button"
          className="ep-search-item"
          disabled={disabled}
          onClick={onSelect}
        >
          <span className="eh-artist-frame">{retrato}</span>

          <span>
            <strong>{name}</strong>
            <small>{estado}</small>
          </span>

          <span className="ep-search-action" aria-hidden="true">
            {selected ? '✓' : '+'}
          </span>
        </button>
      ) : (
        <span className="eh-artist-frame">{retrato}</span>
      )}

      {foto && mostrarImagen && (
        <details className="eh-artist-credit">
          <summary
  aria-label={`Ver créditos de la fotografía de ${name}`}
  title="Créditos de fotografía"
>
  <span aria-hidden="true">ⓘ</span>
</summary>

          <p>{foto.title} · {foto.author}</p>

          {foto.credit && <p>{foto.credit}</p>}

          <a href={foto.source} target="_blank" rel="noreferrer">
            Archivo en Wikimedia Commons
          </a>

          {' · '}

          <a href={foto.licenseUrl} target="_blank" rel="noreferrer">
            {foto.license}
          </a>

          <p>
  {selectable
    ? 'Imagen redimensionada, sin recorte adicional.'
    : 'Imagen ajustada a un marco cuadrado.'}
</p>
        </details>
      )}
    </div>
  );
}