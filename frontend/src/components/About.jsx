import { Link, NavLink } from 'react-router-dom';
import './About.css';
import Footer from './Footer';
import Navbar from './Navbar';

// Completar únicamente con información real y verificada.
// Estos datos se muestran públicamente.
// No incluir secretos, contraseñas ni credenciales.
const DATOS_LEGALES = {
  responsable: '',
  domicilio: '',
  correo: '',
  proveedores: '',
  conservacion: '',
  seguridad: '',
  cookies: '',
  elegibilidad: '',
};

// Mantener true hasta completar los datos, la revisión jurídica
// y la verificación de seguridad, consentimiento y borrado.
const REVISION_PENDIENTE = true;

const FECHA_DOCUMENTO = '25 de octubre de 2026';

const ETIQUETAS = {
  responsable: 'Responsable del servicio y de los datos',
  domicilio: 'Domicilio del responsable',
  correo: 'Correo de contacto',
  proveedores:
    'Proveedores, ubicación del tratamiento y transferencias',
  conservacion:
    'Plazos de conservación, eliminación y respaldos',
  seguridad: 'Medidas de seguridad verificadas',
  cookies:
    'Cookies, registros técnicos y servicios de terceros',
  elegibilidad:
    'Edad mínima y condiciones de acceso de menores',
};

export function CorreoContacto({
  asunto = 'Consulta sobre EchoHead',
}) {
  const correo = DATOS_LEGALES.correo.trim();

  if (!correo) {
    return (
      <span className="eh-info__pendiente">
        Correo pendiente de confirmar.
      </span>
    );
  }

  return (
    <a
      href={`mailto:${correo}?subject=${encodeURIComponent(asunto)}`}
    >
      {correo}
    </a>
  );
}

export function DatosLegales({
  campos = ['responsable', 'domicilio', 'correo'],
}) {
  return (
    <dl className="eh-info__datos">
      {campos.map(campo => (
        <div key={campo}>
          <dt>{ETIQUETAS[campo]}</dt>

          <dd>
            {campo === 'correo' ? (
              <CorreoContacto />
            ) : (
              DATOS_LEGALES[campo].trim() || (
                <span className="eh-info__pendiente">
                  Pendiente de completar y verificar.
                </span>
              )
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function PaginaInformativa({
  titulo,
  introduccion,
  username,
  fotoPerfil,
  publicView = false,
  documento = false,
  children,
}) {
  return (
    <div className="eh-info">
      {publicView ? (
        <header className="eh-info__cabecera">
          <Link
            to="/"
            className="eh-info__marca"
            aria-label="EchoHead, inicio"
          >
            <svg viewBox="0 0 96 96" aria-hidden="true">
              <path
                fill="currentColor"
                fillRule="evenodd"
                clipRule="evenodd"
                d="M48 5C24.25 5 5 24.25 5 48s19.25 43 43 43h37V58H48c-5.52 0-10-4.48-10-10s4.48-10 10-10h37V5H48Zm0 16c-14.91 0-27 12.09-27 27s12.09 27 27 27h21v-7H48c-11.05 0-20-8.95-20-20s8.95-20 20-20h21v-7H48Z"
              />
              <path
                fill="#1DB954"
                d="M69 38h16v20H69z"
              />
            </svg>

            <span>
              echo<em>head</em>
            </span>
          </Link>

          <Link to="/">Volver al inicio</Link>
        </header>
      ) : (
        <Navbar
          username={username}
          fotoPerfil={fotoPerfil}
        />
      )}

      <main className="eh-info__main">
        <header className="eh-info__intro">
          <p className="eh-info__etiqueta">
            ECHOHEAD / INFORMACIÓN
          </p>

          <h1>{titulo}</h1>

          <p className="eh-info__resumen">
            {introduccion}
          </p>

          {documento && (
            <p className="eh-info__fecha">
              {REVISION_PENDIENTE
                ? 'Borrador preparado'
                : 'Última actualización'}
              : {FECHA_DOCUMENTO}
            </p>
          )}
        </header>

        <nav
          className="eh-info__nav"
          aria-label="Información de EchoHead"
        >
          <NavLink to="/about">
            Sobre EchoHead
          </NavLink>

          <NavLink to="/privacidad">
            Privacidad
          </NavLink>

          <NavLink to="/terminos">
            Términos
          </NavLink>

          <NavLink to="/contacto">
            Contacto
          </NavLink>
        </nav>

        {REVISION_PENDIENTE && (
          <aside
            className="eh-info__aviso"
            aria-label="Estado del documento"
          >
            <strong>Versión en revisión</strong>

            <p>
              Faltan datos del responsable y verificaciones de
              funcionamiento. Este contenido todavía no es la
              versión definitiva para el lanzamiento público.
            </p>
          </aside>
        )}

        <div className="eh-info__contenido">
          {children}
        </div>
      </main>

      {publicView && <Footer />}
    </div>
  );
}

export default function About(props) {
  return (
    <PaginaInformativa
      {...props}
      titulo="Sobre EchoHead"
      introduccion="Un lugar para recordar lo que escuchas y compartir lo que te hace sentir."
    >
      <section>
        <h2>Tu historia también se escucha</h2>

        <p>
          EchoHead es un diario musical: puedes descubrir álbumes
          y canciones, calificarlos, escribir reseñas y organizar
          tus favoritos y escuchas pendientes.
        </p>

        <p>
          Tu perfil reúne tus elecciones y te permite descubrir
          las de otras personas. Las reseñas y calificaciones
          expresan opiniones de sus autores.
        </p>
      </section>

      <section>
        <h2>Un proyecto independiente</h2>

        <p>
          EchoHead nació en Culiacán, Sinaloa, como un proyecto
          de desarrollo web y una forma de unir música, diseño
          y comunidad. Está en desarrollo y sus funciones
          pueden cambiar durante las pruebas.
        </p>
      </section>

      <section>
        <h2>Cómo se conecta con Spotify</h2>

        <p>
          Utilizamos la API de Spotify para consultar información
          musical y ofrecer las funciones autorizadas al conectar
          tu cuenta. Su disponibilidad depende de los permisos,
          la cuenta y las condiciones de Spotify.
        </p>

        <p>
          EchoHead no está patrocinado, certificado ni respaldado
          por Spotify. Las marcas, portadas y demás contenidos
          de terceros pertenecen a sus respectivos titulares.
          Su presencia aquí no transfiere derechos sobre ellos.
        </p>
      </section>

      <section>
        <h2>Información y contacto</h2>

        <p>
          Consulta el{' '}
          <Link to="/privacidad">aviso de privacidad</Link>
          {' '}y los{' '}
          <Link to="/terminos">términos de uso</Link>.
          Para dudas o reportes, visita{' '}
          <Link to="/contacto">Contacto</Link>.
        </p>
      </section>
    </PaginaInformativa>
  );
}