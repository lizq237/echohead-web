import { useEffect, useState } from 'react';
import {
    FiArrowLeft,
    FiArrowRight,
    FiArrowUpRight,
    FiPause,
    FiPlay,
} from 'react-icons/fi';
import { Link } from 'react-router-dom';

import './CarruselAlbumes.css';

const ALBUMES = [
  ['evermore', 'Taylor Swift', '33b8541201f1ef38941024be'],
  ['OK Computer', 'Radiohead', 'c8b444df094279e70d0ed856'],
  ['American Idiot', 'Green Day', '08a1b1e0674086d3f1995e1b'],
  ['DeBÍ TiRAR MáS FOToS', 'Bad Bunny', 'bbd45c8d36e0e045ef640411'],
  ['$AD BOYZ 4 LIFE II', 'Junior H', 'ef88ad49166e31598ff7d4d0'],
  [
    'The ReVe Festival: Finale',
    'Red Velvet',
    'df5022bdf1ac4bf52135c4be',
  ],
  ['La Vida Era Más Corta', 'Milo j', '844283dba279ee545aafb022'],
  ['Help!', 'The Beatles', 'e3e3b64cea45265469d4cafa'],
  ['CHROMAKOPIA', 'Tyler, the Creator', '084a94988541c2402615d014'],
  ['ANTI (Deluxe)', 'Rihanna', '6be9bac15995f089579074de'],
  [
    'Stranger in the Alps',
    'Phoebe Bridgers',
    '6c26e4a2e4df94a55591c48f',
  ],
  [
    'Mr. Morale & The Big Steppers',
    'Kendrick Lamar',
    '2e02117d76426a08ac7c174f',
  ],
  [
    'The Dark Side of the Moon',
    'Pink Floyd',
    'db216ca805faf5fe35df4ee6',
  ],
].map(([nombre, artista, imagen]) => ({
  nombre,
  artista,
  imagen,
  portada: `https://i.scdn.co/image/ab67616d0000b273${imagen}`,
}));

function CarruselAlbumes() {
  const [indice, setIndice] = useState(0);
  const [automatico, setAutomatico] = useState(true);
  const [focoDentro, setFocoDentro] = useState(false);

  const [movimientoReducido, setMovimientoReducido] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  const total = ALBUMES.length;
  const actual = ALBUMES[indice];

  // Detecta la preferencia de movimiento del sistema.
  useEffect(() => {
    const media = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    );

    const actualizar = event => {
      setMovimientoReducido(event.matches);
    };

    media.addEventListener('change', actualizar);

    return () => {
      media.removeEventListener('change', actualizar);
    };
  }, []);

  // Avanza automáticamente cada tres segundos.
  useEffect(() => {
    if (!automatico || movimientoReducido || focoDentro) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndice(prev => (prev + 1) % total);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [
    automatico,
    movimientoReducido,
    focoDentro,
    total,
  ]);

  function seleccionar(nuevoIndice) {
    setIndice((nuevoIndice + total) % total);
    setAutomatico(false);
  }

  return (
    <section
      className="eh-discovery eh-album-carousel"
      aria-labelledby="eh-discovery-title"
      aria-roledescription="carrusel"
      onFocusCapture={() => setFocoDentro(true)}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocoDentro(false);
        }
      }}
    >
      <div className="eh-section-head">
        <div>
          <h2 id="eh-discovery-title">Discos por descubrir</h2>

          <p>
            Selecciona una portada y encuentra tu próxima escucha.
          </p>
        </div>

        <Link to="/albumes" className="eh-text-link">
          Explorar álbumes <FiArrowUpRight />
        </Link>
      </div>

      <div
        className="eh-album-carousel__stage"
        role="group"
        aria-label="Seleccionar álbum"
      >
        {ALBUMES.map((album, index) => {
          const offset =
            (index - indice + total + Math.floor(total / 2)) %
              total -
            Math.floor(total / 2);

          const distancia = Math.abs(offset);

          return (
            <button
              type="button"
              key={album.imagen}
              hidden={distancia > 2}
              className={[
                'eh-album-carousel__cover',
                distancia === 2
                  ? 'eh-album-carousel__cover--outer'
                  : '',
              ].join(' ')}
              aria-label={
                `Seleccionar ${album.nombre}, ${album.artista}`
              }
              aria-pressed={index === indice}
              onClick={() => seleccionar(index)}
              style={{
                '--offset': offset,
                '--distance': distancia,
                zIndex: 3 - distancia,
              }}
            >
              <img
                src={album.portada}
                alt=""
                loading="lazy"
                draggable="false"
              />
            </button>
          );
        })}
      </div>

      <div
        className="eh-album-carousel__info"
        aria-live={
          automatico && !movimientoReducido ? 'off' : 'polite'
        }
        aria-atomic="true"
      >
        <span className="eh-album-carousel__count">
          {String(indice + 1).padStart(2, '0')} / {total}
        </span>

        <h3>{actual.nombre}</h3>
        <p>{actual.artista}</p>
      </div>

      <div className="eh-album-carousel__controls">
        <button
          type="button"
          className="eh-album-carousel__arrow"
          aria-label="Álbum anterior"
          onClick={() => seleccionar(indice - 1)}
        >
          <FiArrowLeft />
        </button>

        <Link
          className="eh-album-carousel__search"
          to={`/albumes?buscar=${encodeURIComponent(
            `${actual.nombre} ${actual.artista}`
          )}`}
        >
          Buscar este álbum <FiArrowUpRight />
        </Link>

        <button
          type="button"
          className="eh-album-carousel__arrow"
          aria-label="Álbum siguiente"
          onClick={() => seleccionar(indice + 1)}
        >
          <FiArrowRight />
        </button>
      </div>

      {!movimientoReducido && (
        <button
          type="button"
          className="eh-album-carousel__motion"
          aria-pressed={!automatico}
          onClick={() => {
            setAutomatico(value => !value);
            setFocoDentro(false);
          }}
        >
          {automatico ? <FiPause /> : <FiPlay />}

          {automatico
            ? 'Pausar carrusel'
            : 'Reanudar carrusel'}
        </button>
      )}
    </section>
  );
}

export default CarruselAlbumes;