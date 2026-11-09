import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '../lib/api';
import { PaginaInformativa } from './About';

export default function CreditosImagenes(props) {
  const { id } = useParams();
  const [intento, setIntento] = useState(0);
  const [estado, setEstado] = useState({
    cargando: true,
    error: '',
    items: [],
  });

  useEffect(() => {
    const controller = new AbortController();
    let activo = true;

    setEstado({
      cargando: true,
      error: '',
      items: [],
    });

    const temporizador = window.setTimeout(() => {
      controller.abort();
    }, 15000);

    async function cargar() {
      try {
        // Esta consulta es pública y no necesita enviar la sesión.
        const respuesta = await fetch(
          `${API_BASE_URL}/image-credits/${encodeURIComponent(id)}`,
          {
            signal: controller.signal,
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
          }
        );

        if (respuesta.status === 404) {
          throw new Error('No encontramos esta página de créditos.');
        }

        if (!respuesta.ok) {
          throw new Error(
            'No pudimos cargar los créditos. Inténtalo de nuevo.'
          );
        }

        const datos = await respuesta.json();

        if (!Array.isArray(datos.items)) {
          throw new Error('La respuesta de los créditos no es válida.');
        }

        if (activo) {
          setEstado({
            cargando: false,
            error: '',
            items: datos.items,
          });
        }
      } catch (error) {
        if (!activo) return;

        setEstado({
          cargando: false,
          error: error.name === 'AbortError'
            ? 'La consulta tardó demasiado. Inténtalo de nuevo.'
            : error.message || 'No pudimos cargar los créditos.',
          items: [],
        });
      } finally {
        window.clearTimeout(temporizador);
      }
    }

    cargar();

    return () => {
      activo = false;
      window.clearTimeout(temporizador);
      controller.abort();
    };
  }, [id, intento]);

  return (
    <PaginaInformativa
      {...props}
      titulo="Créditos de imágenes"
      introduccion="Autores, fuentes y licencias de las imágenes de esta selección."
    >
      {estado.cargando && (
        <p role="status">Cargando créditos…</p>
      )}

      {estado.error && (
        <section>
          <p role="alert">{estado.error}</p>

          <button
            type="button"
            onClick={() => setIntento(valor => valor + 1)}
          >
            Volver a intentar
          </button>
        </section>
      )}

      {!estado.cargando && !estado.error && (
        <div style={{ overflowWrap: 'anywhere' }}>
          {estado.items.map((item, indice) => (
            <section key={`${indice}-${item.nombre}`}>
              <h2>{item.nombre}</h2>

              {item.textos.map((texto, posicion) => (
                <p key={posicion}>{texto}</p>
              ))}

              <ul>
                {item.enlaces.map((enlace, posicion) => (
                  <li key={posicion}>
                    <a
                      href={enlace.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                    >
                      {enlace.etiqueta}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </PaginaInformativa>
  );
}