import { useState } from 'react';
import { FiLogOut, FiSearch, FiSettings } from 'react-icons/fi';
import { PiVinylRecordLight } from 'react-icons/pi';
import { Link, NavLink } from 'react-router-dom';
import { hasSession, logout } from '../lib/api';
import '../pages/Inicio.css';
import './NavbarActions.css';

function Navbar({ username = 'Mi perfil', fotoPerfil }) {
  const [saliendo, setSaliendo] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [errorSalir, setErrorSalir] = useState('');

  function cerrarMenu() {
    setMenuAbierto(false);
  }

  async function cerrarSesion() {
    if (saliendo) return;

    cerrarMenu();
    setSaliendo(true);
    setErrorSalir('');

    try {
      await logout();
    } catch (error) {
      setErrorSalir(error?.message || 'No pudimos cerrar la sesión.');
      setSaliendo(false);
    }
  }

  function abrirTocadiscos() {
    cerrarMenu();
    window.dispatchEvent(new Event('abrir-tocadiscos'));
  }

  return (
    <header className="Navbar eh-nav">
      <div className="eh-nav__inner">
        <Link
          to="/"
          className="eh-brand"
          aria-label="EchoHead, inicio"
          onClick={cerrarMenu}
        >
          <svg viewBox="0 0 96 96" aria-hidden="true">
            <path
              fill="currentColor"
              fillRule="evenodd"
              clipRule="evenodd"
              d="M48 5C24.25 5 5 24.25 5 48s19.25 43 43 43h37V58H48c-5.52 0-10-4.48-10-10s4.48-10 10-10h37V5H48Zm0 16c-14.91 0-27 12.09-27 27s12.09 27 27 27h21v-7H48c-11.05 0-20-8.95-20-20s8.95-20 20-20h21v-7H48Z"
            />
            <path fill="#1DB954" d="M69 38h16v20H69z" />
          </svg>

          <span>
            echo<span className="eh-brand__head">head</span>
          </span>
        </Link>

        <button
          type="button"
          className="eh-nav__menu-toggle"
          aria-expanded={menuAbierto}
          aria-controls="eh-nav-acciones"
          onClick={() => setMenuAbierto(abierto => !abierto)}
        >
          {menuAbierto ? 'Cerrar menú' : 'Menú'}
        </button>

        <nav className="eh-nav__links" aria-label="Navegación principal">
          <NavLink to="/" end onClick={cerrarMenu}>Inicio</NavLink>
          <NavLink to="/albumes" onClick={cerrarMenu}>Álbumes</NavLink>
          <NavLink to="/canciones" onClick={cerrarMenu}>Canciones</NavLink>
        </nav>

        <div
          id="eh-nav-acciones"
          className={`eh-nav__actions${menuAbierto ? ' eh-nav__actions--abiertas' : ''}`}
        >
          {hasSession() && (
            <>
              <Link
                to="/cuenta"
                className="eh-nav-action"
                aria-label="Configuración y conexiones"
                title="Configuración y conexiones"
                onClick={cerrarMenu}
              >
                <FiSettings aria-hidden="true" />
              </Link>

              <button
                type="button"
                className="eh-nav-action"
                aria-label={saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
                title={saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
                disabled={saliendo}
                aria-busy={saliendo}
                onClick={cerrarSesion}
              >
                <FiLogOut aria-hidden="true" />
              </button>
            </>
          )}

          <Link
            to="/albumes"
            className="eh-nav__search"
            aria-label="Buscar álbumes"
            onClick={cerrarMenu}
          >
            <FiSearch aria-hidden="true" />
            <span>Buscar álbumes</span>
          </Link>

          <Link
            to="/perfil"
            className="eh-nav__profile"
            aria-label={`Ver perfil de ${username}`}
            onClick={cerrarMenu}
          >
            <span className="eh-nav__avatar" aria-hidden="true">
              {fotoPerfil ? (
                <img src={fotoPerfil} alt="" />
              ) : (
                (username || 'E').charAt(0)
              )}
            </span>
            <span className="eh-nav__username">{username}</span>
          </Link>

          <button
            type="button"
            className="eh-nav__player"
            aria-label="Abrir tocadiscos"
            title="Abrir tocadiscos"
            onClick={abrirTocadiscos}
          >
            <PiVinylRecordLight aria-hidden="true" />
          </button>
        </div>

        {errorSalir && <span role="alert">{errorSalir}</span>}
      </div>
    </header>
  );
}

export default Navbar;