import { apiFetch, API_BASE_URL as API } from '../lib/api';
import html2canvas from 'html2canvas';
import { useEffect, useId, useRef, useState } from 'react';
import { FaHeart, FaStar, FaStarHalfAlt } from 'react-icons/fa';
import { FiSearch, FiShare2, FiX } from 'react-icons/fi';

import './ColeccionPerfil.css';
import TarjetaInteractiva from './TarjetaInteractiva';



const CONFIG = {
  canciones: [
    'Canciones',
    'Las canciones que has escuchado y tus calificaciones.',
  ],
  favoritos: [
    'Favoritos',
    'La música a la que siempre quieres volver.',
  ],
  pendientes: [
    'Pendientes',
    'Tu próxima escucha empieza aquí.',
  ],
  resenas: [
    'Reseñas',
    'Lo que te dejó cada escucha.',
  ],
};

const VACIA = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#b6b6b6"/><circle cx="100" cy="100" r="46" fill="none" stroke="#575757" stroke-width="2"/><circle cx="100" cy="100" r="9" fill="#575757"/></svg>'
)}`;

const clave = item => `${item.tipo}:${item.spotify_id}`;

const texto = valor =>
  String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const nota = valor =>
  Math.round(
    Math.max(0, Math.min(5, Number(valor) || 0)) * 2
  ) / 2;

function pertenece(item, modo) {
  if (!['album', 'song'].includes(item.tipo)) {
    return false;
  }

  if (modo === 'canciones') {
    return (
      item.tipo === 'song' &&
      (item.es_escuchado || item.es_favorito)
    );
  }

  if (modo === 'favoritos') {
    return item.es_favorito === true;
  }

  if (modo === 'pendientes') {
    return item.es_pendiente === true;
  }

  return (
    typeof item.descripcion === 'string' &&
    item.descripcion.trim().length > 0
  );
}

function Estrellas({ valor }) {
  const numero = nota(valor);

  return (
    <span
      className="ecp-stars"
      role="img"
      aria-label={
        numero
          ? `${numero} de 5 estrellas`
          : 'Sin calificar'
      }
    >
      {Array.from(
        { length: Math.floor(numero) },
        (_, index) => (
          <FaStar key={index} aria-hidden="true" />
        )
      )}

      {numero % 1 !== 0 && (
        <FaStarHalfAlt aria-hidden="true" />
      )}
    </span>
  );
}

function Foto({ src, className = '', alt = '' }) {
  return (
    <img
      src={src || VACIA}
      alt={alt}
      className={className}
      onError={event => {
        if (event.currentTarget.src !== VACIA) {
          event.currentTarget.src = VACIA;
        }
      }}
    />
  );
}

function CompartirResena({
  item,
  username,
  fotoPerfil,
  cerrar,
}) {
  const dialogo = useRef(null);
  const tarjeta = useRef(null);
  const bloqueo = useRef(false);
  const titulo = useId();

  const [tema, setTema] = useState('claro');
  const [ocupado, setOcupado] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const modal = dialogo.current;
    const foco = document.activeElement;
    const overflow = document.body.style.overflow;

    modal.showModal();
    document.body.style.overflow = 'hidden';

    return () => {
      modal.close();
      document.body.style.overflow = overflow;

      if (foco?.isConnected) {
        foco.focus({ preventScroll: true });
      }
    };
  }, []);

  async function generar() {
    if (bloqueo.current) return;

    bloqueo.current = true;
    setOcupado(true);
    setError('');
    setArchivo(null);

    try {
      await document.fonts.ready;

      await Promise.allSettled(
        [...tarjeta.current.querySelectorAll('img')].map(
          img => img.decode()
        )
      );

      const canvas = await html2canvas(tarjeta.current, {
        scale: 2,
        useCORS: true,
        backgroundColor:
          tema === 'oscuro' ? '#2d2d2d' : '#e9e9e9',
        windowWidth: 1200,

        onclone: doc => {
          const copia = doc.getElementById(
            tarjeta.current.id
          );

          copia.style.width = '440px';
          copia.style.maxWidth = 'none';
        },
      });

      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/png');
      });

      if (!blob) throw new Error();

      const nombre = String(item.nombre || 'musica')
        .replace(/[^\p{L}\p{N} _-]/gu, '')
        .slice(0, 70);

      setArchivo(
        new File(
          [blob],
          `EchoHead-resena-${nombre}.png`,
          { type: 'image/png' }
        )
      );
    } catch {
      setError(
        'No pudimos generar la imagen. Inténtalo de nuevo.'
      );
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }

  function descargar() {
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement('a');

    enlace.href = url;
    enlace.download = archivo.name;

    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function compartir() {
    if (bloqueo.current) return;

    bloqueo.current = true;
    setOcupado(true);
    setError('');

    try {
      await navigator.share({
        title: `Reseña de ${item.nombre}`,
        files: [archivo],
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(
          'No se pudo compartir. Puedes descargar la imagen.'
        );
      }
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }

  return (
    <dialog
      ref={dialogo}
      className="ecp-dialog"
      aria-labelledby={titulo}
      onCancel={event => {
        event.preventDefault();

        if (!bloqueo.current) {
          cerrar();
        }
      }}
    >
      <div className="ecp-dialog-head">
        <h2 id={titulo}>Compartir reseña</h2>

        <button
          type="button"
          className="ecp-icon"
          aria-label="Cerrar"
          disabled={ocupado}
          onClick={cerrar}
        >
          <FiX />
        </button>
      </div>

      <div
        className="ecp-types"
        role="group"
        aria-label="Tema de la imagen"
      >
        {['claro', 'oscuro'].map(value => (
          <button
            key={value}
            type="button"
            aria-pressed={tema === value}
            disabled={ocupado}
            onClick={() => {
              setTema(value);
              setArchivo(null);
              setError('');
            }}
          >
            {value === 'claro'
              ? 'Fondo claro'
              : 'Fondo oscuro'}
          </button>
        ))}
      </div>

      <div
        ref={tarjeta}
        id={`${titulo}-imagen`}
        className={`ecp-export ecp-export--${tema}`}
      >
        <div className="ecp-export-user">
          <Foto src={fotoPerfil} />
          <span>{username || 'Mi perfil'}</span>
        </div>

        <Foto
          src={item.imagen_url}
          className={[
            'ecp-export-cover',
            item.tipo === 'song' ? 'ecp-round' : '',
          ].join(' ')}
        />

        <h3>{item.nombre}</h3>

        <div className="ecp-export-rating">
          <Estrellas valor={item.calificacion} />

          {item.es_favorito && (
            <FaHeart aria-label="Favorito" />
          )}
        </div>

        <p>{item.descripcion}</p>

        <div className="ecp-export-brand">
          <svg aria-hidden="true" viewBox="0 0 96 96">
            <path
              fill="currentColor"
              fillRule="evenodd"
              d="M48 5C24.25 5 5 24.25 5 48s19.25 43 43 43h37V58H48c-5.52 0-10-4.48-10-10s4.48-10 10-10h37V5H48Zm0 16c-14.91 0-27 12.09-27 27s12.09 27 27 27h21v-7H48c-11.05 0-20-8.95-20-20s8.95-20 20-20h21v-7H48Z"
            />

            <path
              fill="#1db954"
              d="M69 38h16v20H69z"
            />
          </svg>

          <span>
            echo<em>head</em>
          </span>
        </div>
      </div>

      {error && <p role="alert">{error}</p>}

      <div className="ecp-export-actions">
        {!archivo ? (
          <button
            type="button"
            className="ecp-primary"
            disabled={ocupado}
            onClick={generar}
          >
            {ocupado
              ? 'Preparando imagen…'
              : 'Generar imagen'}
          </button>
        ) : (
          <>
            <span role="status">Imagen lista</span>

            <button
              type="button"
              className="ecp-primary"
              disabled={ocupado}
              onClick={descargar}
            >
              Descargar PNG
            </button>

            {navigator.canShare?.({
              files: [archivo],
            }) && (
              <button
                type="button"
                className="ecp-button"
                disabled={ocupado}
                onClick={compartir}
              >
                Compartir imagen
              </button>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}

function Contenido({
  modo,
  id_echohead,
  esMiPerfil = false,
  username,
  fotoPerfil,
}) {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  const [busqueda, setBusqueda] = useState('');
  const [tipo, setTipo] = useState('todos');
  const [filtro, setFiltro] = useState('todos');
  const [orden, setOrden] = useState('nombre');
  const [pagina, setPagina] = useState(1);

  const [expandidas, setExpandidas] = useState({});
  const [compartida, setCompartida] = useState(null);
  const [aviso, setAviso] = useState('');

  const heading = useId();
  const [titulo, descripcion] = CONFIG[modo];

  const resenas = modo === 'resenas';
  const pendientes = modo === 'pendientes';

  useEffect(() => {
    const controller = new AbortController();

    async function cargar() {
      try {
        if (!id_echohead) throw new Error();

        const response = await apiFetch(
          `${API}/api/interacciones/${
            encodeURIComponent(id_echohead)
          }`,
          { signal: controller.signal }
        );

        if (!response.ok) throw new Error();

        const data = await response.json();

        if (!Array.isArray(data)) throw new Error();

        const validos = data.filter(
          item =>
            item?.spotify_id &&
            pertenece(item, modo)
        );

        const unicos = [
          ...new Map(
            validos.map(item => [clave(item), item])
          ).values(),
        ];

        if (!controller.signal.aborted) {
          setItems(unicos);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError(
            'No pudimos cargar esta sección. Inténtalo de nuevo.'
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
  }, [id_echohead, modo, intento]);

  const filtrados = items
    .filter(
      item =>
        texto(item.nombre).includes(texto(busqueda)) &&
        (tipo === 'todos' || item.tipo === tipo) &&
        (
          filtro === 'todos' ||
          (
            filtro === 'calificados' &&
            nota(item.calificacion) > 0
          ) ||
          (
            filtro === 'sin-calificar' &&
            nota(item.calificacion) === 0
          ) ||
          (
            filtro === 'favoritos' &&
            item.es_favorito
          )
        )
    )
    .sort((a, b) => {
      const nombres = String(a.nombre || '')
        .localeCompare(
          String(b.nombre || ''),
          'es',
          { numeric: true }
        );

      if (orden === 'nombre') return nombres;

      const na = nota(a.calificacion);
      const nb = nota(b.calificacion);

      if (!na || !nb) {
        return (
          Number(nb > 0) - Number(na > 0) ||
          nombres
        );
      }

      return (
        (orden === 'mayor' ? nb - na : na - nb) ||
        nombres
      );
    });

  const porPagina = resenas ? 10 : 70;

  const totalPaginas = Math.max(
    1,
    Math.ceil(filtrados.length / porPagina)
  );

  const actual = Math.min(pagina, totalPaginas);

  const visibles = filtrados.slice(
    (actual - 1) * porPagina,
    actual * porPagina
  );

  const paginas = [
    ...new Set([
      1,
      actual - 1,
      actual,
      actual + 1,
      totalPaginas,
    ]),
  ]
    .filter(numero => numero > 0 && numero <= totalPaginas)
    .sort((a, b) => a - b);

  function cambiar(setter, value) {
    setter(value);
    setPagina(1);
  }

  function limpiar() {
    setBusqueda('');
    setTipo('todos');
    setFiltro('todos');
    setPagina(1);
  }

  function actualizar(nuevo) {
    setItems(prev =>
      prev
        .map(item =>
          clave(item) === clave(nuevo)
            ? { ...item, ...nuevo }
            : item
        )
        .filter(item => pertenece(item, modo))
    );

    setAviso(`Cambios guardados en ${nuevo.nombre}.`);
  }

  function portada(item) {
    return (
      <div
        className={[
          'ecp-cover',
          !esMiPerfil ? 'ecp-readonly' : '',
        ].join(' ')}
      >
        <TarjetaInteractiva
          item={item}
          tipo={item.tipo}
          id_echohead={id_echohead}
          soloLectura={!esMiPerfil}
          vista="catalogo"
          onCambio={actualizar}
        />

        <div className="ecp-meta">
          {!pendientes && (
            <>
              <Estrellas valor={item.calificacion} />

              {item.es_favorito && (
                <FaHeart
                  className="ecp-heart"
                  aria-label="Favorito"
                />
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <section
      className="ecp"
      aria-labelledby={heading}
    >
      <div className="ecp-toolbar">
        <div>
          <h2 id={heading}>
            {titulo}{' '}
            <span>
              {cargando || error ? '—' : items.length}
            </span>
          </h2>

          <p>
            {esMiPerfil
              ? descripcion
              : `${titulo} de este perfil.`}
          </p>
        </div>

        <div className="ecp-tools">
          <div className="ecp-search">
            <FiSearch aria-hidden="true" />

            <input
              type="search"
              aria-label={`Buscar en ${titulo.toLowerCase()}`}
              placeholder="Buscar por título"
              value={busqueda}
              onChange={event =>
                cambiar(setBusqueda, event.target.value)
              }
            />

            {busqueda && (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => cambiar(setBusqueda, '')}
              >
                <FiX />
              </button>
            )}
          </div>

          {modo === 'canciones' && (
            <label>
              Mostrar

              <select
                aria-label="Mostrar"
                value={filtro}
                onChange={event =>
                  cambiar(setFiltro, event.target.value)
                }
              >
                <option value="todos">Todas</option>
                <option value="calificados">
                  Calificadas
                </option>
                <option value="sin-calificar">
                  Sin calificar
                </option>
                <option value="favoritos">
                  Favoritas
                </option>
              </select>
            </label>
          )}

          <label>
            Ordenar por

            <select
              aria-label="Ordenar por"
              value={orden}
              onChange={event =>
                cambiar(setOrden, event.target.value)
              }
            >
              <option value="nombre">Nombre</option>

              {!pendientes && (
                <>
                  <option value="mayor">
                    Mayor calificación
                  </option>
                  <option value="menor">
                    Menor calificación
                  </option>
                </>
              )}
            </select>
          </label>
        </div>
      </div>

      {modo !== 'canciones' && (
        <div
          className="ecp-types"
          role="group"
          aria-label="Tipo de música"
        >
          {[
            ['todos', 'Todos'],
            ['album', 'Álbumes'],
            ['song', 'Canciones'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={tipo === value}
              onClick={() => cambiar(setTipo, value)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <p className="ecp-sr" role="status">
        {aviso}
      </p>

      {cargando ? (
        <p className="ecp-state" role="status">
          Cargando {titulo.toLowerCase()}…
        </p>
      ) : error ? (
        <div className="ecp-state" role="alert">
          <p>{error}</p>

          <button
            type="button"
            className="ecp-button"
            onClick={() => {
              setError('');
              setCargando(true);
              setIntento(value => value + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      ) : !items.length ? (
        <div className="ecp-state">
          <h3>
            Todavía no hay {titulo.toLowerCase()} aquí
          </h3>

          <p>
            {esMiPerfil
              ? resenas
                ? 'Escribe una reseña desde el menú de un álbum o una canción.'
                : 'Tu selección aparecerá aquí cuando la guardes desde Álbumes o Canciones.'
              : 'Este perfil aún no tiene elementos en esta sección.'}
          </p>
        </div>
      ) : !visibles.length ? (
        <div className="ecp-state">
          <h3>No encontramos coincidencias</h3>

          <button
            type="button"
            className="ecp-button"
            onClick={limpiar}
          >
            Limpiar búsqueda y filtros
          </button>
        </div>
      ) : (
        <>
          {(
            busqueda ||
            tipo !== 'todos' ||
            filtro !== 'todos'
          ) && (
            <p className="ecp-results" role="status">
              {filtrados.length} de {items.length} resultados
            </p>
          )}

          <div
            className={
              resenas ? 'ecp-reviews' : 'ecp-grid'
            }
          >
            {visibles.map(item =>
              resenas ? (
                <article
                  key={clave(item)}
                  className="ecp-review"
                  aria-label={item.nombre}
                >
                  {portada(item)}

                  <div className="ecp-review-copy">
                    <span className="ecp-kind">
                      {item.tipo === 'song'
                        ? 'Canción'
                        : 'Álbum'}
                    </span>

                    <h3>{item.nombre}</h3>

                    <p className="ecp-review-text">
                      {expandidas[clave(item)] ||
                      item.descripcion.length <= 280
                        ? item.descripcion
                        : `${item.descripcion.slice(0, 280)}…`}
                    </p>

                    {item.descripcion.length > 280 && (
                      <button
                        type="button"
                        className="ecp-link"
                        aria-expanded={
                          Boolean(expandidas[clave(item)])
                        }
                        onClick={() => {
                          setExpandidas(prev => ({
                            ...prev,
                            [clave(item)]: !prev[clave(item)],
                          }));
                        }}
                      >
                        {expandidas[clave(item)]
                          ? 'Mostrar menos'
                          : 'Leer más'}
                      </button>
                    )}

                    {esMiPerfil && (
                      <button
                        type="button"
                        className="ecp-link"
                        onClick={() => setCompartida(item)}
                      >
                        <FiShare2 />
                        Compartir reseña
                      </button>
                    )}
                  </div>
                </article>
              ) : (
                <figure
                  key={clave(item)}
                  className="ecp-item"
                  tabIndex={0}
                  aria-label={item.nombre || 'Sin título'}
                >
                  <figcaption
                    className="ecp-tooltip"
                    aria-hidden="true"
                  >
                    {item.nombre || 'Sin título'}
                  </figcaption>

                  {portada(item)}
                </figure>
              )
            )}
          </div>

          {totalPaginas > 1 && (
            <nav
              className="ecp-pages"
              aria-label={`Páginas de ${titulo.toLowerCase()}`}
            >
              <button
                type="button"
                disabled={actual === 1}
                onClick={() => setPagina(actual - 1)}
              >
                Anterior
              </button>

              {paginas.map((numero, index) => (
                <span key={numero}>
                  {index > 0 &&
                    numero - paginas[index - 1] > 1 && (
                      <span aria-hidden="true">…</span>
                    )}

                  <button
                    type="button"
                    aria-label={`Página ${numero}`}
                    aria-current={
                      actual === numero ? 'page' : undefined
                    }
                    onClick={() => setPagina(numero)}
                  >
                    {numero}
                  </button>
                </span>
              ))}

              <button
                type="button"
                disabled={actual === totalPaginas}
                onClick={() => setPagina(actual + 1)}
              >
                Siguiente
              </button>

              <p>
                Página {actual} de {totalPaginas}
              </p>
            </nav>
          )}
        </>
      )}

      {compartida && (
        <CompartirResena
          item={compartida}
          username={username}
          fotoPerfil={fotoPerfil}
          cerrar={() => setCompartida(null)}
        />
      )}
    </section>
  );
}

export default function ColeccionPerfil(props) {
  return (
    <Contenido
      key={`${props.id_echohead}-${props.modo}-${props.esMiPerfil}`}
      {...props}
    />
  );
}