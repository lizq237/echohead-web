import { useEffect, useRef, useState } from 'react';
import { FiSearch, FiX } from 'react-icons/fi';
import { useSearchParams } from 'react-router-dom';
import { API_BASE_URL as API, apiFetch } from '../lib/api';
import { searchCatalog } from '../lib/catalog';

import Navbar from '../components/Navbar';
import TarjetaInteractiva from '../components/TarjetaInteractiva';

import './Canciones.css';



function Buscador({ consulta, onBuscar }) {
  const [texto, setTexto] = useState(consulta);
  const input = useRef(null);

  return (
    <form
      className="eh-songs-search"
      role="search"
      onSubmit={event => {
        event.preventDefault();
        onBuscar(texto.trim());
      }}
    >
      <FiSearch aria-hidden="true" />

      <input
        ref={input}
        type="search"
        aria-label="Busca una canción"
        placeholder="Busca una canción"
        value={texto}
        onChange={event => setTexto(event.target.value)}
        minLength={2}
        maxLength={80}
        autoComplete="off"
      />

      {(texto || consulta) && (
        <button
          className="eh-songs-clear"
          type="button"
          aria-label="Limpiar búsqueda"
          onClick={() => {
            setTexto('');
            onBuscar('');
            input.current?.focus();
          }}
        >
          <FiX />
        </button>
      )}

      <button className="eh-songs-submit" type="submit">
        Buscar
      </button>
    </form>
  );
}

function Resultados({
  consulta,
  tokenSpotify,
  renderCanciones,
  onReintentar,
}) {
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [resultado, setResultado] = useState({
    estado: 'cargando',
    items: [],
    error: '',
  });

  useEffect(() => {
    const controller = new AbortController();

    async function buscar() {
      setResultado({ estado: 'cargando', items: [], error: '' });
      try {
        const data = await searchCatalog({ query: consulta, type: 'track', token: tokenSpotify, signal: controller.signal, offset });

        if (!Array.isArray(data.tracks?.items)) {
          throw new Error(
            'El catálogo devolvió una respuesta inesperada.'
          );
        }

        const items = data.tracks.items.map(track => ({
          id: track.id,
          songName: track.name,
          songImage: track.album?.images?.[0]?.url || '',
          songLink: track.external_urls?.spotify,
          artista:
            track.artists
              ?.map(artista => artista.name)
              .join(', ') || '',
        }));

        if (!controller.signal.aborted) {
          setHasMore(data.hasMore);
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
            error: error.message,
          });
        }
      }
    }

    buscar();

    return () => controller.abort();
  }, [consulta, tokenSpotify, offset]);

  if (resultado.estado === 'cargando') {
    return (
      <div className="eh-songs-message" role="status">
        <span className="eh-songs-spinner" />
        Buscando canciones…
      </div>
    );
  }

  if (resultado.estado === 'error') {
    return (
      <div className="eh-songs-message" role="alert">
        <p>{resultado.error}</p>

        <button type="button" onClick={onReintentar}>
          Reintentar
        </button>
      </div>
    );
  }

  if (!resultado.items.length) {
    return (
      <div className="eh-songs-message">
        <h3>No encontramos esa canción</h3>
        <p>Prueba con otro título o revisa cómo está escrito.</p>
      </div>
    );
  }

  return <>
    {renderCanciones(resultado.items)}
    <div className="eh-catalog-pages">
      <button
  type="button"
  disabled={offset === 0}
  onClick={() =>
    setOffset(value =>
      Math.max(0, value - (tokenSpotify ? 10 : 20))
    )
  }
>
  Anterior
</button>

<span>
  Página {Math.floor(offset / (tokenSpotify ? 10 : 20)) + 1}
</span>

<button
  type="button"
  disabled={!hasMore}
  onClick={() =>
    setOffset(value => value + (tokenSpotify ? 10 : 20))
  }
>
  Siguiente
</button>
    </div>
  </>;
}

function ContenidoCanciones({
  cancionesFavs = [],
  tokenSpotify,
  id_echohead,
}) {
  const [provider, setProvider] = useState(tokenSpotify ? 'spotify' : 'musicbrainz');
  const searchToken = provider === 'spotify' ? tokenSpotify : '';
  const [params, setParams] = useSearchParams();
  const consulta = (params.get('buscar') || '').trim();

  const [intentoBusqueda, setIntentoBusqueda] = useState(0);
  const [intentoActividad, setIntentoActividad] = useState(0);

  const [actividad, setActividad] = useState({
    intento: -1,
    items: [],
    error: '',
  });

  // Cargamos la actividad antes de permitir modificaciones.
  const actividadLista =
    Boolean(id_echohead) &&
    actividad.intento === intentoActividad &&
    !actividad.error;

  useEffect(() => {
    if (!id_echohead) return;

    const controller = new AbortController();

    async function cargar() {
      try {
        const response = await apiFetch(
          `${API}/api/interacciones/${encodeURIComponent(id_echohead)}`,
          {
            signal: controller.signal,
          }
        );

        if (!response.ok) throw new Error();

        const items = await response.json();

        if (!Array.isArray(items)) throw new Error();

        if (!controller.signal.aborted) {
          setActividad({
            intento: intentoActividad,
            items,
            error: '',
          });
        }
      } catch {
        if (!controller.signal.aborted) {
          setActividad({
            intento: intentoActividad,
            items: [],
            error:
              'No pudimos cargar tu actividad. Reintenta para poder guardar cambios.',
          });
        }
      }
    }

    cargar();

    return () => controller.abort();
  }, [id_echohead, intentoActividad]);

  function buscar(texto) {
    setParams(
      prev => {
        const next = new URLSearchParams(prev);

        if (texto) {
          next.set('buscar', texto);
        } else {
          next.delete('buscar');
        }

        return next;
      },
      {
        replace: true,
      }
    );

    setIntentoBusqueda(value => value + 1);
  }

  function actualizarActividad(item) {
    setActividad(prev => ({
      ...prev,
      items: [
        ...prev.items.filter(
          actual =>
            actual.spotify_id !== item.spotify_id ||
            actual.tipo !== item.tipo
        ),
        item,
      ],
    }));
  }

  function renderCanciones(items) {
    const unicos = [
      ...new Map(
        items
          .filter(item => item?.id)
          .map(item => [item.id, item])
      ).values(),
    ];

    return (
      <div className="eh-songs-grid">
        {unicos.map(track => {
          const guardado = actividad.items.find(
            item =>
              item.spotify_id === track.id &&
              item.tipo === 'song'
          );

          const fusionado = {
            ...track,
            ...guardado,
            cancionImg:
              track.songImage ||
              track.cancionImg ||
              guardado?.imagen_url,
          };

          return (
            <TarjetaInteractiva
              key={track.id}
              item={fusionado}
              tipo="song"
              id_echohead={id_echohead}
              vista="catalogo"
              soloLectura={!actividadLista}
              onCambio={actualizarActividad}
            />
          );
        })}
      </div>
    );
  }

  return (
    <main className="eh-songs-main">
      <div className="eh-songs-heading">
        <h1>Canciones</h1>
        <p>
          Encuentra una canción para calificarla, reseñarla
          o guardarla.
        </p>
      </div>

      <div className="eh-catalog-provider">
        <label>Catálogo <select value={searchToken ? 'spotify' : 'musicbrainz'} onChange={event => setProvider(event.target.value)}>
          <option value="musicbrainz">MusicBrainz</option>
          {tokenSpotify && <option value="spotify">Spotify</option>}
        </select></label>
        {!searchToken && <p className="eh-catalog-attribution">Datos de <a href="https://musicbrainz.org" target="_blank" rel="noreferrer">MusicBrainz</a> · Portadas de <a href="https://coverartarchive.org" target="_blank" rel="noreferrer">Cover Art Archive</a>. Algunas ediciones pueden no tener portada.</p>}
      </div>
      <Buscador
        key={consulta}
        consulta={consulta}
        onBuscar={buscar}
      />

      <section
        className="eh-songs-results"
        aria-labelledby="eh-songs-title"
      >
        <div className="eh-songs-section-heading">
          <h2 id="eh-songs-title">
            {consulta
              ? `Resultados para “${consulta}”`
              : 'Tus Me gusta de Spotify'}
          </h2>

          {consulta && (
            <button
              type="button"
              onClick={() => buscar('')}
            >
              Volver a tus Me gusta <FiX />
            </button>
          )}
        </div>

        {!id_echohead && (
          <p className="eh-songs-notice">
            Inicia sesión para registrar tus escuchas.
          </p>
        )}

        {id_echohead &&
          actividad.intento !== intentoActividad && (
            <p className="eh-songs-notice" role="status">
              Cargando tu actividad…
            </p>
          )}

        {actividad.intento === intentoActividad &&
          actividad.error && (
            <div className="eh-songs-notice" role="alert">
              <p>{actividad.error}</p>

              <button
                type="button"
                onClick={() =>
                  setIntentoActividad(value => value + 1)
                }
              >
                Reintentar actividad
              </button>
            </div>
          )}

        {consulta ? (
          <Resultados
            key={`${consulta}-${searchToken}-${intentoBusqueda}`}
            consulta={consulta}
            tokenSpotify={searchToken}
            renderCanciones={renderCanciones}
            onReintentar={() =>
              setIntentoBusqueda(value => value + 1)
            }
          />
        ) : cancionesFavs?.length ? (
          renderCanciones(cancionesFavs)
        ) : (
          <div className="eh-songs-message">
            <h3>Encuentra tu próxima escucha</h3>
            <p>
              No hay canciones guardadas para mostrar en
              esta vista. Busca una por su nombre.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

export default function Canciones(props) {
  return (
    <div className="pagina-canciones eh-songs">
      <Navbar
        username={props.username}
        fotoPerfil={props.fotoPerfil}
      />

      <ContenidoCanciones
        key={props.id_echohead || 'sin-cuenta'}
        {...props}
      />
    </div>
  );
}