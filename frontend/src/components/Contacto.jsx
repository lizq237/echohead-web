import { Link } from 'react-router-dom';
import {
    CorreoContacto,
    DatosLegales,
    PaginaInformativa,
} from './About';

export default function Contacto(props) {
  return (
    <PaginaInformativa
      {...props}
      titulo="Hablemos"
      introduccion="Dudas, sugerencias y reportes sobre EchoHead."
    >
      <section>
        <h2>Responsable y contacto</h2>

        <DatosLegales />

        <p>
          Usa este canal para asuntos relacionados con EchoHead.
          Los problemas de facturación o acceso a Spotify deben
          dirigirse a su propio soporte.
        </p>
      </section>

      <section>
        <h2>Ayuda con la aplicación</h2>

        <p>
          Describe qué intentabas hacer, qué ocurrió y qué
          dispositivo o navegador utilizas. Si adjuntas una
          captura, oculta correos, datos de otras personas y
          cualquier información privada que no sea necesaria.
        </p>

        <p>
          <CorreoContacto asunto="Soporte de EchoHead" />
        </p>

        <p>
          No envíes contraseñas, tokens de acceso ni códigos
          de inicio de sesión.
        </p>
      </section>

      <section>
        <h2>Privacidad y eliminación de datos</h2>

        <p>
          Para solicitar acceso, rectificación, cancelación u
          oposición al tratamiento de tus datos, indica tu
          perfil, lo que solicitas y un medio para responderte.
          Consulta el procedimiento en el{' '}
          <Link to="/privacidad">aviso de privacidad</Link>.
        </p>

        <p>
          <CorreoContacto
            asunto="Privacidad y datos personales — EchoHead"
          />
        </p>

        <p>
          No adjuntes una identificación oficial en el primer
          mensaje. Si hace falta verificar tu identidad, se debe
          solicitar únicamente lo necesario mediante un canal
          apropiado.
        </p>
      </section>

      <section>
        <h2>Reportar contenido o una infracción de derechos</h2>

        <p>
          Incluye el enlace al perfil o contenido, una explicación
          del problema y cómo podemos contactarte. Si reclamas
          derechos de autor, identifica la obra y tu relación
          con sus derechos o con su titular.
        </p>

        <p>
          <CorreoContacto
            asunto="Reporte de contenido — EchoHead"
          />
        </p>

        <p>
          Evita reenviar públicamente contenido dañino o datos
          privados. La recepción de un reporte no supone por
          sí sola que exista una infracción.
        </p>
      </section>

      <section>
        <h2>Reportar un problema de seguridad</h2>

        <p>
          Describe el problema de forma privada. No accedas
          a cuentas ajenas, descargues bases de datos ni alteres
          información para demostrarlo.
        </p>

        <p>
          <CorreoContacto
            asunto="Reporte de seguridad — EchoHead"
          />
        </p>
      </section>

      <section>
        <h2>Seguimiento</h2>

        <p>
          No ofrecemos atención inmediata ni garantizamos una
          respuesta en 48 horas. Las solicitudes de datos
          personales se atenderán conforme a los plazos legales
          aplicables; estos no se sustituyen por los tiempos
          de soporte general.
        </p>
      </section>
    </PaginaInformativa>
  );
}