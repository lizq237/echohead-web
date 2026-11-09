import { apiFetch, API_BASE_URL } from '../lib/api';
import { useEffect, useState } from 'react';
import { FiArrowUpRight, FiPlus } from 'react-icons/fi';
import { Link } from 'react-router-dom';

import Vinilo from '../assets/vinilo.webp';
import CarruselAlbumes from '../components/CarruselAlbumes';
import CarruselDiscos from '../components/CarruselDiscos';
import Navbar from '../components/Navbar';

import './Inicio.css';



// Actualiza estos datos cuando cambies el álbum de la semana.
// El fragmento es el que compartiste.
const ALBUM_SEMANAL = {
  nombre: 'you seem pretty sad for a girl so in love',
  artista: 'Olivia Rodrigo',
  portada:
    'https://i.scdn.co/image/ab67616d0000b2736949b83f85d782b21ce70583',
  cancion: 'Begged',
  fragmento:
"But nothing's quite enough when I know that to get it I begged.",};

function buscarAlbum(nombre) {
  return `/albumes?buscar=${encodeURIComponent(nombre)}`;
}

function Pendientes({ id_echohead }) {
  const [estado, setEstado] = useState(
    id_echohead ? 'cargando' : 'sin-cuenta'
  );

  const [albumes, setAlbumes] = useState([]);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!id_echohead) return;

    const controller = new AbortController();

    async function cargar() {
      try {
        const response = await apiFetch(
          `${API_BASE_URL}/api/interacciones/${encodeURIComponent(id_echohead)}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('No se pudieron cargar los pendientes');
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error('Respuesta inesperada');
        }

        if (controller.signal.aborted) return;

        setAlbumes(
          data
            .filter(
              item =>
                item.tipo === 'album' &&
                item.es_pendiente === true
            )
            .slice(0, 4)
        );

        setEstado('listo');
      } catch {
        if (!controller.signal.aborted) {
          setEstado('error');
        }
      }
    }

    cargar();

    return () => controller.abort();
  }, [id_echohead, intento]);

  return (
    <section
      className="eh-pending"
      aria-labelledby="eh-pending-title"
    >
      <div className="eh-section-head">
        <div>
          <h2 id="eh-pending-title">De tus pendientes</h2>
          <p>Álbumes que quieres escuchar.</p>
        </div>

        <Link to="/perfil" className="eh-text-link">
          Ver mi perfil <FiArrowUpRight />
        </Link>
      </div>

      {estado === 'cargando' && (
        <p className="eh-empty" role="status">
          Cargando tus pendientes…
        </p>
      )}

      {estado === 'sin-cuenta' && (
        <p className="eh-empty">
          Abre tu perfil para consultar tus pendientes.
        </p>
      )}

      {estado === 'error' && (
        <div className="eh-empty" role="status">
          <p>No pudimos cargar tus pendientes.</p>

          <button
            type="button"
            className="eh-button eh-button--outline"
            onClick={() => {
              setEstado('cargando');
              setIntento(value => value + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      {estado === 'listo' && (
        albumes.length ? (
          <div className="eh-pending-grid">
            {albumes.map(album => (
              <Link
                className="eh-pending-card"
                to={buscarAlbum(album.nombre || '')}
                key={album.spotify_id}
              >
                <div className="eh-pending-cover">
                  {album.imagen_url ? (
                    <img
                      src={album.imagen_url}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <span>Sin portada</span>
                  )}
                </div>

                <h3>{album.nombre || 'Álbum sin título'}</h3>

                <span className="eh-micro">
                  POR ESCUCHAR <FiArrowUpRight />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="eh-empty">
            <p>
              Tu próxima escucha empieza aquí. Guarda un álbum en
              pendientes y aparecerá en esta sección.
            </p>

            <Link
              to="/albumes"
              className="eh-button eh-button--outline"
            >
              Explorar álbumes <FiArrowUpRight />
            </Link>
          </div>
        )
      )}
    </section>
  );
}

function Inicio({
  username,
  fotoPerfil,
  topArtistas = [],
  topAlbumes = [],
  topCanciones = [],
  id_echohead,
}) {
  const [categoria, setCategoria] = useState('artistas');

  const categorias = [
    {
      id: 'artistas',
      nombre: 'Artistas',
      items: topArtistas,
      campo: 'artist',
    },
    {
      id: 'albumes',
      nombre: 'Álbumes',
      items: topAlbumes,
      campo: 'album',
    },
    {
      id: 'canciones',
      nombre: 'Canciones',
      items: topCanciones,
      campo: 'song',
    },
  ];

  const seleccion = categorias.find(
    item => item.id === categoria
  );

  return (
    <div className="Inicio eh-home">
      <Navbar username={username} fotoPerfil={fotoPerfil} />

      <main className="eh-main">
        <section
          className="eh-welcome"
          aria-labelledby="eh-welcome-title"
        >
          <div>
            <h1 id="eh-welcome-title">
              Hola de nuevo{username ? `, ${username}` : ''}.
            </h1>

            <p>¿Qué vas a escuchar hoy?</p>
          </div>

          <Link
            to="/albumes"
            className="eh-button eh-button--green"
          >
            <FiPlus /> Registrar escucha
          </Link>
        </section>

        <section
          className="eh-radar"
          aria-labelledby="eh-radar-title"
        >
          <div className="eh-section-head">
            <div>
              <h2 id="eh-radar-title">En el radar</h2>
              <p>Selección de EchoHead</p>
            </div>

            <div
              className="eh-filters"
              role="group"
              aria-label="Categoría del radar"
            >
              {categorias.map(item => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={categoria === item.id}
                  onClick={() => setCategoria(item.id)}
                >
                  {item.nombre}
                </button>
              ))}
            </div>
          </div>

          <div
            className={`eh-radar-grid eh-radar-grid--${categoria}`}
          >
            {(seleccion.items || []).slice(0, 5).map((item, index) => {
              const nombre =
                item[`${seleccion.campo}Name`] || 'Sin título';

              const portada = item[`${seleccion.campo}Image`];

              return (
                <article
                  className="eh-radar-card"
                  key={`${categoria}-${item.id || nombre}-${index}`}
                >
                  <div className="eh-radar-image">
                    {portada ? (
                      <img src={portada} alt={nombre} />
                    ) : (
                      <span>Sin imagen</span>
                    )}
                  </div>

                  <div className="eh-radar-caption">
                    <span>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3>{nombre}</h3>
                  </div>
                </article>
              );
            })}
          </div>

          {!seleccion.items?.length && (
            <p className="eh-empty">
              Pronto habrá una nueva selección.
            </p>
          )}
        </section>

        <section
          className="eh-week"
          aria-labelledby="eh-week-title"
        >
          <h2 id="eh-week-title">Esta semana en EchoHead</h2>

          <div className="eh-week-grid">
            <CarruselDiscos />

            <article className="eh-weekly-album">
              <h3 className="eh-micro">
                ÁLBUM DE LA SEMANA
              </h3>

              <div className="eh-weekly-content">
                <Link
                  to={buscarAlbum(
                    `${ALBUM_SEMANAL.nombre} ${ALBUM_SEMANAL.artista}`
                  )}
                  className="eh-record"
                  aria-label={`Buscar ${ALBUM_SEMANAL.nombre}`}
                >
                  <span
                    className="eh-record__vinyl"
                    aria-hidden="true"
                  >
                    <img src={Vinilo} alt="" />

                    <img
                      className="eh-record__label"
                      src={ALBUM_SEMANAL.portada}
                      alt=""
                    />
                  </span>

                  <img
                    className="eh-record__cover"
                    src={ALBUM_SEMANAL.portada}
                    alt={ALBUM_SEMANAL.nombre}
                    loading="lazy"
                  />
                </Link>

                <div className="eh-weekly-copy">
                  <h4>{ALBUM_SEMANAL.nombre}</h4>
                  <p>{ALBUM_SEMANAL.artista}</p>

                  <blockquote className="eh-weekly-quote">
                    <p>“{ALBUM_SEMANAL.fragmento}”</p>
                    <cite>— {ALBUM_SEMANAL.cancion}</cite>
                  </blockquote>

                  <Link
                    to={buscarAlbum(
                      `${ALBUM_SEMANAL.nombre} ${ALBUM_SEMANAL.artista}`
                    )}
                    className="eh-button eh-button--outline"
                  >
                    <FiPlus /> Buscar y registrar
                  </Link>
                </div>
              </div>
            </article>
          </div>
        </section>

        <CarruselAlbumes />

        <Pendientes
          key={id_echohead || 'sin-cuenta'}
          id_echohead={id_echohead}
        />
      </main>
    </div>
  );
}

export default Inicio;