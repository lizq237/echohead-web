import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { apiFetch } from '../lib/api';

import {
  IoChevronDownSharp,
  IoPauseSharp,
  IoPlaySharp,
  IoPlaySkipBackSharp,
  IoPlaySkipForwardSharp,
} from 'react-icons/io5';

import './Reproductor.css';
import ReproductorEstetico from './ReproductorEstetico';

const API = 'https://api.spotify.com/v1';

const SIN_PORTADA = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#2d2d2d"/><circle cx="100" cy="100" r="82" fill="none" stroke="#575757" stroke-width="2"/><circle cx="100" cy="100" r="65" fill="none" stroke="#575757" stroke-width="2"/><circle cx="100" cy="100" r="28" fill="#1db954"/><circle cx="100" cy="100" r="6" fill="#2d2d2d"/></svg>'
)}`;

function tiempo(ms) {
  const segundos = Math.floor(
    Math.max(0, ms || 0) / 1000
  );

  return `${Math.floor(segundos / 60)}:${
    String(segundos % 60).padStart(2, '0')
  }`;
}

function portadaAlternativa(event) {
  if (event.currentTarget.src !== SIN_PORTADA) {
    event.currentTarget.src = SIN_PORTADA;
  }
}

export default function Reproductor({
  tokenSpotify,
  username,
}) {
  const [cancionActual, setCancionActual] = useState(null);
  const [estaReproduciendo, setEstaReproduciendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [duracion, setDuracion] = useState(0);
  const [barraVisible, setBarraVisible] = useState(true);
  const [mostrarEstetico, setMostrarEstetico] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [altoBarra, setAltoBarra] = useState(112);

  const barra = useRef(null);
  const abrir = useRef(null);
  const minimizar = useRef(null);

  const lectura = useRef(null);
  const comando = useRef(null);
  const refresco = useRef(null);
  const bloqueo = useRef(false);
  const esperarHasta = useRef(0);

  const id = useId();
  const hayReproduccion = Boolean(
  tokenSpotify && cancionActual
);

  const obtenerEstado = useCallback(async () => {
    if (
      !tokenSpotify ||
      bloqueo.current ||
      Date.now() < esperarHasta.current
    ) {
      return;
    }

    lectura.current?.abort();

    const controller = new AbortController();
    lectura.current = controller;

    try {
      const response = await apiFetch(
        `${API}/me/player/currently-playing`,
        {
          headers: {
            Authorization: `Bearer ${tokenSpotify}`,
          },
          signal: controller.signal,
        }
      );

      if (controller.signal.aborted) return;

      if (response.status === 401) {
  esperarHasta.current = Infinity;

  setCancionActual(null);
  setEstaReproduciendo(false);
  setProgreso(0);
  setDuracion(0);

  window.dispatchEvent(
    new Event('echohead-spotify-expired')
  );

  throw new Error(
    'La conexión con Spotify venció. Reconéctalo desde Cuenta.'
  );
}

      if (response.status === 429) {
        const segundos =
          Number(response.headers.get('Retry-After')) || 30;

        esperarHasta.current =
          Date.now() + Math.max(5, segundos) * 1000;

        throw new Error(
          'Spotify está ocupado. Volveremos a sincronizar en un momento.'
        );
      }

      if (!response.ok) {
        throw new Error(
          'No pudimos sincronizar con Spotify.'
        );
      }

      const data =
        response.status === 204
          ? null
          : await response.json();

      if (controller.signal.aborted) return;

      if (!data?.item) {
        setCancionActual(null);
        setEstaReproduciendo(false);
        setProgreso(0);
        setDuracion(0);
        setError('');
        return;
      }

      const item = data.item;

      const duracionMs = Math.max(
        0,
        Number(item.duration_ms) || 0
      );

      setCancionActual({
        id: item.id || item.uri || item.name,
        nombre: item.name || 'Sin título',

        artista:
          item.artists
            ?.map(artista => artista.name)
            .join(', ') ||
          item.show?.name ||
          'Spotify',

        imagen:
          item.album?.images?.[0]?.url ||
          item.images?.[0]?.url ||
          SIN_PORTADA,
      });

      setEstaReproduciendo(data.is_playing === true);
      setDuracion(duracionMs);

      setProgreso(
        Math.min(
          duracionMs,
          Math.max(0, Number(data.progress_ms) || 0)
        )
      );

      setError('');
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(
          err.message || 'No pudimos conectar con Spotify.'
        );
      }
    }
  }, [tokenSpotify]);

  useEffect(() => {
  esperarHasta.current = 0;

  setCancionActual(null);
  setEstaReproduciendo(false);
  setProgreso(0);
  setDuracion(0);
  setError('');
  setMostrarEstetico(false);

  if (!tokenSpotify) return;

  obtenerEstado();

  const intervalo = window.setInterval(
    obtenerEstado,
    5000
  );

  return () => {
    window.clearInterval(intervalo);
    window.clearTimeout(refresco.current);

    lectura.current?.abort();
    comando.current?.abort();
  };
}, [tokenSpotify, obtenerEstado]);

  useEffect(() => {
    if (!estaReproduciendo || !duracion) return;

    const intervalo = setInterval(() => {
      setProgreso(prev =>
        Math.min(prev + 1000, duracion)
      );
    }, 1000);

    return () => clearInterval(intervalo);
  }, [estaReproduciendo, duracion]);

  useEffect(() => {
  if (!tokenSpotify) return;

  const mostrar = () => setMostrarEstetico(true);

  window.addEventListener('abrir-tocadiscos', mostrar);

  return () => {
    window.removeEventListener('abrir-tocadiscos', mostrar);
  };
}, [tokenSpotify]);

  // Reserva el espacio real de la barra para no tapar
  // el contenido al llegar al final de la página.
  useEffect(() => {
    if (!barra.current) return;

    const observer = new ResizeObserver(([entry]) => {
      setAltoBarra(
        Math.ceil(
          entry.target.getBoundingClientRect().height
        )
      );
    });

    observer.observe(barra.current);

    return () => observer.disconnect();
  }, [hayReproduccion]);

  async function enviar(endpoint, method, nuevoEstado) {
    if (
      !tokenSpotify ||
      !cancionActual ||
      bloqueo.current
    ) {
      return;
    }

    bloqueo.current = true;
    lectura.current?.abort();
    clearTimeout(refresco.current);

    const controller = new AbortController();
    comando.current = controller;

    setGuardando(true);
    setError('');

    try {
      const response = await apiFetch(
        `${API}/me/player/${endpoint}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${tokenSpotify}`,
          },
          signal: controller.signal,
        }
      );

      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error();

      if (typeof nuevoEstado === 'boolean') {
        setEstaReproduciendo(nuevoEstado);
      }

      refresco.current = setTimeout(
        obtenerEstado,
        500
      );
    } catch {
      if (!controller.signal.aborted) {
        setError(
          'No se pudo completar la acción. Comprueba la reproducción en Spotify e inténtalo de nuevo.'
        );
      }
    } finally {
      bloqueo.current = false;
      setGuardando(false);
    }
  }

  function alternarReproduccion() {
    enviar(
      estaReproduciendo ? 'pause' : 'play',
      'PUT',
      !estaReproduciendo
    );
  }

  function cambiarCancion(direccion) {
    enviar(
      direccion === 'siguiente' ? 'next' : 'previous',
      'POST'
    );
  }

  function cambiarVista(visible) {
    setBarraVisible(visible);

    requestAnimationFrame(() => {
      const destino = visible
        ? minimizar.current
        : abrir.current;

      destino?.focus({ preventScroll: true });
    });
  }

  if (!tokenSpotify) return null;

  const nombre =
    cancionActual?.nombre || 'Sin reproducción activa';

  const artista =
    cancionActual?.artista || 'Abre Spotify para escuchar';

  const imagen =
    cancionActual?.imagen || SIN_PORTADA;

  const deshabilitado =
    !cancionActual || guardando;

  const porcentaje = duracion
    ? Math.min(100, (progreso / duracion) * 100)
    : 0;

  const IconoReproduccion = estaReproduciendo
    ? IoPauseSharp
    : IoPlaySharp;

  return (
  <>
    {hayReproduccion && (
      <>
        <div
          className="ehp-space"
        aria-hidden="true"
        style={{
          height: barraVisible ? altoBarra + 48 : 116,
        }}
      />

      {/* Disco minimizado */}
      <div
        className={`ehp-mini ${
          barraVisible ? 'ehp-hidden' : ''
        }`}
        inert={barraVisible || mostrarEstetico}
        aria-hidden={barraVisible || mostrarEstetico}
      >
        <div
          className="ehp-tooltip"
          id={`${id}-descripcion`}
        >
          <strong>{nombre}</strong>
          <span>{artista}</span>

          {error && (
            <span className="ehp-mini-error">
              {error}
            </span>
          )}
        </div>

        <button
          ref={abrir}
          type="button"
          className="ehp-disc-button"
          onClick={() => cambiarVista(true)}
          aria-label={`Mostrar reproductor: ${nombre}`}
          aria-describedby={`${id}-descripcion`}
          aria-controls={`${id}-barra`}
          aria-expanded={false}
        >
          <span
            key={cancionActual?.id || 'sin-cancion'}
            className="ehp-disc"
            style={{
              animationPlayState: estaReproduciendo
                ? 'running'
                : 'paused',
            }}
          >
            <img
              src={imagen}
              alt=""
              draggable="false"
              onError={portadaAlternativa}
            />

            <span className="ehp-disc-hole" />
          </span>
        </button>

        <button
          type="button"
          className="ehp-mini-play"
          onClick={alternarReproduccion}
          disabled={deshabilitado}
          aria-label={
            estaReproduciendo ? 'Pausar' : 'Reproducir'
          }
          aria-busy={guardando}
        >
          <IconoReproduccion aria-hidden="true" />
        </button>

        {error && (
          <span
            className="ehp-error-dot"
            aria-label="Error de reproducción"
          >
            !
          </span>
        )}
      </div>

      {/* Barra expandida */}
      <section
        ref={barra}
        id={`${id}-barra`}
        aria-label="Reproductor de música"
        className={`ehp-bar ${
          !barraVisible ? 'ehp-hidden' : ''
        }`}
        inert={!barraVisible || mostrarEstetico}
        aria-hidden={!barraVisible || mostrarEstetico}
      >
        <div className="ehp-info">
          <img
            src={imagen}
            alt=""
            className="ehp-cover"
            onError={portadaAlternativa}
          />

          <div className="ehp-text">
            <span
              className="ehp-name"
              title={nombre}
            >
              {nombre}
            </span>

            <span
              className="ehp-artist"
              title={artista}
            >
              {artista}
            </span>
          </div>
        </div>

        <div className="ehp-center">
          <div className="ehp-controls">
            <button
              type="button"
              className="ehp-control"
              aria-label="Canción anterior"
              disabled={deshabilitado}
              onClick={() => cambiarCancion('anterior')}
            >
              <IoPlaySkipBackSharp />
            </button>

            <button
              type="button"
              className="ehp-control ehp-play"
              aria-label={
                estaReproduciendo
                  ? 'Pausar'
                  : 'Reproducir'
              }
              disabled={deshabilitado}
              aria-busy={guardando}
              onClick={alternarReproduccion}
            >
              <IconoReproduccion />
            </button>

            <button
              type="button"
              className="ehp-control"
              aria-label="Canción siguiente"
              disabled={deshabilitado}
              onClick={() => cambiarCancion('siguiente')}
            >
              <IoPlaySkipForwardSharp />
            </button>
          </div>

          <div className="ehp-progress-row">
            <span className="ehp-time">
              {tiempo(progreso)}
            </span>

            <div
              className="ehp-progress"
              role="progressbar"
              aria-label="Progreso de la canción"
              aria-valuemin={0}
              aria-valuemax={duracion || 1}
              aria-valuenow={progreso}
              aria-valuetext={`${
                tiempo(progreso)
              } de ${tiempo(duracion)}`}
            >
              <div
                className="ehp-progress-fill"
                style={{ width: `${porcentaje}%` }}
              />
            </div>

            <span className="ehp-time">
              {tiempo(duracion)}
            </span>
          </div>
        </div>

        <button
          ref={minimizar}
          type="button"
          className="ehp-control ehp-minimize"
          onClick={() => cambiarVista(false)}
          aria-label="Minimizar reproductor"
          aria-controls={`${id}-barra`}
          aria-expanded={true}
        >
          <IoChevronDownSharp />
        </button>

        {error && (
          <p className="ehp-error" role="status">
            {error}
          </p>
        )}
            </section>
      </>
    )}

    {/* Conservamos el tocadiscos del navbar */}
      {mostrarEstetico && (
        <ReproductorEstetico
          cerrarModal={() => setMostrarEstetico(false)}
          username={username}
          cancion={
            cancionActual?.nombre || 'Sin reproducir'
          }
          artista={
            cancionActual?.artista || 'Desconocido'
          }
          imagenAlbum={cancionActual?.imagen || ''}
          estaReproduciendo={estaReproduciendo}
          pausarReproducir={alternarReproduccion}
          siguienteCancion={() =>
            cambiarCancion('siguiente')
          }
          cancionAnterior={() =>
            cambiarCancion('anterior')
          }
        />
      )}
    </>
  );
}