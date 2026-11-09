import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { API_BASE_URL as API, apiFetch } from '../lib/api';

import {
  FaCheckCircle,
  FaHeart,
  FaRegCheckCircle,
  FaRegHeart,
  FaRegStar,
  FaStar,
  FaStarHalfAlt,
} from 'react-icons/fa';

import {
  FiBookmark,
  FiEdit3,
  FiMoreHorizontal,
  FiX,
} from 'react-icons/fi';

import './TarjetaInteractiva.css';



const SIN_PORTADA = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><rect width="300" height="300" fill="#d6d6d6"/><circle cx="150" cy="150" r="65" fill="none" stroke="#858585" stroke-width="2"/><circle cx="150" cy="150" r="12" fill="#858585"/></svg>'
)}`;

function leerEstado(item) {
  return {
    es_favorito: item.es_favorito === true,
    es_escuchado: item.es_escuchado === true,
    es_pendiente: item.es_pendiente === true,
    calificacion: Math.max(
      0,
      Math.min(5, Number(item.calificacion) || 0)
    ),
    descripcion: item.descripcion || '',
  };
}

function Tarjeta({
  item,
  tipo,
  idSpotify,
  id_echohead,
  soloLectura = false,
  vista = 'normal',
  onCambio,
}) {
  const nombre =
    item.nombre ||
    item.albumName ||
    item.album_name ||
    item.songName ||
    item.song_name ||
    item.cancionName ||
    'Sin título';

  const artista =
    item.artista ||
    item.artistName ||
    item.artista_name ||
    '';

  const imagen =
    item.imagen_url ||
    item.albumImg ||
    item.albumImage ||
    item.album_img ||
    item.songImage ||
    item.song_img ||
    item.cancionImg ||
    SIN_PORTADA;

  const entrada = leerEstado(item);
  const firma = JSON.stringify(entrada);

  const [edicion, setEdicion] = useState(null);

  const estado =
    edicion?.base === firma ? edicion.valor : entrada;

  const [menuAbierto, setMenuAbierto] = useState(false);
  const [posicion, setPosicion] = useState({});
  const [hover, setHover] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [resenaAbierta, setResenaAbierta] = useState(false);
  const [borrador, setBorrador] = useState('');

  const bloqueo = useRef(false);
  const disparador = useRef(null);
  const menu = useRef(null);
  const dialogo = useRef(null);

  const tituloId = useId();

  const puedeEditar =
    !soloLectura && Boolean(id_echohead && idSpotify);

  const catalogo = vista === 'catalogo';

  function cerrarMenu(devolverFoco = false) {
    setMenuAbierto(false);

    if (devolverFoco) {
      disparador.current?.focus({ preventScroll: true });
    }
  }

  useEffect(() => {
    if (!menuAbierto) return;

    const fuera = event => {
      if (
        !menu.current?.contains(event.target) &&
        !disparador.current?.contains(event.target)
      ) {
        setMenuAbierto(false);
      }
    };

    const teclado = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenuAbierto(false);
        disparador.current?.focus({ preventScroll: true });
      }
    };

    const origen = disparador.current?.getBoundingClientRect();

    const mover = event => {
      if (event.target instanceof Node && menu.current?.contains(event.target)) return;

      const actual = disparador.current?.getBoundingClientRect();

      if (
        event.type === 'resize' ||
        !actual ||
        !origen ||
        Math.abs(actual.top - origen.top) > 1 ||
        Math.abs(actual.left - origen.left) > 1
      ) {
        setMenuAbierto(false);
      }
    };

    const frame = requestAnimationFrame(() => {
      menu.current
        ?.querySelector('button')
        ?.focus({ preventScroll: true });
    });

    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', teclado);
    window.addEventListener('resize', mover);
    window.addEventListener('scroll', mover, true);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', teclado);
      window.removeEventListener('resize', mover);
      window.removeEventListener('scroll', mover, true);
    };
  }, [menuAbierto]);

  useEffect(() => {
    if (!resenaAbierta) return;

    const element = dialogo.current;
    element.showModal();

    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      element.close();
      document.body.style.overflow = previo;
    };
  }, [resenaAbierta]);

  function abrirMenu(event) {
    event.stopPropagation();

    if (!puedeEditar) return;

    if (menuAbierto) {
      cerrarMenu(true);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const ancho = Math.min(280, window.innerWidth - 32);
    const espacio = window.innerHeight - rect.bottom - 24;

    if (window.innerWidth <= 600) {
      setPosicion({
        width: ancho,
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        maxHeight: 'calc(100dvh - 32px)',
      });
    } else {
      setPosicion({
        width: ancho,
        left: Math.max(
          16,
          Math.min(
            rect.right - ancho,
            window.innerWidth - ancho - 16
          )
        ),
        ...(espacio >= 360
          ? {
              top: rect.bottom + 8,
              maxHeight: espacio,
            }
          : {
              bottom: window.innerHeight - rect.top + 8,
              maxHeight: Math.max(150, rect.top - 24),
            }),
      });
    }

    setError('');
    setMensaje('');
    setHover(null);
    setMenuAbierto(true);
  }

  async function guardar(nuevo) {
    if (!puedeEditar || bloqueo.current) return false;

    bloqueo.current = true;
    setGuardando(true);
    setError('');
    setMensaje('');

    const controller = new AbortController();

    const timer = setTimeout(
      () => controller.abort(),
      15000
    );

    const datos = {
      id_echohead,
      spotify_id: idSpotify,
      tipo,
      nombre,
      artista: artista || 'Artista desconocido',
      imagen_url: imagen?.startsWith('https://') ? imagen : '',
      ...nuevo,
    };

    try {
      const response = await apiFetch(
        `${API}/usuarios/interacciones`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(datos),
          signal: controller.signal,
        }
      );

      if (!response.ok) throw new Error();

      setEdicion({
        base: firma,
        valor: nuevo,
      });

      setMensaje('Guardado');
      onCambio?.(datos);

      return true;
    } catch {
      setError('No se pudo guardar. Inténtalo de nuevo.');
      return false;
    } finally {
      clearTimeout(timer);
      bloqueo.current = false;
      setGuardando(false);
    }
  }

  function favorito() {
  const valor = !estado.es_favorito;

  guardar({
    ...estado,
    es_favorito: valor,
    ...(valor ? { es_escuchado: true } : {}),
  });
}

function escuchado() {
  // Completa una escucha pendiente, aunque ya se escuchara antes.
  if (estado.es_pendiente) {
    guardar({
      ...estado,
      es_escuchado: true,
      es_pendiente: false,
    });
    return;
  }

  const valor = !estado.es_escuchado;

  guardar({
    ...estado,
    es_escuchado: valor,
    ...(valor
      ? {}
      : {
          es_favorito: false,
          calificacion: 0,
        }),
  });
}

function pendiente() {
  // Solo cambia la lista de próximas escuchas.
  guardar({
    ...estado,
    es_pendiente: !estado.es_pendiente,
  });
}

function calificar(valor) {
  setHover(null);

  guardar({
    ...estado,
    calificacion: valor,
    ...(valor > 0 ? { es_escuchado: true } : {}),
  });
}

  function abrirResena() {
    setBorrador(estado.descripcion);
    setError('');
    setMensaje('');
    setMenuAbierto(false);
    setResenaAbierta(true);
  }

  const botonMenu = (
    <button
      ref={disparador}
      type="button"
      className="eh-card-more"
      aria-label={`Opciones de ${nombre}`}
      aria-haspopup="dialog"
      aria-expanded={menuAbierto}
      disabled={!puedeEditar || guardando}
      onClick={abrirMenu}
    >
      <FiMoreHorizontal />
    </button>
  );

  return (
    <div
      className={`eh-card ${
        catalogo ? 'eh-card--catalogo' : ''
      }`}
      onClick={event => {
        if (
          event.target.closest(
            'button, dialog, [role="dialog"]'
          )
        ) {
          event.stopPropagation();
        }
      }}
    >
      <div
        className={[
          'tarjeta-contenedor',
          tipo === 'song' ? 'forma-circulo' : 'forma-cuadrado',
          menuAbierto ? 'menu-abierto' : '',
        ].join(' ')}
      >
        <img
          src={imagen}
          alt={nombre}
          className="tarjeta-imagen"
          loading="lazy"
          onError={event => {
            event.currentTarget.onerror = null;

            if (event.currentTarget.src !== SIN_PORTADA) {
              event.currentTarget.src = SIN_PORTADA;
            }
          }}
        />

        {!catalogo && (
          <div className="tarjeta-overlay-botones">
            <button
  type="button"
  className="btn-interaccion"
  disabled={!puedeEditar || guardando}
  aria-label={
    estado.es_pendiente
      ? 'Marcar como escuchado y quitar de pendientes'
      : estado.es_escuchado
        ? 'Quitar de escuchados'
        : 'Marcar como escuchado'
  }
  aria-pressed={
    estado.es_pendiente ? undefined : estado.es_escuchado
  }
  onClick={escuchado}
>
  {estado.es_escuchado ? (
    <FaCheckCircle />
  ) : (
    <FaRegCheckCircle />
  )}
</button>

            <button
              type="button"
              className="btn-interaccion"
              disabled={!puedeEditar || guardando}
              aria-label={
                estado.es_favorito
                  ? 'Quitar de favoritos'
                  : 'Añadir a favoritos'
              }
              aria-pressed={estado.es_favorito}
              onClick={favorito}
            >
              {estado.es_favorito ? (
                <FaHeart />
              ) : (
                <FaRegHeart />
              )}
            </button>

            {!soloLectura && botonMenu}
          </div>
        )}
      </div>

      {catalogo && (
        <div className="eh-card-caption">
          <div>
            <h3>{nombre}</h3>
            {artista && <p>{artista}</p>}
          </div>

          {botonMenu}
        </div>
      )}

      {!menuAbierto && !resenaAbierta && error && (
        <p className="eh-card-feedback" role="alert">
          {error}
        </p>
      )}

      {menuAbierto &&
        createPortal(
          <div
            ref={menu}
            className="eh-card-menu"
            role="dialog"
            aria-labelledby={`${tituloId}-menu`}
            style={posicion}
            onBlurCapture={event => {
              if (
                event.relatedTarget &&
                !event.currentTarget.contains(
                  event.relatedTarget
                ) &&
                !disparador.current?.contains(
                  event.relatedTarget
                )
              ) {
                cerrarMenu();
              }
            }}
          >
            <div className="eh-card-menu-heading">
              <h3 id={`${tituloId}-menu`}>{nombre}</h3>

              <button
                type="button"
                className="eh-card-close"
                aria-label="Cerrar opciones"
                onClick={() => cerrarMenu(true)}
              >
                <FiX />
              </button>
            </div>

            <fieldset
              className="eh-card-rating"
              disabled={guardando}
            >
              <legend>
                Calificar
                <span>
                  {estado.calificacion
                    ? `${estado.calificacion} / 5`
                    : 'Sin calificar'}
                </span>
              </legend>

              <div
                className="eh-card-stars"
                onMouseLeave={() => setHover(null)}
              >
                {[1, 2, 3, 4, 5].map(numero => {
                  const valor =
                    hover ?? estado.calificacion;

                  const Icono =
                    valor >= numero
                      ? FaStar
                      : valor >= numero - 0.5
                        ? FaStarHalfAlt
                        : FaRegStar;

                  return (
                    <span
                      className="eh-card-star"
                      key={numero}
                    >
                      <Icono aria-hidden="true" />

                      {[numero - 0.5, numero].map(
                        (puntos, mitad) => (
                          <button
                            key={puntos}
                            type="button"
                            className={`eh-card-half eh-card-half--${mitad}`}
                            aria-label={`Calificar con ${puntos} estrellas`}
                            aria-pressed={
                              estado.calificacion === puntos
                            }
                            onMouseEnter={() =>
                              setHover(puntos)
                            }
                            onFocus={() => setHover(puntos)}
                            onBlur={() => setHover(null)}
                            onClick={() => calificar(puntos)}
                          />
                        )
                      )}
                    </span>
                  );
                })}
              </div>

              {estado.calificacion > 0 && (
                <button
                  className="eh-card-reset"
                  type="button"
                  onClick={() => calificar(0)}
                >
                  Quitar calificación
                </button>
              )}
            </fieldset>

            <button
  className="eh-card-action"
  type="button"
  disabled={!puedeEditar || guardando}
  aria-pressed={
    estado.es_pendiente ? undefined : estado.es_escuchado
  }
  onClick={escuchado}
>
  <FaRegCheckCircle />

  {estado.es_pendiente
    ? 'Marcar como escuchado y quitar de pendientes'
    : estado.es_escuchado
      ? 'Quitar de escuchados'
      : 'Marcar como escuchado'}
</button>

            <button
              className="eh-card-action"
              type="button"
              disabled={guardando}
              aria-pressed={estado.es_favorito}
              onClick={favorito}
            >
              <FaRegHeart />
              {estado.es_favorito
                ? 'Quitar de favoritos'
                : 'Añadir a favoritos'}
            </button>

            <button
              className="eh-card-action"
              type="button"
              disabled={guardando}
              aria-pressed={estado.es_pendiente}
              onClick={pendiente}
            >
              <FiBookmark />
              {estado.es_pendiente
                ? 'Quitar de pendientes'
                : 'Guardar en pendientes'}
            </button>

            <button
              className="eh-card-action"
              type="button"
              disabled={guardando}
              onClick={abrirResena}
            >
              <FiEdit3 />
              {estado.descripcion
                ? 'Editar reseña'
                : 'Escribir reseña'}
            </button>

            <p className="eh-card-status" role="status">
              {guardando
                ? 'Guardando…'
                : error || mensaje}
            </p>
          </div>,
          document.body
        )}

      {resenaAbierta &&
        createPortal(
          <dialog
            ref={dialogo}
            className="eh-review-dialog"
            aria-labelledby={`${tituloId}-review`}
            onCancel={event => {
              if (guardando) event.preventDefault();
            }}
            onClose={() => {
              setResenaAbierta(false);
              disparador.current?.focus({
                preventScroll: true,
              });
            }}
          >
            <form
              onSubmit={async event => {
                event.preventDefault();

                const descripcion = borrador.trim();

                const ok = await guardar({
                  ...estado,
                  descripcion,
                  ...(descripcion
  ? {
      es_escuchado: true,
    }
  : {}),
                });

                if (ok) dialogo.current?.close();
              }}
            >
              <div className="eh-review-heading">
                <div>
                  <span>TU RESEÑA</span>
                  <h2 id={`${tituloId}-review`}>
                    {nombre}
                  </h2>
                  {artista && <p>{artista}</p>}
                </div>

                <button
                  type="button"
                  className="eh-card-close"
                  disabled={guardando}
                  aria-label="Cerrar reseña"
                  onClick={() => dialogo.current.close()}
                >
                  <FiX />
                </button>
              </div>

              <label htmlFor={`${tituloId}-text`}>
                {tipo === 'song'
                  ? '¿Qué te dejó esta canción?'
                  : '¿Qué te dejó este disco?'}
              </label>

              <textarea
                id={`${tituloId}-text`}
                maxLength={5000}
                value={borrador}
                onChange={event =>
                  setBorrador(event.target.value)
                }
                placeholder="Escribe tu reseña…"
                disabled={guardando}
                autoFocus
              />

              <p className="eh-card-status" role="status">
                {guardando ? 'Guardando…' : error}
              </p>

              <div className="eh-review-buttons">
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => dialogo.current.close()}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={guardando}
                >
                  {guardando
                    ? 'Guardando…'
                    : 'Guardar reseña'}
                </button>
              </div>
            </form>
          </dialog>,
          document.body
        )}
    </div>
  );
}

export default function TarjetaInteractiva(props) {
  const item = props.item || {};

  const idSpotify =
    item.album_spotify_id ||
    item.song_spotify_id ||
    item.spotify_id ||
    item.id ||
    '';

  return (
    <Tarjeta
      key={`${props.id_echohead}-${props.tipo}-${idSpotify}`}
      {...props}
      item={item}
      idSpotify={idSpotify}
    />
  );
}