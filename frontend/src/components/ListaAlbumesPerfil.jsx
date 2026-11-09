import { apiFetch, API_BASE_URL as API } from '../lib/api';
import { useEffect, useId, useState } from 'react';
import { FaHeart, FaStar, FaStarHalfAlt } from 'react-icons/fa';
import {
  FiChevronLeft,
  FiChevronRight,
  FiSearch,
  FiX,
} from 'react-icons/fi';

import './ListaAlbumesPerfil.css';
import TarjetaInteractiva from './TarjetaInteractiva';



const POR_PAGINA = 70;

function pertenece(item) {
  return (
    item.tipo === 'album' &&
    (item.es_escuchado === true || item.es_favorito === true)
  );
}

function nota(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) return 0;

  return Math.round(Math.max(0, Math.min(5, numero)) * 2) / 2;
}

function normalizar(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function compararNombre(a, b) {
  return String(a.nombre || '').localeCompare(
    String(b.nombre || ''),
    'es',
    { sensitivity: 'base', numeric: true }
  );
}

function Calificacion({ valor }) {
  const puntos = nota(valor);

  return (
    <span
      className="eap-stars"
      role="img"
      aria-label={puntos ? `${puntos} de 5 estrellas` : 'Sin calificar'}
    >
      {Array.from({ length: Math.floor(puntos) }, (_, index) => (
        <FaStar key={index} aria-hidden="true" />
      ))}

      {puntos % 1 !== 0 && <FaStarHalfAlt aria-hidden="true" />}
    </span>
  );
}

function ColeccionAlbumes({ id_echohead, esMiPerfil = false }) {
  const [albumes, setAlbumes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [orden, setOrden] = useState('nombre');
  const [pagina, setPagina] = useState(1);
  const [aviso, setAviso] = useState('');

  const prefijo = useId();

  useEffect(() => {
    if (!id_echohead) return;

    const controller = new AbortController();

    async function cargar() {
      try {
        const response = await apiFetch(
          `${API}/api/interacciones/${encodeURIComponent(id_echohead)}`,
          { signal: controller.signal }
        );

        if (!response.ok) throw new Error();

        const datos = await response.json();

        if (!Array.isArray(datos)) throw new Error();

        const unicos = [
          ...new Map(
            datos
              .filter(item => item?.spotify_id && pertenece(item))
              .map(item => [
                item.spotify_id,
                {
                  ...item,
                  calificacion: nota(item.calificacion),
                },
              ])
          ).values(),
        ];

        if (!controller.signal.aborted) {
          setAlbumes(unicos);
          setError('');
        }
      } catch {
        if (!controller.signal.aborted) {
          setError('No pudimos cargar los álbumes. Inténtalo de nuevo.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setCargando(false);
        }
      }
    }

    cargar();

    return () => controller.abort();
  }, [id_echohead, intento]);

  const consulta = normalizar(busqueda);

  const visibles = albumes
    .filter(album => {
      if (consulta && !normalizar(album.nombre).includes(consulta)) {
        return false;
      }

      if (filtro === 'favoritos') return album.es_favorito;
      if (filtro === 'calificados') return nota(album.calificacion) > 0;
      if (filtro === 'sin-calificar') return nota(album.calificacion) === 0;

      return true;
    })
    .sort((a, b) => {
      if (orden === 'nombre') return compararNombre(a, b);

      const notaA = nota(a.calificacion);
      const notaB = nota(b.calificacion);

      // Los álbumes sin calificar aparecen al final.
      if (!notaA || !notaB) {
        return notaA ? -1 : notaB ? 1 : compararNombre(a, b);
      }

      return (
        (orden === 'mayor' ? notaB - notaA : notaA - notaB) ||
        compararNombre(a, b)
      );
    });

  const totalPaginas = Math.max(
    1,
    Math.ceil(visibles.length / POR_PAGINA)
  );

  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * POR_PAGINA;
  const actuales = visibles.slice(inicio, inicio + POR_PAGINA);

  function actualizar(item) {
    if (!esMiPerfil || item.tipo !== 'album') return;

    setAlbumes(prev =>
      prev.flatMap(album => {
        if (album.spotify_id !== item.spotify_id) return [album];
        if (!pertenece(item)) return [];

        return [{
          ...album,
          ...item,
          calificacion: nota(item.calificacion),
        }];
      })
    );

    setPagina(paginaActual);
    setAviso(
      pertenece(item)
        ? 'Cambios guardados.'
        : 'El álbum ya no aparece en esta colección.'
    );
  }

  function limpiar() {
    setBusqueda('');
    setFiltro('todos');
    setPagina(1);
  }

  if (!id_echohead) {
    return (
      <p className="eap-state">
        Selecciona un perfil para ver sus álbumes.
      </p>
    );
  }

  return (
    <section
      className="eap-collection"
      aria-labelledby={`${prefijo}-titulo`}
    >
      <div className="eap-toolbar">
        <div className="eap-heading">
          <h2 id={`${prefijo}-titulo`}>
            Álbumes
            {!cargando && !error && <span>{albumes.length}</span>}
          </h2>

          <p>
            {esMiPerfil
              ? 'Tu colección y tus calificaciones.'
              : 'Su colección y sus calificaciones.'}
          </p>
        </div>

        <div className="eap-tools">
          <div
            className="eap-search"
            role="search"
            aria-label="Buscar en la colección"
          >
            <FiSearch aria-hidden="true" />

            <input
              type="search"
              aria-label="Buscar álbum por nombre"
              placeholder="Buscar álbum"
              value={busqueda}
              disabled={cargando || Boolean(error)}
              onChange={event => {
                setBusqueda(event.target.value);
                setPagina(1);
              }}
            />

            {busqueda && (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => {
                  setBusqueda('');
                  setPagina(1);
                }}
              >
                <FiX aria-hidden="true" />
              </button>
            )}
          </div>

          <label className="eap-select">
            Mostrar
            <select
              value={filtro}
              disabled={cargando || Boolean(error)}
              onChange={event => {
                setFiltro(event.target.value);
                setPagina(1);
              }}
            >
              <option value="todos">Todos</option>
              <option value="calificados">Calificados</option>
              <option value="sin-calificar">Sin calificar</option>
              <option value="favoritos">Favoritos</option>
            </select>
          </label>

          <label className="eap-select">
            Ordenar por
            <select
              value={orden}
              disabled={cargando || Boolean(error)}
              onChange={event => {
                setOrden(event.target.value);
                setPagina(1);
              }}
            >
              <option value="nombre">Nombre</option>
              <option value="mayor">Mayor calificación</option>
              <option value="menor">Menor calificación</option>
            </select>
          </label>
        </div>
      </div>

      <p className="eap-sr-only" role="status">
        {aviso}
      </p>

      {cargando ? (
        <p className="eap-state" role="status">
          Cargando álbumes…
        </p>
      ) : error ? (
        <div className="eap-state" role="alert">
          <p>{error}</p>

          <button
            type="button"
            onClick={() => {
              setCargando(true);
              setError('');
              setIntento(value => value + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      ) : !albumes.length ? (
        <div className="eap-state">
          <h3>Todavía no hay álbumes aquí</h3>
          <p>
            {esMiPerfil
              ? 'Los álbumes que marques como escuchados o favoritos aparecerán aquí.'
              : 'Este usuario todavía no tiene álbumes escuchados o favoritos para mostrar.'}
          </p>
        </div>
      ) : !visibles.length ? (
        <div className="eap-state">
          <h3>No encontramos coincidencias</h3>
          <p>Prueba otro nombre o cambia el filtro.</p>

          <button type="button" onClick={limpiar}>
            Limpiar búsqueda y filtro
          </button>
        </div>
      ) : (
        <>
          {(consulta || filtro !== 'todos') && (
            <p className="eap-results" role="status">
              {visibles.length} de {albumes.length} álbumes
            </p>
          )}

          <div className="eap-grid">
            {actuales.map(album => (
              <figure
                key={album.spotify_id}
                className="eap-album"
                tabIndex={0}
                aria-label={album.nombre || 'Álbum sin título'}
              >
                <figcaption className="eap-tooltip" aria-hidden="true">
                  {album.nombre || 'Sin título'}
                </figcaption>

                <TarjetaInteractiva
                  item={album}
                  tipo="album"
                  id_echohead={id_echohead}
                  soloLectura={!esMiPerfil}
                  vista="catalogo"
                  onCambio={actualizar}
                />

                <div className="eap-meta">
                  <Calificacion valor={album.calificacion} />

                  {album.es_favorito && (
                    <span
                      className="eap-heart"
                      role="img"
                      aria-label="Favorito"
                    >
                      <FaHeart aria-hidden="true" />
                    </span>
                  )}
                </div>
              </figure>
            ))}
          </div>

          {totalPaginas > 1 && (
            <nav className="eap-pagination" aria-label="Páginas de álbumes">
              <button
                type="button"
                disabled={paginaActual === 1}
                onClick={() => setPagina(paginaActual - 1)}
              >
                <FiChevronLeft aria-hidden="true" />
                Anterior
              </button>

              <span aria-live="polite">
                {paginaActual} / {totalPaginas}
              </span>

              <button
                type="button"
                disabled={paginaActual === totalPaginas}
                onClick={() => setPagina(paginaActual + 1)}
              >
                Siguiente
                <FiChevronRight aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

export default function ListaAlbumesPerfil(props) {
  return (
    <ColeccionAlbumes
      key={`${props.id_echohead}-${props.esMiPerfil}`}
      {...props}
    />
  );
}