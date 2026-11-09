import { useEffect, useRef, useState } from 'react';
import { FiSearch, FiX } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { API_BASE_URL as API, apiFetch } from '../lib/api';
import { obtenerFotoPerfil } from '../lib/profilePhoto';

import './ListaAmigosPerfil.css';



const SIN_FOTO = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#b6b6b6"/><circle cx="50" cy="36" r="17" fill="#858585"/><path d="M18 100v-13a32 32 0 0 1 64 0v13" fill="#858585"/></svg>'
)}`;

const ordenar = lista =>
  [...lista].sort((a, b) =>
    String(a.nombre || '').localeCompare(
      String(b.nombre || ''),
      'es'
    )
  );

async function leer(ruta, signal) {
  const response = await apiFetch(
    `${API}${ruta}`,
    { signal }
  );

  if (!response.ok) throw new Error();

  const data = await response.json();

  if (!Array.isArray(data)) throw new Error();

  return data;
}

function Amigos({
  mi_id,
  id_perfil_activo,
  esMiPerfil,
}) {
  const [siguiendo, setSiguiendo] = useState([]);
  const [seguidores, setSeguidores] = useState([]);
  const [misSeguidos, setMisSeguidos] = useState([]);

  const [pestana, setPestana] = useState('siguiendo');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  const [busqueda, setBusqueda] = useState('');
  const [resultado, setResultado] = useState({
    clave: '',
    datos: [],
    error: '',
  });

  const [
    reintentoBusqueda,
    setReintentoBusqueda,
  ] = useState(0);

  const [guardando, setGuardando] = useState(null);
  const [errorGuardar, setErrorGuardar] = useState('');
  const [aviso, setAviso] = useState('');

  const peticion = useRef(null);

  const q = busqueda.trim();
  const buscando = esMiPerfil && q.length >= 2;
  const claveBusqueda = `${q}|${reintentoBusqueda}`;

  useEffect(() => {
    const controller = new AbortController();

    async function cargar() {
      try {
        if (!id_perfil_activo) throw new Error();

        const perfil = encodeURIComponent(
          id_perfil_activo
        );

        const [mios, seguidos, fans] = await Promise.all([
          mi_id
            ? leer(
                `/api/usuarios/${
                  encodeURIComponent(mi_id)
                }/siguiendo`,
                controller.signal
              )
            : Promise.resolve([]),

          leer(
            `/api/usuarios/${perfil}/lista-siguiendo`,
            controller.signal
          ),

          leer(
            `/api/usuarios/${perfil}/lista-seguidores`,
            controller.signal
          ),
        ]);

        if (controller.signal.aborted) return;

        setMisSeguidos(mios.map(String));
        setSiguiendo(ordenar(seguidos));
        setSeguidores(ordenar(fans));
      } catch {
        if (!controller.signal.aborted) {
          setError(
            'No pudimos cargar los usuarios. Inténtalo de nuevo.'
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
  }, [mi_id, id_perfil_activo, intento]);

  useEffect(() => {
    if (!buscando) return;

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const datos = await leer(
          `/api/usuarios/buscar?q=${
            encodeURIComponent(q)
          }`,
          controller.signal
        );

        if (!controller.signal.aborted) {
          setResultado({
            clave: claveBusqueda,
            datos: ordenar(
              datos.filter(
                user =>
                  String(user.id_echohead) !==
                  String(mi_id)
              )
            ),
            error: '',
          });
        }
      } catch {
        if (!controller.signal.aborted) {
          setResultado({
            clave: claveBusqueda,
            datos: [],
            error: 'No pudimos completar la búsqueda.',
          });
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [buscando, q, claveBusqueda, mi_id]);

  useEffect(() => {
    return () => peticion.current?.abort();
  }, []);

  async function toggleSeguir(usuario) {
    if (
      !mi_id ||
      cargando ||
      error ||
      peticion.current ||
      String(usuario.id_echohead) === String(mi_id)
    ) {
      return;
    }

    const id = String(usuario.id_echohead);
    const yaSigo = misSeguidos.includes(id);
    const controller = new AbortController();

    peticion.current = controller;

    const timer = setTimeout(
      () => controller.abort(),
      15000
    );

    setGuardando(id);
    setErrorGuardar('');

    try {
      const response = await apiFetch(
        `${API}/api/seguidores`,
        {
          method: yaSigo ? 'DELETE' : 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            seguidor_id: mi_id,
            seguido_id: usuario.id_echohead,
          }),
        }
      );

      if (!response.ok) throw new Error();

      setMisSeguidos(prev =>
        yaSigo
          ? prev.filter(value => value !== id)
          : [...prev, id]
      );

      if (
        String(mi_id) === String(id_perfil_activo)
      ) {
        setSiguiendo(prev =>
          yaSigo
            ? prev.filter(
                user =>
                  String(user.id_echohead) !== id
              )
            : ordenar([
                ...prev.filter(
                  user =>
                    String(user.id_echohead) !== id
                ),
                usuario,
              ])
        );
      }

      setAviso(
        yaSigo
          ? `Dejaste de seguir a ${usuario.nombre}.`
          : `Ahora sigues a ${usuario.nombre}.`
      );
    } catch {
      setErrorGuardar(
        `No pudimos actualizar a ${usuario.nombre}. Inténtalo de nuevo.`
      );
    } finally {
      clearTimeout(timer);
      peticion.current = null;
      setGuardando(null);
    }
  }

  const esperandoBusqueda =
    buscando && resultado.clave !== claveBusqueda;

  const lista = buscando
    ? esperandoBusqueda
      ? []
      : resultado.datos
    : pestana === 'siguiendo'
      ? siguiendo
      : seguidores;

  return (
    <section className="eaf" aria-label="Amigos">
      <div className="eaf-header">
        <div>
          <h2>Amigos</h2>

          <p>
            {esMiPerfil
              ? 'Encuentra a quienes comparten tu gusto por la música.'
              : 'Las conexiones de este perfil.'}
          </p>
        </div>

        {esMiPerfil && (
          <div className="eaf-search">
            <FiSearch aria-hidden="true" />

            <input
              type="search"
              aria-label="Buscar usuarios"
              placeholder="Buscar usuarios por nombre"
              value={busqueda}
              onChange={event =>
                setBusqueda(event.target.value)
              }
            />

            {busqueda && (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => setBusqueda('')}
              >
                <FiX />
              </button>
            )}
          </div>
        )}
      </div>

      <div
        className="eaf-tabs"
        role="group"
        aria-label="Lista de usuarios"
      >
        {[
          ['siguiendo', 'Siguiendo', siguiendo.length],
          ['seguidores', 'Seguidores', seguidores.length],
        ].map(([value, label, cantidad]) => (
          <button
            key={value}
            type="button"
            aria-pressed={
              !buscando && pestana === value
            }
            onClick={() => {
              setPestana(value);
              setBusqueda('');
            }}
          >
            {label}

            <span>
              {cargando || error ? '—' : cantidad}
            </span>
          </button>
        ))}
      </div>

      <p className="eaf-sr" role="status">
        {aviso}
      </p>

      {errorGuardar && (
        <p className="eaf-notice" role="alert">
          {errorGuardar}
        </p>
      )}

      {busqueda && !buscando && (
        <p className="eaf-hint">
          Escribe al menos dos caracteres para buscar.
        </p>
      )}

      {cargando ? (
        <p className="eaf-state" role="status">
          Cargando usuarios…
        </p>
      ) : error ? (
        <div className="eaf-state" role="alert">
          <p>{error}</p>

          <button
            type="button"
            onClick={() => {
              setError('');
              setCargando(true);
              setIntento(value => value + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      ) : esperandoBusqueda ? (
        <p className="eaf-state" role="status">
          Buscando usuarios…
        </p>
      ) : buscando && resultado.error ? (
        <div className="eaf-state" role="alert">
          <p>{resultado.error}</p>

          <button
            type="button"
            onClick={() =>
              setReintentoBusqueda(value => value + 1)
            }
          >
            Reintentar búsqueda
          </button>
        </div>
      ) : !lista.length ? (
        <p className="eaf-state">
          {buscando
            ? 'No encontramos usuarios con ese nombre.'
            : pestana === 'siguiendo'
              ? esMiPerfil
                ? 'Todavía no sigues a nadie.'
                : 'Este usuario todavía no sigue a nadie.'
              : esMiPerfil
                ? 'Todavía no tienes seguidores.'
                : 'Este usuario todavía no tiene seguidores.'}
        </p>
      ) : (
        <ul className="eaf-list">
          {lista.map(usuario => {
            const id = String(usuario.id_echohead);
            const sigo = misSeguidos.includes(id);

            return (
              <li key={id}>
                <Link
                  to={`/perfil/${encodeURIComponent(id)}`}
                  className="eaf-person"
                >
                  <img
                    src={obtenerFotoPerfil(usuario) || SIN_FOTO}
                    alt=""
                    loading="lazy"
                    onError={event => {
                      if (
                        event.currentTarget.src !== SIN_FOTO
                      ) {
                        event.currentTarget.src = SIN_FOTO;
                      }
                    }}
                  />

                  <span>
                    {usuario.nombre || 'Usuario'}
                  </span>
                </Link>

                {mi_id && id !== String(mi_id) && (
                  <button
                    type="button"
                    className="eaf-follow"
                    aria-pressed={sigo}
                    aria-label={`${
                      sigo
                        ? 'Dejar de seguir a'
                        : 'Seguir a'
                    } ${usuario.nombre}`}
                    disabled={guardando !== null}
                    onClick={() => toggleSeguir(usuario)}
                  >
                    {guardando === id
                      ? 'Guardando…'
                      : sigo
                        ? 'Siguiendo'
                        : 'Seguir'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function ListaAmigosPerfil(props) {
  return (
    <Amigos
      key={`${props.mi_id}-${props.id_perfil_activo}-${props.esMiPerfil}`}
      {...props}
    />
  );
}