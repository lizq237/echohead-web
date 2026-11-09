import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import AccountAccess from './components/AccountAccess';
import { API_BASE_URL, apiFetch, clearSession, establishSession } from './lib/api';

import {
  Link,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';

import './App.css';
import { obtenerFotoPerfil } from './lib/profilePhoto';

// Conservamos las pantallas que ya existen en tu proyecto.
// Se cargan cuando se necesitan para no mezclar sus estilos con el login.
const About = lazy(() => import('./components/About'));
const Contacto = lazy(() => import('./components/Contacto'));
const Footer = lazy(() => import('./components/Footer'));
const Privacidad = lazy(() => import('./components/Privacidad'));
const Reproductor = lazy(() => import('./components/Reproductor'));
const ReproductorEstetico = lazy(
  () => import('./components/ReproductorEstetico')
);
const Terminos = lazy(() => import('./components/Terminos'));

const Cuenta = lazy(() => import('./pages/Cuenta'));
const Albumes = lazy(() => import('./pages/Albumes'));
const Canciones = lazy(() => import('./pages/Canciones'));
const Inicio = lazy(() => import('./pages/Inicio'));
const Perfil = lazy(() => import('./pages/Perfil'));
const CreditosImagenes = lazy(
  () => import('./components/CreditosImagenes')
);

// Conservamos la dirección que utilizaba tu proyecto.
// Si cambia tu túnel, actualiza esta dirección.


const SPOTIFY_API = 'https://api.spotify.com/v1';

// Avatar de respaldo incluido en el código: no requiere otro archivo.
const DEFAULT_IMAGE =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <rect width="96" height="96" rx="48" fill="#e9e9e9"/>
      <circle cx="48" cy="36" r="16" fill="#858585"/>
      <path d="M20 83v-8a28 28 0 0 1 56 0v8" fill="#858585"/>
    </svg>
  `);

// Selecciones que ya tenías en Inicio.
// Las conservamos mientras trabajamos únicamente en el login.
const TOP_ARTISTAS = [
  {
    id: '66CXWjxzNUsdJxJ2JdwvnR',
    artistName: 'Ariana Grande',
    artistImage:
      'https://i.scdn.co/image/ab67616d00001e02a8cd4b331826a52e8d05bd90',
  },
  {
    id: '3fMbdgg4jU18AjLCKBhRSm',
    artistName: 'Michael Jackson',
    artistImage:
      'https://image-cdn-ak.spotifycdn.com/image/ab676186000001943753db8546a0d1ec0972c594',
  },
  {
    id: '1uNFoZAHBGtllmzznpCI3s',
    artistName: 'Justin Bieber',
    artistImage:
      'https://i.scdn.co/image/ab6761610000e5ebaf20f7db5288bce9beede034',
  },
  {
    id: '3ukkRHDHbN8tNRPKsGZR1h',
    artistName: 'BTS',
    artistImage:
      'https://i.scdn.co/image/ab6761670000ecd487ef96c83d38f358fd297172',
  },
  {
    id: '7yNf9YjeO5JXUE3JEBgnYc',
    artistName: 'Dominic Fike',
    artistImage:
      'https://image-cdn-ak.spotifycdn.com/image/ab676186000001941ce8822b366da01389b26de0',
  },
];

const TOP_ALBUMES = [
  {
    id: '3ukkRHDHbN8tNRPKsGZR1h',
    albumName: 'ARIRANG',
    albumImage:
      'https://i.scdn.co/image/ab67616d00001e02dfa17fad7f190c901603270e',
  },
  {
    id: '3TVXtAsR1Inumwj472S9r4',
    albumName: 'ICEMAN',
    albumImage:
      'https://i.scdn.co/image/ab67616d00001e02fe9d3ab9adb1d3b59835b81c',
  },
  {
    id: '5K79FLRUCSysQnVESLcTdb',
    albumName: 'DeBÍ TiRAR MáS FOToS',
    albumImage:
      'https://i.scdn.co/image/ab67616d00001e02bbd45c8d36e0e045ef640411',
  },
  {
    id: '3fMbdgg4jU18AjLCKBhRSm',
    albumName: 'Thriller',
    albumImage:
      'https://i.scdn.co/image/ab67616d0000b27332a7d87248d1b75463483df5',
  },
  {
    id: '5K79FLRUCSysQnVESLcTdb',
    albumName: 'Un Verano Sin Ti',
    albumImage:
      'https://i.scdn.co/image/ab67616d00001e0249d694203245f241a1bcaa72',
  },
];

const TOP_CANCIONES = [
  {
    id: '66CXWjxzNUsdJxJ2JdwvnR',
    songName: 'hate that i made you love me',
    songImage:
      'https://i.scdn.co/image/ab67616d0000b273b622d42c30697e1e1414343c',
  },
  {
    id: '3fMbdgg4jU18AjLCKBhRSm',
    songName: 'Billie Jean',
    songImage:
      'https://i.scdn.co/image/ab67616d0000b27332a7d87248d1b75463483df5',
  },
  {
    id: '1uNFoZAHBGtllmzznpCI3s',
    songName: 'Beauty And A Beat',
    songImage:
      'https://i.scdn.co/image/ab67616d0000b273f1d02a6cec967f8b6b78f76e',
  },
  {
    id: '68lbSrXDORS51pmyjZv712',
    songName: 'SWIM',
    songImage:
      'https://i.scdn.co/image/ab67616d0000b273dfa17fad7f190c901603270e',
  },
  {
    id: '7yNf9YjeO5JXUE3JEBgnYc',
    songName: 'Babydoll',
    songImage:
      'https://i.scdn.co/image/ab67616d0000b2737b1b6f41c1645af9757d5616',
  },
];

// Solicitudes con comprobación de respuesta y tiempo límite.
async function requestJSON(url, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20000);

  try {
    const response = await apiFetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'La solicitud no se pudo completar.');
    }

    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

async function completeLogin(code, state) {
  const tokens = await requestJSON(`${API_BASE_URL}/intercambiar-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state }),
  });
  if (!tokens.access_token || !tokens.user?.id_echohead || !tokens.csrf_token) {
    throw new Error('No pudimos verificar tu sesión. Vuelve a conectar Spotify.');
  }
  return tokens;
}

async function getSpotifyLibrary(token) {
  const options = {
    headers: { Authorization: `Bearer ${token}` },
  };

  const [albumsResult, tracksResult] = await Promise.allSettled([
    requestJSON(`${SPOTIFY_API}/me/albums?limit=50`, options),
    requestJSON(`${SPOTIFY_API}/me/tracks?limit=50`, options),
  ]);

  const albumItems =
    albumsResult.status === 'fulfilled' &&
    Array.isArray(albumsResult.value.items)
      ? albumsResult.value.items
      : [];

  const trackItems =
    tracksResult.status === 'fulfilled' &&
    Array.isArray(tracksResult.value.items)
      ? tracksResult.value.items
      : [];

  return {
    albums: albumItems
      .filter((item) => item?.album)
      .map(({ album }) => ({
        id: album.id,
        albumName: album.name,
        albumImage: album.images?.[0]?.url || DEFAULT_IMAGE,
        albumLink: album.external_urls?.spotify,
      })),

    tracks: trackItems
      .filter((item) => item?.track)
      .map(({ track }) => ({
        id: track.id,
        songName: track.name,
        songImage: track.album?.images?.[0]?.url || DEFAULT_IMAGE,
        songLink: track.external_urls?.spotify,
      })),
  };
}

function EchoMark() {
  return (
    <svg
      className="eh-login__mark"
      viewBox="0 0 96 96"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M48 5C24.25 5 5 24.25 5 48s19.25 43 43 43h37V58H48c-5.52 0-10-4.48-10-10s4.48-10 10-10h37V5H48Zm0 16c-14.91 0-27 12.09-27 27s12.09 27 27 27h21v-7H48c-11.05 0-20-8.95-20-20s8.95-20 20-20h21v-7H48Z"
      />
      <path fill="#1DB954" d="M69 38h16v20H69z" />
    </svg>
  );
}

function SpotifyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.58 14.42a.62.62 0 0 1-.85.2c-2.34-1.43-5.28-1.75-8.74-.96a.62.62 0 0 1-.28-1.2c3.78-.87 7.03-.5 9.67 1.1.3.18.39.57.2.86Zm1.22-2.7a.78.78 0 0 1-1.07.25c-2.67-1.64-6.75-2.11-9.91-1.16a.78.78 0 1 1-.45-1.49c3.61-1.09 8.1-.56 11.18 1.33.37.22.48.7.25 1.07Zm.1-2.8C14.7 9.02 9.42 8.83 6.36 9.75a.93.93 0 1 1-.54-1.78c3.51-1.06 9.35-.83 13.04 1.36a.93.93 0 0 1-.95 1.6Z"
      />
    </svg>
  );
}

function Login({ onLogin, onSession, isConnecting, error }) {
  const [spotifyEnabled, setSpotifyEnabled] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    apiFetch(`${API_BASE_URL}/auth/options`, { signal: controller.signal }).then(r => r.ok ? r.json() : {}).then(data => setSpotifyEnabled(Boolean(data.spotify))).catch(() => {});
    return () => controller.abort();
  }, []);
  return (
    <main className="eh-login">
      <a className="eh-login__skip" href="#echohead-access">
        Ir al inicio de sesión
      </a>

      <div className="eh-login__background" aria-hidden="true" />
      <div className="eh-login__shade" aria-hidden="true" />

      <header className="eh-login__header">
        <Link
          className="eh-login__brand"
          to="/"
          aria-label="EchoHead, inicio"
        >
          <EchoMark />

          <span className="eh-login__wordmark">
            echo<span>head</span>
          </span>
        </Link>

        <span className="eh-login__edition">
          PARA QUIENES ESCUCHAN Y SIENTEN.
        </span>
      </header>

      <div className="eh-login__layout">
        <section
          className="eh-login__hero"
          aria-labelledby="echohead-title"
        >
          <p className="eh-login__eyebrow">
            <span aria-hidden="true" />
            TU DIARIO MUSICAL
          </p>

          <h1 id="echohead-title" className="eh-login__title">
            Tu música.
            <br />
            <span>Tu criterio.</span>
          </h1>

          <p className="eh-login__intro">
            Hay discos que se quedan contigo.
            <br className="eh-login__desktop-break" />
            {' '}Dales un lugar, una calificación y tus propias palabras.
          </p>

          <ul
            className="eh-login__features"
            aria-label="Qué puedes hacer en EchoHead"
          >
            <li>Registra</li>
            <li>Reseña</li>
            <li>Comparte</li>
          </ul>
        </section>

        <section
          id="echohead-access"
          className="eh-login__panel"
          aria-labelledby="echohead-welcome"
          tabIndex={-1}
        >
          <p className="eh-login__panel-label">
            <span>DALE PLAY A TU PERFIL</span>
            <span aria-hidden="true">↗</span>
          </p>

          <div className="eh-login__welcome">
            <h2 id="echohead-welcome">
              Tu próxima escucha<br /><em>empieza aquí.</em>
            </h2>

            <p>
              Guarda tus favoritos, escribe reseñas y descubre qué
              están escuchando otras personas.
            </p>
          </div>

          <div className="eh-login__actions">
            {error && (
              <p className="eh-login__error" role="alert">
                {error}
              </p>
            )}

            <AccountAccess onSession={onSession} />
            {spotifyEnabled && <>
            <p className="eh-login__connection">¿Ya usabas EchoHead con Spotify? Entra aquí para conservar tu perfil.</p>
            <button
              className="eh-login__button"
              type="button"
              onClick={onLogin}
              disabled={isConnecting}
              aria-busy={isConnecting}
            >
              <span>
                <SpotifyIcon />
                {isConnecting
                  ? 'Conectando…'
                  : 'Continuar con Spotify'}
              </span>

              <span
                className={
                  isConnecting
                    ? 'eh-login__spinner'
                    : 'eh-login__arrow'
                }
                aria-hidden="true"
              >
                {isConnecting ? '' : '↗'}
              </span>
            </button>

            <p
              className="eh-login__connection"
              aria-live="polite"
            >
              {isConnecting
                ? 'Estamos conectando tu cuenta. Un momento…'
                : 'Conexión opcional · Solo usuarios autorizados de la beta.'}
            </p>

            </>}
            <p className="eh-login__legal">
              Antes de continuar, consulta nuestros{' '}
              <Link to="/terminos">Términos</Link> y la{' '}
              <Link to="/privacidad">Política de privacidad</Link>.
            </p>
          </div>
        </section>
      </div>

      <footer className="eh-login__footer">
        <span>UN ESPACIO PARA TU FORMA DE ESCUCHAR.</span>

        <span>
          HECHO DE MÚSICA Y OPINIONES
          <span
            className="eh-login__footer-dot"
            aria-hidden="true"
          />
        </span>
      </footer>
    </main>
  );
}

function LoadingPage({
  message = 'Cargando EchoHead…',
  description = 'Un momento, por favor.',
}) {
  return (
    <main className="eh-page-loading" aria-busy="true">
      <div className="eh-page-loading__content">
        <div
          className="eh-page-loading__brand"
          aria-label="EchoHead"
        >
          <EchoMark />

          <span
            className="eh-page-loading__wordmark"
            aria-hidden="true"
          >
            echo<span>head</span>
          </span>
        </div>

        <div role="status" aria-live="polite">
          <span
            className="eh-page-loading__spinner"
            aria-hidden="true"
          />

          <h1 className="eh-page-loading__title">
            {message}
          </h1>

          <p className="eh-page-loading__description">
            {description}
          </p>
        </div>
      </div>
    </main>
  );
}

export default function App() {
  const navigate = useNavigate();
  const startup = useRef(null);
  const startupFinished = useRef(false);
  const [callbackParams] = useState(() => new URLSearchParams(window.location.search));
  const [sesionIniciada, setSesionIniciada] = useState(false);
  const [usuario, setUsuario] = useState('');
  const [fotoPerfil, setFotoPerfil] = useState('');
  const [tokenSpotify, setTokenSpotify] = useState('');
  const [spotifyLifetime, setSpotifyLifetime] = useState(0);
  const [idEchohead, setIdEchohead] = useState(null);
  const [nuevosAlbumes, setNuevosAlbumes] = useState([]);
  const [cancionesFavs, setCancionesFavs] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [loginError, setLoginError] = useState('');

  const acceptSession = useCallback(data => {
    establishSession(data);
    setUsuario(data.user.nombre || 'Oyente');
    setFotoPerfil(obtenerFotoPerfil(data.user) || DEFAULT_IMAGE);
    setIdEchohead(data.user.id_echohead);
    setSesionIniciada(true);
    if (data.access_token) {
      setTokenSpotify(data.access_token);
      setSpotifyLifetime(data.spotify_expires_in || 3600);
    }
  }, []);

  useEffect(() => {
    const expired = () => {
      clearSession(); setSesionIniciada(false); setTokenSpotify(''); setIdEchohead(null);
      setUsuario(''); setFotoPerfil(''); setNuevosAlbumes([]); setCancionesFavs([]);
      setIsConnecting(false); setLoginError('Tu sesión venció. Vuelve a iniciar sesión.');
      navigate('/', { replace: true });
    };
    const spotifyExpired = () => { setTokenSpotify(''); setNuevosAlbumes([]); setCancionesFavs([]); };
    const pageshow = event => { if (event.persisted) window.location.reload(); };
    window.addEventListener('echohead-session-expired', expired);
    window.addEventListener('echohead-spotify-expired', spotifyExpired);
    window.addEventListener('pageshow', pageshow);
    document.title = 'EchoHead — Tu música, tu criterio';
    document.documentElement.lang = 'es';
    return () => {
      window.removeEventListener('echohead-session-expired', expired);
      window.removeEventListener('echohead-spotify-expired', spotifyExpired);
      window.removeEventListener('pageshow', pageshow);
    };
  }, [navigate]);

  useEffect(() => {
    if (startupFinished.current) return;
    let active = true;
    if (!startup.current) {
      const code = callbackParams.get('code');
      const error = callbackParams.get('error');
      if (code || error) window.history.replaceState({}, '', window.location.pathname);
      startup.current = (async () => {
        let connectionError = error ? 'Cancelaste la conexión con Spotify. Tu cuenta EchoHead sigue disponible.' : '';
        if (code) {
          try { return { data: await completeLogin(code, callbackParams.get('state')), callback: true }; }
          catch (err) { connectionError = err.message; }
        }
        const response = await apiFetch(`${API_BASE_URL}/auth/restore`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        if (response.status === 401) return { data: null, connectionError };
        if (!response.ok) throw new Error('No pudimos comprobar tu sesión. Revisa que el backend esté encendido y recarga la página.');
        return { data: await response.json(), connectionError };
      })();
    }
    startup.current.then(({ data, connectionError, callback }) => {
      if (!active) return;
      startupFinished.current = true;
      if (data) acceptSession(data);
      if (connectionError) setLoginError(connectionError);
      if (callback) navigate('/', { replace: true });
      else if (callbackParams.has('code') || callbackParams.has('error')) navigate(data ? '/cuenta' : '/', { replace: true });
    }).catch(err => { if (active) { startupFinished.current = true; setLoginError(err.message); } })
      .finally(() => { if (active) setInitializing(false); });
    return () => { active = false; };
  }, [acceptSession, callbackParams, navigate]);

  useEffect(() => {
    if (!tokenSpotify) return;
    let active = true;
    const timer = window.setTimeout(() => window.dispatchEvent(new Event('echohead-spotify-expired')), spotifyLifetime * 1000);
    getSpotifyLibrary(tokenSpotify).then(({ albums, tracks }) => {
      if (active) { setNuevosAlbumes(albums); setCancionesFavs(tracks); }
    });
    return () => { active = false; window.clearTimeout(timer); };
  }, [tokenSpotify, spotifyLifetime]);

  useEffect(() => {
    if (tokenSpotify) return;
    const open = () => navigate('/player');
    window.addEventListener('abrir-tocadiscos', open);
    return () => window.removeEventListener('abrir-tocadiscos', open);
  }, [tokenSpotify, navigate]);

  const handleLogin = () => {
    setLoginError(''); setIsConnecting(true); window.location.assign(`${API_BASE_URL}/login`);
  };
  if (initializing) return <LoadingPage message="Preparando tu perfil…" description="Estamos comprobando tu sesión." />;

  if (!sesionIniciada) {
  return (
    <Suspense fallback={<LoadingPage />}>
      <Routes>
        <Route
          path="/about"
          element={<About publicView />}
        />

        <Route
          path="/contacto"
          element={<Contacto publicView />}
        />

        <Route
          path="/terminos"
          element={<Terminos publicView />}
        />

        <Route
          path="/privacidad"
          element={<Privacidad publicView />}
        />

        <Route
          path="/creditos/:id"
          element={<CreditosImagenes publicView />}
        />

        <Route
          path="*"
          element={
            <Login
              onLogin={handleLogin}
              onSession={data => {
                acceptSession(data);
                setLoginError('');
                navigate('/', { replace: true });
              }}
              isConnecting={isConnecting}
              error={loginError}
            />
          }
        />
      </Routes>
    </Suspense>
  );
}

  const userProps = {
    username: usuario,
    fotoPerfil,
  };

  const profileProps = {
  ...userProps,
  tokenSpotify,
  id_echohead: idEchohead,
  onFotoActualizada: nuevaFoto => {
    setFotoPerfil(nuevaFoto || DEFAULT_IMAGE);
  },
};

  return (
    <Suspense fallback={<LoadingPage />}>
      <Routes>
        <Route
          path="/"
          element={
            <Inicio
            id_echohead={idEchohead}
              {...userProps}
              topArtistas={TOP_ARTISTAS}
              topAlbumes={TOP_ALBUMES}
              topCanciones={TOP_CANCIONES}
            />
          }
        />

              <Route
        path="/creditos/:id"
        element={<CreditosImagenes {...userProps} />}
      />

        <Route
          path="/albumes"
          element={
            <Albumes
              {...profileProps}
              nuevosAlbumes={nuevosAlbumes}
            />
          }
        />

        <Route
          path="/canciones"
          element={
            <Canciones
              {...profileProps}
              cancionesFavs={cancionesFavs}
            />
          }
        />

        <Route
          path="/perfil"
          element={<Perfil {...profileProps} />}
        />

        <Route
          path="/perfil/:idVisitado"
          element={<Perfil {...profileProps} />}
        />

        <Route path="/cuenta" element={<Cuenta {...userProps} tokenSpotify={tokenSpotify} onSession={acceptSession} connectionError={loginError} />} />
        <Route
  path="/player"
  element={
    <ReproductorEstetico
      username={usuario}
      modoDecorativo
    />
  }
/>

        <Route
          path="/about"
          element={<About {...userProps} />}
        />

        <Route
          path="/privacidad"
          element={<Privacidad {...userProps} />}
        />

        <Route
          path="/terminos"
          element={<Terminos {...userProps} />}
        />

        <Route
          path="/contacto"
          element={<Contacto {...userProps} />}
        />
      </Routes>

      <Footer />

      <Reproductor
        tokenSpotify={tokenSpotify}
        username={usuario}
      />
    </Suspense>
  );
}