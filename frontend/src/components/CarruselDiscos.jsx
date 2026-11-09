import { useState } from 'react';
import {
    FaChevronLeft,
    FaChevronRight,
    FaSpotify,
} from 'react-icons/fa';
import { FiPause, FiPlay } from 'react-icons/fi';
import DiscoVacio from '../assets/disco recomendaciones.webp';
import './CarruselDiscos.css';

// Edita esta lista para actualizar la rotación semanal.
const RECOMENDACIONES = [
  {
    id: 1,
    titulo: 'Paladin Strait',
    artista: 'Twenty One Pilots',
    portada:
      'https://i.scdn.co/image/ab67616d00001e02cc94dd4730132ccfbd617bf9',
    url_spotify:
      'https://open.spotify.com/intl-es/track/5HvDKyJlHWg42BdsE4ycSm',
  },
  {
    id: 2,
    titulo: 'Willing and Able',
    artista: 'Noah Kahan',
    portada:
      'https://i.scdn.co/image/ab67616d0000aa54d879855b819250d3d00a1a38',
    url_spotify:
      'https://open.spotify.com/intl-es/track/6pk6E0SZxILzfaAGFngxEs',
  },
  {
    id: 3,
    titulo: 'Te Estoy Correteando',
    artista: 'LATIN MAFIA, Fred again..',
    portada:
      'https://i.scdn.co/image/ab67616d0000aa542fe1ee03a5bed6b4a2e73296',
    url_spotify:
      'https://open.spotify.com/search/Te%20Estoy%20Correteando%20LATIN%20MAFIA',
  },
  {
    id: 4,
    titulo: "Can't Catch Me Now",
    artista: 'Olivia Rodrigo',
    portada:
      'https://i.scdn.co/image/ab67616d0000e1a322ad9f1afdbeeceaf0c91686',
    url_spotify:
      'https://open.spotify.com/intl-es/track/17cia5k4BpGVlyEfqrFH50',
  },
  {
    id: 5,
    titulo: "I'm Scared I'll Never Sleep Again",
    artista: '5 Seconds of Summer',
    portada:
      'https://i.scdn.co/image/ab67616d0000e1a3f02d4d5fb48303e586afc213',
    url_spotify:
      'https://open.spotify.com/intl-es/track/2hCVZaN1R3yS0U4LffcjEw',
  },
  {
    id: 6,
    titulo: 'M.A.I',
    artista: 'Milo j',
    portada:
      'https://i.scdn.co/image/ab67616d0000aa5498ee8fad7a30ff328b97d874',
    url_spotify:
      'https://open.spotify.com/intl-es/track/35ttE4t8lQZA2vuCYDg4G7',
  },
  {
    id: 7,
    titulo: 'party 4 u',
    artista: 'Charli xcx',
    portada:
      'https://i.scdn.co/image/ab67616d0000aa545b8ef3c9b30d307df5245bfa',
    url_spotify:
      'https://open.spotify.com/intl-es/track/2RdEC8Ff83WkX7kDVCHseE',
  },
  {
    id: 8,
    titulo: 'evermore (feat. Bon Iver)',
    artista: 'Taylor Swift, Bon Iver',
    portada:
      'https://i.scdn.co/image/ab67616d0000aa5425751b4b32829d6bbfe6be7f',
    url_spotify:
      'https://open.spotify.com/intl-es/track/0AaV4MJrgmLV3XhoiWXjjb',
  },
  {
    id: 9,
    titulo: 'More Than Words',
    artista: 'Extreme',
    portada:
      'https://i.scdn.co/image/ab67616d0000aa541906efe659ae0615317eb5a4',
    url_spotify:
      'https://open.spotify.com/intl-es/track/2SbsvihBJmgNKZ4qkXFWrp',
  },
  {
    id: 10,
    titulo: 'Otro Atardecer',
    artista: 'Bad Bunny, The Marias',
    portada:
      'https://i.scdn.co/image/ab67616d0000aa5449d694203245f241a1bcaa72',
    url_spotify:
      'https://open.spotify.com/intl-es/track/0E0DRHf5PfMeor0ZCwB3oT',
  },
];

function CarruselDiscos() {
  const [indice, setIndice] = useState(0);
  const [vistos, setVistos] = useState([0]);
  const [pausado, setPausado] = useState(false);

  const total = RECOMENDACIONES.length;
  const actual = RECOMENDACIONES[indice];

  function seleccionar(nuevoIndice) {
    const siguiente = (nuevoIndice + total) % total;

    setIndice(siguiente);
    setVistos(prev =>
      prev.includes(siguiente) ? prev : [...prev, siguiente]
    );
  }

  return (
    <section
      className="eh-rotation"
      aria-labelledby="eh-rotation-title"
      aria-roledescription="carrusel"
    >
      <div className="eh-rotation__heading">
        <h3 id="eh-rotation-title">Rotación semanal</h3>

        <button
          type="button"
          className="eh-rotation__pause"
          aria-pressed={pausado}
          aria-label={
            pausado
              ? 'Reanudar giro del CD'
              : 'Pausar giro del CD'
          }
          onClick={() => setPausado(value => !value)}
        >
          {pausado ? <FiPlay /> : <FiPause />}
        </button>
      </div>

      <p className="eh-rotation__intro">
        Diez canciones. Descúbrelas a tu ritmo.
      </p>

      <div
        className="eh-cds"
        role="group"
        aria-label="Seleccionar canción"
      >
        {RECOMENDACIONES.map((cancion, index) => {
          const offset =
            (index - indice + total + Math.floor(total / 2)) %
              total -
            Math.floor(total / 2);

          const activo = index === indice;

          return (
            <button
              type="button"
              key={cancion.id}
              hidden={Math.abs(offset) > 2}
              className={[
                'eh-cd',
                activo ? 'eh-cd--active' : '',
                pausado ? 'eh-cd--paused' : '',
              ].join(' ')}
              style={{
                '--offset': offset,
                '--distance': Math.abs(offset),
                zIndex: 3 - Math.abs(offset),
              }}
              aria-label={
                `${index + 1}. ${cancion.titulo}, ${cancion.artista}`
              }
              aria-pressed={activo}
              onClick={() => seleccionar(index)}
            >
              <span
                className={[
                  'eh-cd__surface',
                  vistos.includes(index)
                    ? 'eh-cd__surface--revealed'
                    : '',
                ].join(' ')}
              >
                <img
                  src={
                    vistos.includes(index)
                      ? cancion.portada
                      : DiscoVacio
                  }
                  alt=""
                />
              </span>
            </button>
          );
        })}
      </div>

      <div
        className="eh-rotation__info"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="eh-rotation__count">
          {String(indice + 1).padStart(2, '0')} / {total}
        </span>

        <h4>{actual.titulo}</h4>
        <p>{actual.artista}</p>
      </div>

      <div className="eh-rotation__controls">
        <button
          type="button"
          className="eh-rotation__arrow"
          onClick={() => seleccionar(indice - 1)}
          aria-label="Canción anterior"
        >
          <FaChevronLeft />
        </button>

        <a
          href={actual.url_spotify}
          target="_blank"
          rel="noopener noreferrer"
          className="eh-button eh-button--green"
        >
          <FaSpotify aria-hidden="true" />
          Escuchar en Spotify
        </a>

        <button
          type="button"
          className="eh-rotation__arrow"
          onClick={() => seleccionar(indice + 1)}
          aria-label="Canción siguiente"
        >
          <FaChevronRight />
        </button>
      </div>
    </section>
  );
}

export default CarruselDiscos;