import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AccountAccess from '../components/AccountAccess';
import Navbar from '../components/Navbar';
import { accountRequest } from '../lib/accounts';
import { API_BASE_URL, apiFetch } from '../lib/api';

const erroresLastfm = new Map([
  ['sin-autorizacion', 'No se completó la autorización en Last.fm.'],
  [
    'intento-invalido',
    'Este intento de conexión ya no está vigente. Vuelve a conectar.',
  ],
  ['error', 'No pudimos conectar con Last.fm. Inténtalo de nuevo.'],
]);

export default function Cuenta({
  username,
  fotoPerfil,
  tokenSpotify,
  onSession,
  connectionError,
}) {
  const [account, setAccount] = useState(null);
  const [errorCuenta, setErrorCuenta] = useState('');
  const [errorConexion, setErrorConexion] = useState('');
  const [busy, setBusy] = useState(null);
  const [attempt, setAttempt] = useState(0);

  const resultadoLastfm = new URLSearchParams(window.location.search).get('lastfm');
  const errorLastfm = erroresLastfm.get(resultadoLastfm);
  const usuarioLastfm = account?.lastfm_username;

  useEffect(() => {
    const controller = new AbortController();

    async function cargarCuenta() {
      try {
        const response = await apiFetch(`${API_BASE_URL}/auth/account`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('No pudimos cargar tu cuenta.');
        }

        const datos = await response.json();

        if (!controller.signal.aborted) {
          setAccount(datos);
          setErrorCuenta('');
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setErrorCuenta(err.message || 'No pudimos cargar tu cuenta.');
        }
      }
    }

    cargarCuenta();

    return () => controller.abort();
  }, [attempt]);

  async function connect(servicio) {
    setBusy(servicio);
    setErrorConexion('');

    try {
      const { url } = await accountRequest(`/auth/${servicio}/connect`, {});
      window.location.assign(url);
    } catch (err) {
      setErrorConexion(err.message || 'No pudimos iniciar la conexión.');
      setBusy(null);
    }
  }

  function reintentarCuenta() {
    setErrorCuenta('');
    setAttempt(valor => valor + 1);
  }

  return (
    <div className="eh-account-page">
      <Navbar username={username} fotoPerfil={fotoPerfil} />

      <main className="eh-account-main">
        <h1>Tu cuenta</h1>
        <p>Administra tu acceso a EchoHead y tus conexiones con Spotify y Last.fm.</p>

        {connectionError && <p role="alert">{connectionError}</p>}
        {errorConexion && <p role="alert">{errorConexion}</p>}

        <section aria-labelledby="eh-account-spotify">
          <h2 id="eh-account-spotify">Spotify</h2>

          <p>
            {tokenSpotify
              ? 'Conectado en esta sesión.'
              : 'No hay una conexión activa en esta sesión.'}
          </p>

          <p>
            La conexión directa con Spotify está disponible para los usuarios
            autorizados de nuestra beta.
          </p>

          <button
            type="button"
            onClick={() => connect('spotify')}
            disabled={Boolean(busy)}
          >
            {busy === 'spotify'
              ? 'Conectando…'
              : tokenSpotify
                ? 'Volver a conectar Spotify'
                : 'Conectar Spotify'}
          </button>

          <p>
            Sin conexión puedes seguir buscando, calificando y guardando música.{' '}
            <Link to="/albumes">Buscar álbumes</Link>
          </p>
        </section>

        <section aria-labelledby="eh-account-lastfm">
          <h2 id="eh-account-lastfm">Last.fm</h2>

          {usuarioLastfm ? (
            <p>
              Cuenta vinculada: <strong>{usuarioLastfm}</strong>.
            </p>
          ) : (
            account && (
              <p>
                Vincula Last.fm para ver tus artistas, álbumes y canciones
                más escuchados en «Tu mes en bucle».
              </p>
            )
          )}

          {resultadoLastfm === 'conectado' && usuarioLastfm && (
            <p role="status">Conexión completada.</p>
          )}

          {errorLastfm && <p role="alert">{errorLastfm}</p>}

          {usuarioLastfm && (
            <details className="eh-lastfm-guide">
  <summary>
    Configurar mis escuchas de Spotify
    <span className="eh-lastfm-guide__arrow" aria-hidden="true">⌄</span>
  </summary>

  <div className="eh-lastfm-guide__body">
    <ol>
      <li>
        Abre Last.fm con tu usuario <strong>{usuarioLastfm}</strong>.
      </li>
      <li>
        Busca <strong>Spotify</strong>, pulsa <strong>Connect</strong> y
        autoriza la cuenta que usas para escuchar música.
      </li>
      <li>
        Reproduce una canción completa y comprueba que aparezca en tus
        escuchas recientes de Last.fm.
      </li>
    </ol>

    <a
      className="eh-lastfm-guide__link"
      href="https://www.last.fm/about/trackmymusic"
      target="_blank"
      rel="noopener noreferrer"
    >
      Configurar en Last.fm <span aria-hidden="true">↗</span>
    </a>
  </div>
</details>
          )}

          <button
            type="button"
            onClick={() => connect('lastfm')}
            disabled={Boolean(busy) || !account}
          >
            {busy === 'lastfm'
              ? 'Conectando…'
              : usuarioLastfm
                ? 'Volver a conectar Last.fm'
                : 'Conectar con Last.fm'}
          </button>
        </section>

        <section aria-labelledby="eh-account-access-heading">
          <h2 id="eh-account-access-heading">Acceso a EchoHead</h2>

          {errorCuenta && (
            <>
              <p role="alert">{errorCuenta}</p>
              <button type="button" onClick={reintentarCuenta}>
                Reintentar
              </button>
            </>
          )}

          {!account && !errorCuenta && <p role="status">Cargando…</p>}

          {account && (
            <>
              <p>
                {account.username
                  ? `Tu usuario es ${account.username}.`
                  : 'Añade usuario y contraseña a este mismo perfil. Tus reseñas y favoritos se conservan.'}
              </p>

              <AccountAccess
                key={account.username || 'attach'}
                existing
                accountName={account.username}
                onSession={data => {
                  onSession(data);
                  reintentarCuenta();
                }}
              />
            </>
          )}
        </section>
      </main>
    </div>
  );
}