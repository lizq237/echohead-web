import html2canvas from 'html2canvas';
import { useEffect, useRef, useState } from 'react';
import {
  FiEdit3,
  FiPlus,
  FiSearch,
  FiShare,
  FiX,
} from 'react-icons/fi';
import { useParams } from 'react-router-dom';
import ArtistPortrait from '../components/ArtistPortrait';
import FotoPerfilControl from '../components/FotoPerfilControl';
import { API_BASE_URL as API, apiFetch } from '../lib/api';
import { searchCatalog } from '../lib/catalog';

import ListaAlbumesPerfil from '../components/ListaAlbumesPerfil';
import ListaAmigosPerfil from '../components/ListaAmigosPerfil';
import ListaCancionesPerfil from '../components/ListaCancionesPerfil';
import ListaFavoritosPerfil from '../components/ListaFavoritosPerfil';
import ListaPendientesPerfil from '../components/ListaPendientesPerfil';
import ListaReseñasPerfil from '../components/ListaReseñasPerfil';
import Navbar from '../components/Navbar';
import { API_BASE_URL } from '../lib/api';
import { obtenerFotoPerfil } from '../lib/profilePhoto';
import './Perfil.css';



const VACIA = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><rect width="300" height="300" fill="#d6d6d6"/><circle cx="150" cy="150" r="65" fill="none" stroke="#858585" stroke-width="2"/><circle cx="150" cy="150" r="12" fill="#858585"/></svg>'
)}`;

const CATEGORIAS = [
  {
    clave: 'artistas',
    titulo: 'Artistas favoritos',
    singular: 'artista',
    tipo: 'artist',
  },
  {
    clave: 'albumes',
    titulo: 'Álbumes favoritos',
    singular: 'álbum',
    tipo: 'album',
  },
  {
    clave: 'canciones',
    titulo: 'Canciones favoritas',
    singular: 'canción',
    tipo: 'track',
  },
];

const PESTANAS = [
  ['inicio', 'Inicio'],
  ['albumes', 'Álbumes'],
  ['canciones', 'Canciones'],
  ['favoritos', 'Favoritos'],
  ['reseñas', 'Reseñas'],
  ['pendientes', 'Pendientes'],
  ['amigos', 'Amigos'],
];

const nombreItem = item =>
  item.artistName ||
  item.albumName ||
  item.cancionName ||
  item.nombre ||
  item.name ||
  'Sin título';

const imagenItem = item =>
  item.artistImg ||
  item.albumImg ||
  item.cancionImg ||
  item.imagen_url ||
  VACIA;

async function pedir(url, options = {}) {
  const response = await apiFetch(url, options);

  if (!response.ok) {
    const error = new Error(
      'No se pudo completar la solicitud.'
    );

    error.status = response.status;
    throw error;
  }

  return response.json();
}

function lista(data) {
  if (!Array.isArray(data)) {
    throw new Error('Respuesta inesperada.');
  }

  return data;
}

function normalizar(item, clave) {
  if (clave === 'artistas') {
    return {
      ...item,
      id: item.artist_spotify_id || item.id,
      artistName: item.artistName || item.artist_name,
      artistImg: item.artistImg || item.artist_img || '',
    };
  }

  if (clave === 'albumes') {
    return {
      ...item,
      id: item.album_spotify_id || item.id,
      albumName: item.albumName || item.album_name,
      albumImg: item.albumImg || item.album_img || '',
    };
  }

  return {
    ...item,
    id: item.song_spotify_id || item.id,
    cancionName:
      item.cancionName ||
      item.songName ||
      item.song_name,
    cancionImg:
      item.cancionImg ||
      item.songImage ||
      item.song_img ||
      '',
  };
}

function Foto({ src, alt = '', ...props }) {
  const direccion = typeof src === 'string' ? src.trim() : '';

  return (
    <FotoConReintentos
      key={direccion}
      src={direccion}
      alt={alt}
      {...props}
    />
  );
}

function FotoConReintentos({ src, alt, ...props }) {
  const [intento, setIntento] = useState(0);
  const [fallo, setFallo] = useState(false);
  const temporizador = useRef(null);

  useEffect(() => {
    return () => {
      window.clearTimeout(temporizador.current);
      temporizador.current = null;
    };
  }, []);

  function manejarError() {
    setFallo(true);

    if (
      intento >= 2 ||
      temporizador.current !== null
    ) {
      return;
    }

    const espera = intento === 0 ? 2000 : 5000;

    temporizador.current = window.setTimeout(() => {
      temporizador.current = null;
      setIntento(actual => actual + 1);
      setFallo(false);
    }, espera);
  }

  const usarRespaldo = !src || fallo;

  return (
    <img
      {...props}
      key={`${intento}-${usarRespaldo}`}
      src={usarRespaldo ? VACIA : src}
      alt={alt}
      onError={usarRespaldo ? undefined : manejarError}
    />
  );
}

/* Buscador para agregar favoritos al perfil. */

function SelectorFavorito({
  categoria,
  elegidos,
  tokenSpotify,
  onElegir,
  onCerrar,
}) {
  const dialogo = useRef(null);

  const [texto, setTexto] = useState('');
  const [consulta, setConsulta] = useState('');
  const [intento, setIntento] = useState(0);

  const [resultado, setResultado] = useState({
    estado: 'vacio',
    items: [],
    error: '',
  });

  useEffect(() => {
    const element = dialogo.current;
    const foco = document.activeElement;
    const overflow = document.body.style.overflow;

    element.showModal();
    document.body.style.overflow = 'hidden';

    return () => {
      element.close();
      document.body.style.overflow = overflow;

      if (foco?.isConnected) {
        foco.focus({ preventScroll: true });
      }
    };
  }, []);

  useEffect(() => {
    if (!consulta) return;

    const controller = new AbortController();

    async function cargar() {
      try {
        const data = await searchCatalog({ query: consulta, type: categoria.tipo, token: tokenSpotify, signal: controller.signal });

        const items = lista(
          data[`${categoria.tipo}s`]?.items
        ).filter(item => item?.id);

        if (!controller.signal.aborted) {
          setResultado({
            estado: 'listo',
            items,
            error: '',
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setResultado({
            estado: 'error',
            items: [],
            error:
              error.status === 401
                ? 'Tu conexión con Spotify expiró. Vuelve a conectar tu cuenta.'
                : 'No pudimos buscar. Inténtalo de nuevo.',
          });
        }
      }
    }

    cargar();

    return () => controller.abort();
  }, [consulta, categoria.tipo, tokenSpotify, intento]);

  function buscar(event) {
    event.preventDefault();

    const valor = texto.trim();

    setConsulta(valor);
    setResultado({
      estado: valor ? 'cargando' : 'vacio',
      items: [],
      error: '',
    });
    setIntento(value => value + 1);
  }

  return (
    <dialog
      ref={dialogo}
      className="ep-selector"
      aria-labelledby="ep-selector-title"
      onCancel={onCerrar}
    >
      <div className="ep-selector-heading">
        <h2 id="ep-selector-title">
          Agregar {categoria.singular}
        </h2>

        <button
          type="button"
          className="ep-icon"
          aria-label="Cerrar búsqueda"
          onClick={onCerrar}
        >
          <FiX />
        </button>
      </div>

      <form className="ep-search" onSubmit={buscar}>
        <FiSearch aria-hidden="true" />

        <input
          autoFocus
          aria-label={`Buscar ${categoria.singular}`}
          placeholder={`Busca ${
            categoria.singular === 'canción' ? 'una' : 'un'
          } ${categoria.singular}`}
          value={texto}
          onChange={event => setTexto(event.target.value)}
        />

        <button
          type="submit"
          className="ep-button ep-button--green"
          disabled={texto.trim().length < 2}
        >
          Buscar
        </button>
      </form>

      {!tokenSpotify && <p className="eh-catalog-attribution">Catálogo: MusicBrainz · Portadas: Cover Art Archive</p>}
      {(
        <div
          className="ep-search-results"
          aria-busy={resultado.estado === 'cargando'}
        >
          {resultado.estado === 'vacio' && (
            <p>Elige hasta cinco favoritos para tu perfil.</p>
          )}

          {resultado.estado === 'cargando' && (
            <p role="status">Buscando…</p>
          )}

          {resultado.error && (
            <p role="alert">{resultado.error}</p>
          )}

          {resultado.estado === 'listo' &&
            !resultado.items.length && (
              <p>No encontramos resultados.</p>
            )}

          {resultado.items.map(item => {
            const existe = elegidos.some(
              actual =>
                String(actual.id) === String(item.id)
            );

            const imagen = (
              categoria.tipo === 'track'
                ? item.album?.images
                : item.images
            )?.[0]?.url;

            if (categoria.tipo === 'artist') {
  return (
    <ArtistPortrait
      key={item.id}
      id={item.id}
      name={item.name}
      src={imagen || ''}
      selectable
      selected={existe}
      disabled={existe || elegidos.length >= 5}
      onSelect={() => onElegir(item)}
    />
  );
}

            return (
              <button
                type="button"
                className="ep-search-item"
                key={item.id}
                disabled={existe || elegidos.length >= 5}
                onClick={() => onElegir(item)}
              >
                <Foto src={imagen} />

                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.artists
                      ?.map(artista => artista.name)
                      .join(', ')}
                  </small>
                </span>

                <span className="ep-search-action">
                  {existe ? 'Agregado' : <FiPlus />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </dialog>
  );
}

/* Resumen de Spotify: únicamente en el perfil propio. */

function ResumenMes({
  tokenSpotify,
  nombre,
  exportando,
  onExportar,
  children,
  onAbrirCreditos,
}) {
  const captura = useRef(null);
  const [intento, setIntento] = useState(0);

  const [datos, setDatos] = useState({
    estado: 'cargando',
    artistas: [],
    albumes: [],
    canciones: [],
  });

  useEffect(() => {

    const controller = new AbortController();

    async function cargar() {
      try {
                if (!tokenSpotify) {
          const resumen = await pedir(`${API}/lastfm/resumen-mensual`, {
            signal: controller.signal,
          });

          if (controller.signal.aborted) return;

          setDatos({
            estado: resumen.conectado ? 'listo' : 'sin-conexion',
            artistas: lista(resumen.artistas),
            albumes: lista(resumen.albumes),
            canciones: lista(resumen.canciones),
          });

          return;
        }
        const options = {
          headers: {
            Authorization: `Bearer ${tokenSpotify}`,
          },
          signal: controller.signal,
        };

        const [tracks, artists] = await Promise.all([
          pedir(
            'https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=50',
            options
          ),
          pedir(
            'https://api.spotify.com/v1/me/top/artists?time_range=short_term&limit=3',
            options
          ),
        ]);

        const canciones = lista(tracks.items);
        const artistas = lista(artists.items);
        const agrupados = new Map();

        canciones.forEach(track => {
          const album = track.album;

          if (
            !album?.id ||
            album.album_type?.toLowerCase() !== 'album'
          ) {
            return;
          }

          const actual = agrupados.get(album.id) || {
            ...album,
            puntos: 0,
          };

          actual.puntos += 1;
          agrupados.set(album.id, actual);
        });

        const albumes = [...agrupados.values()]
          .sort((a, b) => b.puntos - a.puntos)
          .slice(0, 3);

        if (!controller.signal.aborted) {
          setDatos({
            estado: 'listo',
            artistas,
            albumes,
            canciones: canciones.slice(0, 3),
          });
        }
      } catch {
        if (!controller.signal.aborted) {
          setDatos({
            estado: 'error',
            artistas: [],
            albumes: [],
            canciones: [],
          });
        }
      }
    }

    cargar();

    return () => controller.abort();
  }, [tokenSpotify, intento]);

    if (datos.estado === 'sin-conexion') return children;

  const hayDatos =
    datos.artistas.length +
      datos.albumes.length +
      datos.canciones.length >
    0;

  return (
    <section className="ep-month" ref={captura}>
      <p className="ep-export-brand">
        {nombre} · EchoHead
      </p>

      <div className="ep-section-head">
        <div>
          <h2>
            Tu mes en bucle <span className="ep-dot" />
          </h2>

          <p className="ep-month-period">
            {tokenSpotify
  ? 'Tus últimas cuatro semanas en Spotify, aproximadamente.'
  : 'Tu último mes en Last.fm.'}
          </p>
        </div>

        <button
          type="button"
          className="ep-button ep-button--light"
          data-html2canvas-ignore="true"
          disabled={exportando || !hayDatos}
          onClick={() =>
            onExportar(
              captura,
              'Mi_Mes_EchoHead.png',
              '#2d2d2d'
            )
          }
        >
          <FiShare /> Compartir mi mes
        </button>
      </div>

            {datos.estado === 'cargando' ? (
        <p role="status">Preparando tu resumen…</p>
      ) : datos.estado === 'error' ? (
        <div role="alert">
          <p>No pudimos cargar tu resumen de {tokenSpotify ? 'Spotify' : 'Last.fm'}.</p>

          <button
            className="ep-button ep-button--light"
            type="button"
            onClick={() => {
              setDatos(prev => ({
                ...prev,
                estado: 'cargando',
              }));
              setIntento(value => value + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      ) : (
        <>
          <div className="ep-month-grid">
            {CATEGORIAS.map(categoria => (
              <div key={categoria.clave}>
                <h3>
                  {categoria.clave === 'albumes'
                    ? 'Álbumes'
                    : categoria.clave === 'canciones'
                      ? 'Canciones'
                      : 'Artistas'}
                </h3>

                <div className="ep-month-list">
                  {datos[categoria.clave].length ? (
                    datos[categoria.clave].map(item => (
                      <div
                        className="ep-month-item"
                        key={item.id}
                      >
                        {!tokenSpotify && categoria.tipo === 'artist' ? (
  <ArtistPortrait
    id={
      /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(item.id)
        ? `mb:artist:${item.id}`
        : undefined
    }
    name={item.name}
  />
) : (
  <Foto
    className={`ep-shape-${categoria.tipo}`}
    src={
      (categoria.tipo === 'track'
        ? item.album?.images
        : item.images
      )?.[0]?.url
    }
  />
)}

                        <span>{item.name}</span>
                      </div>
                    ))
                  ) : (
                    <p className="ep-month-empty">
                      Todavía no hay datos suficientes.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="ep-month-note">
  {tokenSpotify
    ? 'Álbumes estimados a partir de tus canciones destacadas en Spotify.'
    : hayDatos
      ? 'Según las escuchas registradas en tu cuenta de Last.fm.'
      : 'Todavía no aparecen escuchas en Last.fm para este período.'}
</p>
{!tokenSpotify && datos.artistas.length > 0 && (
  <div className="ep-credits-access" data-html2canvas-ignore="true">
    <button
      type="button"
      className="ep-credits-link"
      disabled={exportando}
      onClick={() => onAbrirCreditos(captura.current)}
    >
      Créditos de imágenes
    </button>
  </div>
)}
        </>
      )}
    </section>
  );
}

/* Contenido del perfil. Se reinicia al cambiar de usuario. */
function ResumenMesEchoHead({
  nombre,
  exportando,
  onExportar,
}) {
  const captura = useRef(null);

  const [intento, setIntento] = useState(0);
  const [estado, setEstado] = useState('cargando');
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let vigente = true;

    const timeout = window.setTimeout(() => {
      controller.abort();
    }, 15000);

    async function cargar() {
      setEstado('cargando');
      setDatos(null);

      try {
        const respuesta = await pedir(
          `${API}/api/mi-mes`,
          { signal: controller.signal }
        );

        for (const clave of ['albumes', 'canciones']) {
          lista(respuesta?.[clave]?.items);

          if (
            !Number.isInteger(respuesta[clave].total) ||
            respuesta[clave].total < 0
          ) {
            throw new Error('Respuesta inesperada.');
          }
        }

        if (vigente) {
          setDatos(respuesta);
          setEstado('listo');
        }
      } catch {
        if (vigente) {
          setEstado('error');
        }
      } finally {
        window.clearTimeout(timeout);
      }
    }

    cargar();

    return () => {
      vigente = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [intento]);

  const hayDatos = Boolean(
    datos &&
    datos.albumes.total + datos.canciones.total > 0
  );

  const grupos = [
    ['albumes', 'Álbumes', 'album'],
    ['canciones', 'Canciones', 'track'],
  ];

  return (
    <section
      className="ep-month ep-month--echohead"
      ref={captura}
    >
      <p className="ep-export-brand">
        {nombre} · EchoHead
      </p>

      <div className="ep-section-head">
        <div>
          <h2>
            Mi mes en EchoHead <span className="ep-dot" />
          </h2>

          <p className="ep-month-period">
            Álbumes y canciones guardados o actualizados
            en los últimos 30 días.
          </p>
        </div>

        <button
          type="button"
          className="ep-button ep-button--light"
          data-html2canvas-ignore="true"
          disabled={
            exportando ||
            estado !== 'listo' ||
            !hayDatos
          }
          onClick={() =>
            onExportar(
              captura,
              'Mi_Mes_en_EchoHead.png',
              '#2d2d2d'
            )
          }
        >
          <FiShare /> Compartir mi mes
        </button>
      </div>

      {estado === 'cargando' ? (
        <p role="status">
          Preparando tu actividad…
        </p>
      ) : estado === 'error' ? (
        <div role="alert">
          <p>
            No pudimos cargar tu actividad de EchoHead.
          </p>

          <button
            type="button"
            className="ep-button ep-button--light"
            onClick={() => {
              setIntento(value => value + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      ) : !hayDatos ? (
        <p className="ep-month-empty">
          No hay actividad con fecha registrada en los
          últimos 30 días. Al guardar una calificación,
          un favorito o un pendiente, aparecerá aquí.
        </p>
      ) : (
        <>
          <div className="ep-month-grid">
            {grupos.map(([clave, titulo, forma]) => (
              <div key={clave}>
                <h3>
                  {titulo} · {datos[clave].total}
                </h3>

                <div className="ep-month-list">
                  {datos[clave].items.length ? (
                    datos[clave].items.map(item => (
                      <div
                        className="ep-month-item"
                        key={`${item.tipo}-${item.spotify_id}`}
                      >
                        <Foto
                          className={`ep-shape-${forma}`}
                          src={item.imagen_url}
                        />

                        <div className="ep-activity-meta">
                          <strong>{item.nombre}</strong>
                          <span>{item.artista}</span>

                          <div className="ep-activity-tags">
                            {item.es_escuchado && (
                              <span>Escuchado</span>
                            )}

                            {item.es_favorito && (
                              <span>Favorito</span>
                            )}

                            {item.es_pendiente && (
                              <span>Pendiente</span>
                            )}

                            {item.calificacion > 0 && (
                              <span
                                aria-label={
                                  `Calificación actual: ${item.calificacion}`
                                }
                              >
                                {item.calificacion} ★
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="ep-month-empty">
                      Sin actividad en esta categoría.
                    </p>
                  )}
                </div>

                {datos[clave].total > 3 && (
                  <p className="ep-month-empty">
                    Mostrando los 3 actualizados más
                    recientemente.
                  </p>
                )}
              </div>
            ))}
          </div>

          <p className="ep-month-note">
            Cada álbum o canción se cuenta una vez según
            su última actualización. Las etiquetas y
            calificaciones muestran su estado actual.
            No es un historial de reproducciones.
          </p>
        </>
      )}
    </section>
  );
}

function ContenidoPerfil({
  username,
  fotoPerfil,
  tokenSpotify,
  id_echohead,
  idPerfilActivo,
  esMiPerfil,
  onFotoActualizada,

}) {
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [intento, setIntento] = useState(0);

  const [borrador, setBorrador] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [selector, setSelector] = useState(null);
  const [pestana, setPestana] = useState('inicio');

  const [seguimiento, setSeguimiento] = useState({
    listo: false,
    siguiendo: false,
    error: '',
  });

  const [siguiendoPeticion, setSiguiendoPeticion] =
    useState(false);

  const [exportando, setExportando] = useState(false);

  const capturaGustos = useRef(null);
  const bloqueo = useRef(false);
  const bloqueoExportar = useRef(false);

  const [descarga, setDescarga] = useState(null);
const dialogoDescarga = useRef(null);

useEffect(() => {
  if (!descarga) return;

  dialogoDescarga.current?.showModal();

  return () => URL.revokeObjectURL(descarga.url);
}, [descarga]);

  const editando = Boolean(borrador);

  useEffect(() => {
    if (!idPerfilActivo) return;

    const controller = new AbortController();
    const id = encodeURIComponent(idPerfilActivo);

    async function cargar() {
      try {
        const options = {
          signal: controller.signal,
        };

        const [
          usuario,
          artistas,
          albumes,
          canciones,
          interacciones,
        ] = await Promise.all([
          pedir(`${API}/usuarios/${id}`, options),
          pedir(`${API}/usuarios/${id}/artistas`, options),
          pedir(`${API}/api/perfil/${id}/albumes`, options),
          pedir(`${API}/api/perfil/${id}/canciones`, options),
          pedir(`${API}/api/interacciones/${id}`, options),
        ]);

        if (
          !usuario ||
          typeof usuario !== 'object' ||
          Array.isArray(usuario)
        ) {
          throw new Error();
        }

        const datos = {
          nombre: usuario.nombre,
          foto: obtenerFotoPerfil(usuario),
          fotoOriginal: usuario.foto_perfil || '',
          fotoVersion: usuario.foto_personalizada_version || null,  
          descripcion: usuario.descripcion || '',
          artistas: lista(artistas).map(item =>
            normalizar(item, 'artistas')
          ),
          albumes: lista(albumes).map(item =>
            normalizar(item, 'albumes')
          ),
          canciones: lista(canciones).map(item =>
            normalizar(item, 'canciones')
          ),
          interacciones: lista(interacciones),
        };

        if (!controller.signal.aborted) {
          setPerfil(datos);
          setErrorCarga('');
        }
      } catch {
        if (!controller.signal.aborted) {
          setErrorCarga(
            'No pudimos cargar este perfil. Inténtalo de nuevo.'
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setCargando(false);
        }
      }
    }

    cargar();

    return () => controller.abort();
  }, [idPerfilActivo, intento]);

  useEffect(() => {
    if (esMiPerfil || !id_echohead) return;

    const controller = new AbortController();

    pedir(
      `${API}/api/usuarios/${encodeURIComponent(id_echohead)}/siguiendo`,
      { signal: controller.signal }
    )
      .then(data => {
        if (!controller.signal.aborted) {
          setSeguimiento({
            listo: true,
            siguiendo: lista(data).some(
              id => String(id) === String(idPerfilActivo)
            ),
            error: '',
          });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSeguimiento({
            listo: false,
            siguiendo: false,
            error:
              'No pudimos comprobar el seguimiento.',
          });
        }
      });

    return () => controller.abort();
  }, [esMiPerfil, id_echohead, idPerfilActivo, intento]);

  async function guardarCambios() {
    if (
      !esMiPerfil ||
      !borrador ||
      bloqueo.current
    ) {
      return;
    }

    bloqueo.current = true;
    setGuardando(true);
    setAviso('');

    try {
      for (const clave of [
        'descripcion',
        'artistas',
        'albumes',
        'canciones',
      ]) {
        // Solo enviamos las secciones que cambiaron.
        if (
          JSON.stringify(borrador[clave]) ===
          JSON.stringify(perfil[clave])
        ) {
          continue;
        }

        const campos = {
          artistas: ['artistName', 'artistImg'],
          albumes: ['albumName', 'albumImg'],
          canciones: ['cancionName', 'cancionImg'],
        };
        const valor = clave === 'descripcion' ? borrador[clave] : borrador[clave].map(item => {
          const [nombre, imagen] = campos[clave];
          return { id: item.id, [nombre]: item[nombre], [imagen]: item[imagen]?.startsWith('https://') ? item[imagen] : '' };
        });
        const body = {
          id_echohead,
          [clave === 'descripcion'
            ? 'nuevaDescripcion'
            : clave]: valor,
        };

        await pedir(`${API}/usuarios/${clave}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        // Conservamos lo que sí confirmó el servidor.
        setPerfil(prev => ({
          ...prev,
          [clave]: borrador[clave],
        }));
      }

      setBorrador(null);
      setAviso('Perfil guardado.');
    } catch {
      setAviso(
        'No se guardaron todos los cambios. Conservamos tu edición para reintentar; algunas secciones pueden haberse guardado.'
      );
    } finally {
      bloqueo.current = false;
      setGuardando(false);
    }
  }

  async function cambiarSeguimiento() {
    if (
      esMiPerfil ||
      !id_echohead ||
      !seguimiento.listo ||
      bloqueo.current
    ) {
      return;
    }

    bloqueo.current = true;
    setSiguiendoPeticion(true);
    setAviso('');

    try {
      await pedir(`${API}/api/seguidores`, {
        method: seguimiento.siguiendo ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          seguidor_id: id_echohead,
          seguido_id: idPerfilActivo,
        }),
      });

      setSeguimiento(prev => ({
        ...prev,
        siguiendo: !prev.siguiendo,
      }));
    } catch {
      setAviso(
        'No pudimos cambiar el seguimiento. Inténtalo de nuevo.'
      );
    } finally {
      bloqueo.current = false;
      setSiguiendoPeticion(false);
    }
  }

  function elegir(item) {
    if (!esMiPerfil || !borrador || !selector) return;

    const clave = selector.clave;

    const artista =
      item.artists
        ?.map(persona => persona.name)
        .join(', ') || '';

    const nuevo =
      clave === 'artistas'
        ? {
            id: item.id,
            artistName: item.name,
            artistImg: item.images?.[0]?.url || '',
          }
        : clave === 'albumes'
          ? {
              id: item.id,
              albumName: item.name,
              albumImg: item.images?.[0]?.url || '',
              artista,
            }
          : {
              id: item.id,
              cancionName: item.name,
              cancionImg:
                item.album?.images?.[0]?.url || '',
              artista,
            };

    setBorrador(prev => {
      const existe = prev[clave].some(
        actual => String(actual.id) === String(item.id)
      );

      if (prev[clave].length >= 5 || existe) {
        return prev;
      }

      return {
        ...prev,
        [clave]: [...prev[clave], nuevo],
      };
    });

    setSelector(null);
  }

  function actualizarInteraccion(item) {
    setPerfil(prev => ({
      ...prev,
      interacciones: [
        ...prev.interacciones.filter(
          actual =>
            actual.spotify_id !== item.spotify_id ||
            actual.tipo !== item.tipo
        ),
        item,
      ],
    }));
  }

  async function abrirCreditos(contenedor) {
  if (!contenedor || bloqueoExportar.current) return;

  bloqueoExportar.current = true;
  setExportando(true);
  setAviso('Preparando los créditos…');

  try {
    const creditos = [
      ...contenedor.querySelectorAll(
        '.eh-artist-credit'
      ),
    ];

    if (!creditos.length) {
      setAviso(
        'Todavía no hay créditos de fotografías disponibles. Si las fotos están cargando, espera e inténtalo de nuevo.'
      );
      return;
    }

    const items = creditos.map(credito => ({
      nombre:
        credito
          .closest('.eh-artist-photo')
          ?.querySelector('img')
          ?.getAttribute('alt') || 'Artista',

      textos: [
        ...new Set(
          [...credito.querySelectorAll('p')]
            .map(parrafo => parrafo.textContent.trim())
            .filter(Boolean)
        ),
      ],

      enlaces: [...credito.querySelectorAll('a')].map(
        enlace => ({
          etiqueta: enlace.textContent.trim(),
          url: enlace.href,
        })
      ),
    }));

    const respuesta = await apiFetch(
      `${API_BASE_URL}/image-credits`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items }),
        signal: AbortSignal.timeout(15000),
      }
    );

    const datos = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(
        datos.error || 'No pudimos preparar los créditos.'
      );
    }

    if (
      typeof datos.id !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(datos.id)
    ) {
      throw new Error(
        'El servidor no devolvió una dirección válida.'
      );
    }

    setAviso('');
    window.location.assign(`/creditos/${datos.id}`);
  } catch (error) {
    setAviso(
      error.name === 'TimeoutError' ||
      error.name === 'AbortError'
        ? 'La consulta tardó demasiado. Inténtalo de nuevo.'
        : error.message || 'No pudimos abrir los créditos.'
    );
  } finally {
    bloqueoExportar.current = false;
    setExportando(false);
  }
}


  async function exportar(ref, archivo, fondo) {
    if (!ref.current || bloqueoExportar.current) return;

    bloqueoExportar.current = true;
    setExportando(true);
    setAviso('');

    try {
      const esMovil = window.matchMedia(
  '(max-width: 768px), (pointer: coarse)'
).matches;

const imagenes = [...ref.current.querySelectorAll('img')];

for (const img of imagenes) {
  img.loading = 'eager';
}

let temporizador;

try {
  await Promise.race([
    Promise.allSettled([
      document.fonts?.ready,
      ...imagenes.map(img => img.decode()),
    ]),
    new Promise(resolve => {
      temporizador = window.setTimeout(resolve, 4000);
    }),
  ]);
} finally {
  window.clearTimeout(temporizador);
}

      const canvas = await html2canvas(ref.current, {
        backgroundColor: fondo,
        scale: esMovil ? 1 : 2,
        imageTimeout: 6000,
        useCORS: true,
        logging: false,
        windowWidth: 1440,

        onclone: async (_document, element) => {
          element.style.width = '1120px';
          element.style.maxWidth = 'none';
          element.style.padding = '28px';
          // Representar las fotos como fondos durante la exportación.
// Así evitamos que html2canvas estire las imágenes.
element
  .querySelectorAll('.eh-artist-frame')
  .forEach(marco => {
    const imagen = marco.querySelector('img');

    if (!imagen || !imagen.complete || !imagen.naturalWidth) {
      return;
    }

    const ancho = marco.getBoundingClientRect().width;

    if (!ancho) return;

    Object.assign(marco.style, {
      height: `${ancho}px`,
      aspectRatio: 'auto',
      backgroundColor: '#e9e9e9',
      backgroundImage: `url(${JSON.stringify(
        imagen.currentSrc || imagen.src
      )})`,
      backgroundSize: 'cover',
      backgroundPosition: getComputedStyle(imagen).objectPosition,
      backgroundRepeat: 'no-repeat',
    });

    // La foto se dibuja como fondo únicamente en la copia exportada.
    imagen.style.visibility = 'hidden';
  });
          const creditos = [
  ...element.querySelectorAll('.eh-artist-credit'),
];

if (creditos.length > 0) {
  const items = creditos.map(credito => {
    const nombre = credito
      .closest('.eh-artist-photo')
      ?.querySelector('img')
      ?.getAttribute('alt') || 'Artista';

    const textos = [
      ...new Set(
        [...credito.querySelectorAll('p')]
          .map(parrafo => parrafo.textContent.trim())
          .filter(Boolean)
      ),
    ];

    const enlaces = [
      ...credito.querySelectorAll('a'),
    ].map(enlace => ({
      etiqueta: enlace.textContent.trim(),
      url: enlace.href,
    }));

    return {
      nombre,
      textos,
      enlaces,
    };
  });

  const respuesta = await apiFetch(
    `${API_BASE_URL}/image-credits`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items }),
      signal: AbortSignal.timeout(15000),
    }
  );

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(
      datos.error ||
      'No pudimos guardar los créditos. Inténtalo de nuevo.'
    );
  }

  if (
    typeof datos.id !== 'string' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(datos.id)
  ) {
    throw new Error(
      'El servidor no devolvió una dirección de créditos válida.'
    );
  }

  const urlCreditos = new URL(
    `/creditos/${datos.id}`,
    window.location.origin
  ).href;

  // Quitamos los bloques únicamente de la copia exportada,
  // después de guardar correctamente su información.
  creditos.forEach(credito => credito.remove());

  const pie = element.ownerDocument.createElement('p');

  pie.textContent = `Créditos de imágenes: ${urlCreditos}`;

  Object.assign(pie.style, {
    margin: '24px 0 0',
    paddingTop: '10px',
    borderTop: '1px solid #b6b6b6',
    color: '#575757',
    fontFamily: 'Arial, sans-serif',
    fontSize: '11px',
    lineHeight: '1.5',
    textAlign: 'left',
    overflowWrap: 'anywhere',
  });

  element.appendChild(pie);
}

          element
            .querySelectorAll('.ep-export-brand')
            .forEach(marca => {
              marca.style.display = 'block';
            });
        },
      });

      const blob = await new Promise(resolve => {
  canvas.toBlob(resolve, 'image/png');
});

if (!blob) {
  throw new Error('No pudimos crear el archivo PNG.');
}

const url = URL.createObjectURL(blob);

if (esMovil) {
  setDescarga({ url, archivo });
} else {
  const link = document.createElement('a');
  link.href = url;
  link.download = archivo;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  setAviso('Imagen preparada para descargar.');
}
      } catch (error) {
  setAviso(
    error.name === 'TimeoutError' ||
    error.name === 'AbortError'
      ? 'La operación tardó demasiado. Inténtalo de nuevo.'
      : error.message ||
        'No pudimos generar la imagen. Inténtalo de nuevo.'
  );
} finally {
    
      bloqueoExportar.current = false;
      setExportando(false);
    }
  }

  function reintentar() {
    setCargando(true);
    setIntento(value => value + 1);
  }

  if (!idPerfilActivo) {
    return (
      <main className="ep-main">
        <p className="ep-notice">
          Inicia sesión para ver tu perfil.
        </p>
      </main>
    );
  }

  if (cargando) {
    return (
      <main className="ep-main">
        <p className="ep-notice" role="status">
          Preparando el perfil…
        </p>
      </main>
    );
  }

  if (errorCarga || !perfil) {
    return (
      <main className="ep-main">
        <div className="ep-notice" role="alert">
          <p>{errorCarga}</p>

          <button
            type="button"
            className="ep-button"
            onClick={reintentar}
          >
            Reintentar
          </button>
        </div>
      </main>
    );
  }

  const datos = borrador || perfil;

  const nombre =
    (
      esMiPerfil
        ? username || perfil.nombre
        : perfil.nombre
    ) || 'Oyente';

  const foto = esMiPerfil
    ? fotoPerfil || perfil.foto
    : perfil.foto;

  const total = tipo =>
    perfil.interacciones.filter(
      item => item.tipo === tipo && !item.es_pendiente
    ).length;

  const propsLista = {
    id_echohead: idPerfilActivo,
    esMiPerfil,
  };

  return (
    <main className="ep-main">
      <header className="ep-header">
        <Foto
          className="ep-avatar"
          src={foto}
          alt={`Foto de ${nombre}`}
        />

        <div className="ep-identity">
          <h1>{nombre}</h1>
          {esMiPerfil && editando && (
  <FotoPerfilControl
    usuario={{
      id_echohead,
      foto_perfil: perfil.fotoOriginal,
      foto_personalizada_version: perfil.fotoVersion,
    }}
    disabled={guardando}
    onActualizada={usuarioActualizado => {
      const nuevaFoto = obtenerFotoPerfil(usuarioActualizado);

      setPerfil(prev => ({
        ...prev,
        foto: nuevaFoto,
        fotoOriginal: usuarioActualizado.foto_perfil || '',
        fotoVersion:
          usuarioActualizado.foto_personalizada_version || null,
      }));

      onFotoActualizada?.(nuevaFoto);
    }}
  />
)}

          {editando ? (
            <>
              <label
                className="ep-description-label"
                htmlFor="ep-description"
              >
                Sobre ti
              </label>

              <textarea
                id="ep-description"
                maxLength={255}
                className="ep-description-input"
                value={borrador.descripcion}
                disabled={guardando}
                placeholder="Cuéntanos qué te gusta escuchar…"
                rows={3}
                onChange={event =>
                  setBorrador(prev => ({
                    ...prev,
                    descripcion: event.target.value,
                  }))
                }
              />
            </>
          ) : (
            <p className="ep-description">
              {perfil.descripcion ||
                'Aún no hay descripción.'}
            </p>
          )}

          <p className="ep-stats">
            <span>
              <strong>{total('album')}</strong> álbumes
            </span>

            <span aria-hidden="true">·</span>

            <span>
              <strong>{total('song')}</strong> canciones
            </span>
          </p>
        </div>

        <div className="ep-header-actions">
          {esMiPerfil ? (
            editando ? (
              <>
                <button
                  type="button"
                  className="ep-button"
                  disabled={guardando}
                  onClick={() => {
                    setBorrador(null);
                    setSelector(null);
                    setAviso('');
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  className="ep-button ep-button--green"
                  disabled={guardando}
                  onClick={guardarCambios}
                >
                  {guardando
                    ? 'Guardando…'
                    : 'Guardar cambios'}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="ep-button"
                disabled={exportando}
                onClick={() => {
                  setPestana('inicio');
                  setAviso('');

                  setBorrador({
                    descripcion: perfil.descripcion,
                    artistas: [...perfil.artistas],
                    albumes: [...perfil.albumes],
                    canciones: [...perfil.canciones],
                  });
                }}
              >
                <FiEdit3 /> Editar perfil
              </button>
            )
          ) : (
            <button
              type="button"
              className={`ep-button ${
                seguimiento.siguiendo
                  ? ''
                  : 'ep-button--green'
              }`}
              disabled={
                !id_echohead ||
                !seguimiento.listo ||
                siguiendoPeticion
              }
              aria-pressed={seguimiento.siguiendo}
              onClick={cambiarSeguimiento}
            >
              {siguiendoPeticion
                ? 'Guardando…'
                : seguimiento.siguiendo
                  ? 'Siguiendo'
                  : 'Seguir'}
            </button>
          )}
        </div>
      </header>

      {seguimiento.error && (
        <div className="ep-notice" role="alert">
          {seguimiento.error}{' '}

          <button
            type="button"
            className="ep-button"
            onClick={reintentar}
          >
            Reintentar
          </button>
        </div>
      )}

      {descarga && (
  <dialog
    ref={dialogoDescarga}
    className="ep-descarga"
    aria-labelledby="ep-descarga-titulo"
    onClose={() => setDescarga(null)}
  >
    <h2 id="ep-descarga-titulo">Tu imagen está lista</h2>

    <img src={descarga.url} alt="Vista previa de la imagen para compartir" />

    <div className="ep-descarga__acciones">
      <a className="ep-button" href={descarga.url} download={descarga.archivo}>
        Descargar PNG
      </a>

      <button
        type="button"
        className="ep-button"
        onClick={() => dialogoDescarga.current?.close()}
      >
        Cerrar
      </button>
    </div>
  </dialog>
)}

      {aviso && (
        <p className="ep-notice" role="status">
          {aviso}
        </p>
      )}

      <nav
        className="ep-tabs"
        aria-label="Secciones del perfil"
      >
        {PESTANAS.map(([clave, etiqueta]) => (
          <button
            type="button"
            key={clave}
            aria-current={
              pestana === clave ? 'page' : undefined
            }
            disabled={editando || exportando}
            onClick={() => setPestana(clave)}
          >
            {etiqueta}
          </button>
        ))}
      </nav>

      {editando && (
        <p className="ep-edit-note">
          Elige hasta cinco favoritos por categoría.
          Guarda o cancela antes de cambiar de pestaña.
        </p>
      )}

      {pestana === 'inicio' && (
        <>
          <section
            ref={capturaGustos}
            className="ep-favorites"
          >
            <p className="ep-export-brand">
              {nombre} · EchoHead
            </p>

            <div className="ep-section-head">
              <h2>
                {esMiPerfil
                  ? 'Mis gustos'
                  : `Los gustos de ${nombre}`}
              </h2>

              {esMiPerfil && !editando && (
                <button
                  type="button"
                  className="ep-button"
                  data-html2canvas-ignore="true"
                  disabled={exportando}
                  onClick={() =>
                    exportar(
                      capturaGustos,
                      'Mis_Gustos_EchoHead.png',
                      '#e9e9e9'
                    )
                  }
                >
                  <FiShare /> Compartir mis gustos
                </button>
              )}
            </div>

            {!editando && (
  <div
    className="ep-credits-access"
    data-html2canvas-ignore="true"
  >
    <button
      type="button"
      className="ep-credits-link"
      onClick={() => abrirCreditos(capturaGustos.current)}
      disabled={exportando}
    >
      Créditos de imágenes
    </button>
  </div>
)}

            {CATEGORIAS.map(categoria => (
              <section
                className="ep-favorite-section"
                key={categoria.clave}
                aria-labelledby={`ep-${categoria.clave}`}
              >
                <div className="ep-row-heading">
                  <h3 id={`ep-${categoria.clave}`}>
                    {categoria.titulo}
                  </h3>

                  {editando && (
                    <span>
                      {datos[categoria.clave].length} / 5
                    </span>
                  )}
                </div>

                {!datos[categoria.clave].length &&
                !editando ? (
                  <p className="ep-empty">
                    {esMiPerfil
                      ? 'Agrega tus favoritos desde «Editar perfil».'
                      : 'Todavía no hay favoritos seleccionados.'}
                  </p>
                ) : (
                  <div
                    className="ep-favorite-grid"
                    style={{
                      '--ep-columns': Math.max(
                        4,
                        Math.min(
                          5,
                          datos[categoria.clave].length +
                            (editando ? 1 : 0)
                        )
                      ),
                    }}
                  >
                    {datos[categoria.clave].map(item => {
                      const tipo =
                        categoria.tipo === 'track'
                          ? 'song'
                          : categoria.tipo;

                      const guardado =
                        perfil.interacciones.find(
                          actual =>
                            actual.spotify_id === item.id &&
                            actual.tipo === tipo
                        );

                      return (
                        <div
                          className="ep-favorite"
                          key={item.id}
                        >
                          {editando && (
                            <button
                              type="button"
                              className="ep-remove"
                              disabled={guardando}
                              aria-label={`Quitar ${nombreItem(item)}`}
                              onClick={() =>
                                setBorrador(prev => ({
                                  ...prev,
                                  [categoria.clave]: prev[
                                    categoria.clave
                                  ].filter(
                                    actual =>
                                      actual.id !== item.id
                                  ),
                                }))
                              }
                            >
                              <FiX />
                            </button>
                          )}

                          {categoria.tipo === 'artist' ? (
                            <ArtistPortrait
  id={item.id}
  name={nombreItem(item)}
  src={item.artistImg || ''}
/>
                          ) : (
                            <Foto
  className={
    categoria.tipo === 'track'
      ? 'ep-favorite-cover ep-favorite-cover--song'
      : 'ep-favorite-cover'
  }
  src={
    item.imagen_url ||
    item.albumImg ||
    item.albumImage ||
    item.album_img ||
    item.songImage ||
    item.song_img ||
    item.cancionImg ||
    ''
  }
  alt={nombreItem(item)}
  loading="lazy"
/>
                          )}

                          <h4>{nombreItem(item)}</h4>

                          {categoria.clave === 'canciones' && item.artista && (
                          <p>{item.artista}</p>
                            )}
                        </div>
                      );
                    })}

                    {editando &&
                      datos[categoria.clave].length < 5 && (
                        <button
                          type="button"
                          className={`ep-add ep-shape-${categoria.tipo}`}
                          disabled={guardando}
                          onClick={() =>
                            setSelector(categoria)
                          }
                        >
                          <FiPlus />
                          <span>
                            Agregar {categoria.singular}
                          </span>
                        </button>
                      )}
                  </div>
                )}
              </section>
            ))}
          </section>

          {esMiPerfil && (
  <ResumenMes
    key={`${idPerfilActivo}-${tokenSpotify || 'sin-spotify'}`}
    tokenSpotify={tokenSpotify}
    nombre={nombre}
    exportando={exportando || editando}
    onExportar={exportar}
    onAbrirCreditos={abrirCreditos}
  >
    <ResumenMesEchoHead
      nombre={nombre}
      exportando={exportando || editando}
      onExportar={exportar}
    />
  </ResumenMes>
)}
        </>
      )}

      <div className="ep-tab-content">
        {pestana === 'albumes' && (
          <ListaAlbumesPerfil {...propsLista} />
        )}

        {pestana === 'canciones' && (
          <ListaCancionesPerfil {...propsLista} />
        )}

        {pestana === 'favoritos' && (
          <ListaFavoritosPerfil {...propsLista} />
        )}

        {pestana === 'reseñas' && (
          <ListaReseñasPerfil
            {...propsLista}
            username={nombre}
            fotoPerfil={foto}
          />
        )}

        {pestana === 'pendientes' && (
          <ListaPendientesPerfil {...propsLista} />
        )}

        {pestana === 'amigos' && (
          <ListaAmigosPerfil
            mi_id={id_echohead}
            id_perfil_activo={idPerfilActivo}
            esMiPerfil={esMiPerfil}
          />
        )}
      </div>

      {selector && editando && esMiPerfil && (
        <SelectorFavorito
          categoria={selector}
          elegidos={borrador[selector.clave]}
          tokenSpotify={tokenSpotify}
          onElegir={elegir}
          onCerrar={() => setSelector(null)}
        />
      )}
    </main>
  );
}

export default function Perfil(props) {
  const { idVisitado } = useParams();

  const esMiPerfil =
    !idVisitado ||
    String(idVisitado) === String(props.id_echohead);

  const idPerfilActivo =
    idVisitado || props.id_echohead;

  return (
    <div className="pagina-perfil ep-profile">
      <Navbar
        username={props.username}
        fotoPerfil={props.fotoPerfil}
      />

      <ContenidoPerfil
        key={`${props.id_echohead}-${idPerfilActivo}`}
        {...props}
        idPerfilActivo={idPerfilActivo}
        esMiPerfil={esMiPerfil}
      />
    </div>
  );
}