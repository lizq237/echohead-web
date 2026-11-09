import { Link } from 'react-router-dom';
import {
    CorreoContacto,
    DatosLegales,
    PaginaInformativa,
} from './About';

export default function Privacidad(props) {
  return (
    <PaginaInformativa
      {...props}
      documento
      titulo="Aviso de privacidad"
      introduccion="Qué información utiliza EchoHead, para qué y cómo puedes ejercer tus derechos."
    >
      <section>
        <h2>1. Responsable</h2>

        <DatosLegales />

        <p>
          Este aviso corresponde al tratamiento de datos
          realizado por EchoHead. Spotify tiene su propio{' '}
          <a href="https://www.spotify.com/legal/privacy-policy/">
            aviso de privacidad
          </a>.
        </p>
      </section>

      <section>
        <h2>2. Datos que utilizamos</h2>

        <ul>
          <li>
            <strong>Cuenta:</strong> identificador de EchoHead, nombre visible,
            usuario de acceso y foto. Si conectas Spotify, también su identificador
            y el correo electrónico que proporcione. Para el acceso propio guardamos
            un hash de contraseña y un hash de la clave de recuperación, no sus valores originales.
          </li>

          <li>
            <strong>Actividad en EchoHead:</strong> descripción
            del perfil, reseñas, calificaciones, favoritos,
            escuchados, pendientes y relaciones de seguimiento.
          </li>

          <li>
            <strong>Conexión con Spotify:</strong> autorizaciones
            y tokens de acceso, biblioteca musical, principales
            canciones y artistas, y estado de reproducción,
            según los permisos concedidos y las funciones
            utilizadas.
          </li>

          <li>
            <strong>Preferencias:</strong> personalización
            del tocadiscos guardada en el navegador.
          </li>

          <li>
            <strong>Contacto:</strong> dirección de respuesta
            y contenido de las solicitudes que nos envíes.
          </li>
        </ul>

        <p>
          Puedes entrar con una cuenta propia de EchoHead o conectar Spotify.
          EchoHead nunca te pide la contraseña de Spotify. La contraseña de EchoHead
          se procesa para verificar tu acceso. La clave de recuperación se muestra
          una vez al crearla o renovarla; debes guardarla de forma segura.
          No solicitamos datos personales sensibles. Evita incluir información
          sensible o datos de otras personas en tu biografía
          o reseñas.
        </p>
      </section>

      <section>
        <h2>3. Para qué usamos la información</h2>

        <p>
          Para identificar tu cuenta, guardar y mostrar tus
          registros musicales, permitir las funciones sociales,
          consultar la información musical autorizada, ejecutar
          los controles de reproducción que solicites y atender
          tus consultas y solicitudes de privacidad.
        </p>

        <p>
          Estas finalidades no incluyen vender tus datos ni
          utilizarlos para publicidad basada en tus hábitos de
          escucha. Una finalidad adicional deberá informarse
          y contar con el consentimiento correspondiente
          cuando sea necesario.
        </p>
      </section>

      <section>
        <h2>4. Información visible para otras personas</h2>

        <p>
          Los perfiles están diseñados para compartir nombre
          visible, foto, biografía, selecciones musicales,
          reseñas, calificaciones y relaciones de seguimiento.
          Las listas que aparecen al visitar un perfil,
          incluidos sus pendientes, deben considerarse visibles
          para otros usuarios.
        </p>

        <p>
          No publiques información que quieras mantener privada.
          Compartir una imagen descargada de tu perfil también
          puede revelar su contenido a quienes la reciban.
        </p>

        <p className="eh-info__nota">
          La separación entre información pública y privada
          está pendiente de verificación. Esta versión en
          revisión no debe utilizarse como aviso definitivo
          para abrir el registro al público.
        </p>
      </section>

      <section>
        <h2>5. Proveedores y comunicaciones de datos</h2>

        <p>
          La conexión con Spotify implica intercambiar
          información con ese servicio. Cargar imágenes externas
          y utilizar alojamiento, base de datos o correo también
          puede implicar el tratamiento de datos por sus
          proveedores.
        </p>

        <p>Las búsquedas del catálogo independiente se envían desde nuestro servidor
          a MusicBrainz sin incluir tu usuario ni tus reseñas. Guardamos temporalmente
          resultados en una caché de cinco minutos. Las portadas se cargan desde
          Cover Art Archive, que puede redirigir al alojamiento de Internet Archive;
          estos servicios reciben la dirección IP y datos técnicos de tu navegador.
          Las portadas conservan los derechos de sus titulares.</p>
        <DatosLegales campos={['proveedores']} />

        <p>
          Antes de publicar la versión definitiva deben
          identificarse los proveedores utilizados, sus
          funciones, los países involucrados y las transferencias
          que correspondan. No se presume que toda comunicación
          esté autorizada.
        </p>
      </section>

      <section>
        <h2>6. Almacenamiento en tu dispositivo</h2>

        <p>
          La personalización del tocadiscos se conserva en el
          almacenamiento local del navegador. Puedes eliminarla
          borrando los datos de este sitio desde la configuración
          del navegador; esto no elimina tu cuenta ni tus reseñas
          del servidor.
        </p>

        <p>Usamos una cookie de sesión HttpOnly que puede durar hasta 12 horas.
          Al cerrar sesión se revoca en el servidor. La autorización temporal de
          Spotify dura hasta 10 minutos mientras se completa la conexión; su token
          de acceso permanece en memoria del navegador. También conservamos
          contadores temporales de intentos de acceso para limitar abusos.</p>
        <DatosLegales campos={['cookies']} />
      </section>

      <section>
        <h2>7. Conservación y seguridad</h2>

        <DatosLegales
          campos={['conservacion', 'seguridad']}
        />

        <p>
          No afirmamos que el sistema sea invulnerable ni que
          cuente con una certificación de seguridad. Esto no
          elimina las obligaciones de protección de datos
          del responsable.
        </p>

        <p>
          Antes del lanzamiento deben quedar definidos y
          comprobados los plazos de conservación, el borrado
          de registros y respaldos, los controles de acceso
          y el procedimiento de respuesta ante incidentes.
        </p>
      </section>

      <section>
        <h2>8. Tus derechos y cómo solicitarlos</h2>

        <p>
          Puedes solicitar acceso a tus datos, corregir
          información inexacta, pedir su cancelación u oponerte
          a su tratamiento. También puedes solicitar limitar
          su uso o divulgación y revocar tu consentimiento
          cuando corresponda.
        </p>

        <p>
          Canal de atención:{' '}
          <CorreoContacto
            asunto="Solicitud de datos personales — EchoHead"
          />
        </p>

        <p>
          Indica tu nombre o perfil, un medio para recibir
          respuesta, el derecho que deseas ejercer y los datos
          relacionados con tu solicitud. Será necesario verificar
          tu identidad o representación de forma proporcional.
        </p>

        <p>
          Para solicitudes ARCO, la legislación mexicana
          establece generalmente hasta 20 días hábiles para
          comunicar la determinación y, si procede, 15 días
          hábiles adicionales para hacerla efectiva. Las
          ampliaciones deben estar justificadas conforme a
          la ley. Los plazos más breves que resulten aplicables
          deben respetarse.
        </p>

        <p>
          El ejercicio es gratuito, salvo los costos de
          reproducción o envío permitidos por la ley. Una
          negativa debe explicarse; no todos los datos pueden
          eliminarse inmediatamente si existe una obligación
          legal de conservación.
        </p>
      </section>

      <section>
        <h2>9. Desconexión de Spotify y eliminación de cuenta</h2>

        <p>
          Puedes retirar el acceso de EchoHead desde{' '}
          <a href="https://www.spotify.com/account/apps/">
            las aplicaciones conectadas a Spotify
          </a>.
          Cerrar sesión no equivale a retirar ese permiso
          ni a borrar tu cuenta de EchoHead.
        </p>

        <p>
          Retirar el permiso tampoco ejecuta por sí mismo el
          borrado de nuestra base de datos. Puedes comunicar
          tu desconexión o solicitar la eliminación mediante
          el canal de privacidad. Los datos personales de
          Spotify deben dejar de tratarse y eliminarse conforme
          a sus condiciones, que contemplan un plazo de cinco
          días para los supuestos de desconexión previstos
          en su anexo de datos.
        </p>

        <p className="eh-info__nota">
          El procedimiento de desconexión, eliminación y
          confirmación de la solicitud está pendiente de
          verificación técnica antes del lanzamiento público.
        </p>
      </section>

      <section>
        <h2>10. Menores de edad</h2>

        <DatosLegales campos={['elegibilidad']} />

        <p>
          La versión definitiva deberá establecer las condiciones
          de acceso y el tratamiento de datos de menores.
          EchoHead no está dirigido a niños.
        </p>
      </section>

      <section>
        <h2>11. Cambios y contacto</h2>

        <p>
          Las actualizaciones se publicarán en esta página con
          su fecha. Los cambios relevantes deberán comunicarse
          antes de aplicarse, y se solicitará un nuevo
          consentimiento cuando sea necesario.
        </p>

        <p>
          Consulta también los{' '}
          <Link to="/terminos">términos de uso</Link>
          {' '}y la página de{' '}
          <Link to="/contacto">contacto</Link>.
        </p>
      </section>
    </PaginaInformativa>
  );
}