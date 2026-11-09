import { Link } from 'react-router-dom';
import {
    DatosLegales,
    PaginaInformativa,
} from './About';

export default function Terminos(props) {
  return (
    <PaginaInformativa
      {...props}
      documento
      titulo="Términos de uso"
      introduccion="Condiciones para usar EchoHead y participar en su comunidad."
    >
      <section>
        <h2>1. Responsable y alcance</h2>

        <DatosLegales />

        <p>
          EchoHead permite organizar escuchas, calificar música,
          escribir reseñas y compartir un perfil. Actualmente
          es un proyecto en desarrollo y sus funciones pueden
          cambiar. Estos términos corresponden a EchoHead,
          no sustituyen los acuerdos que tengas con Spotify.
        </p>
      </section>

      <section>
        <h2>2. Acceso y cuenta</h2>

        <p>
          Puedes utilizar una cuenta propia de EchoHead. Conserva tu contraseña
          y clave de recuperación de forma segura. Si decides conectar Spotify,
          utiliza una cuenta que estés autorizado a usar. No compartas credenciales
          ni suplantes a otras personas. Las funciones conectadas dependen de los
          permisos concedidos, los requisitos de Spotify y
          la disponibilidad de su servicio.
        </p>

        <DatosLegales campos={['elegibilidad']} />

        <p>
          La creación de una cuenta requiere aceptar la versión
          vigente de estos términos y conocer el aviso de
          privacidad. Si no estás de acuerdo, no continúes
          con el registro.
        </p>
      </section>

      <section>
        <h2>3. Tus publicaciones</h2>

        <p>
          Conservas los derechos sobre las reseñas y textos
          originales que publiques. Para operar EchoHead,
          autorizas su almacenamiento, reproducción técnica
          y visualización dentro del servicio mediante un
          permiso no exclusivo y limitado a esas finalidades.
          Esto no autoriza vender tu contenido ni utilizarlo
          en publicidad externa.
        </p>

        <p>
          Publica únicamente contenido propio o que tengas
          derecho a utilizar. El permiso termina cuando se
          elimina el contenido, salvo la conservación que
          legalmente corresponda. Las copias compartidas por
          otras personas fuera de EchoHead pueden quedar
          fuera de nuestro control.
        </p>
      </section>

      <section>
        <h2>4. Convivencia y uso permitido</h2>

        <ul>
          <li>
            No publiques amenazas, acoso, discriminación ni
            información privada de otras personas.
          </li>

          <li>
            No suplantes identidades ni publiques contenido
            que infrinja derechos de terceros.
          </li>

          <li>
            No accedas a cuentas o datos sin autorización
            ni alteres el funcionamiento del servicio.
          </li>

          <li>
            No distribuyas código malicioso, spam ni manipules
            calificaciones mediante cuentas falsas.
          </li>
        </ul>

        <p>
          Puedes expresar críticas musicales y opiniones
          negativas respetando estas reglas.
        </p>
      </section>

      <section>
        <h2>5. Reportes y moderación</h2>

        <p>
          Puedes reportar contenido desde la página de{' '}
          <Link to="/contacto">contacto</Link>,
          indicando su ubicación y el motivo. Los reportes se
          revisarán antes de adoptar una medida, salvo que sea
          necesaria una intervención inmediata para proteger
          a personas o cumplir una obligación legal.
        </p>

        <p>
          Podemos retirar contenido o limitar cuentas ante
          incumplimientos, considerando su gravedad y
          reiteración. Cuando corresponda, se informará el
          motivo y podrás solicitar revisión por el mismo
          canal. Las infracciones reiteradas de derechos
          de autor pueden dar lugar al cierre de la cuenta.
        </p>
      </section>

      <section>
        <h2>6. Catálogos y derechos de terceros</h2>
        <p>El catálogo independiente utiliza metadatos de MusicBrainz y portadas
          disponibles en Cover Art Archive. Puede contener errores, variantes de
          ediciones o imágenes faltantes. No ofrece archivos de audio ni una licencia
          para reproducir o redistribuir música. Las imágenes y obras mantienen
          los derechos de sus respectivos titulares.</p>

        <p>
          EchoHead es independiente de Spotify. Sus marcas,
          contenidos y plataforma pertenecen a sus titulares.
          El acceso no concede derechos para copiarlos,
          modificarlos, crear obras derivadas o descompilarlos,
          salvo autorización o una excepción legal aplicable.
        </p>

        <p>
          EchoHead responde por su propio servicio, no Spotify.
          No otorgamos garantías en nombre de Spotify; en lo
          permitido por la ley, se excluyen las garantías
          implícitas de comerciabilidad, idoneidad y no
          infracción relativas a su plataforma, servicio
          y contenido. Spotify no asume responsabilidad
          por EchoHead.
        </p>

        <p>
          Spotify es tercero beneficiario de estos términos
          y del aviso de privacidad, y puede exigir directamente
          el cumplimiento de estos términos en lo que le
          corresponda. Nada de ello excluye derechos
          irrenunciables.
        </p>
      </section>

      <section>
        <h2>7. Disponibilidad y responsabilidad</h2>

        <p>
          El servicio puede experimentar interrupciones,
          errores o cambios derivados del mantenimiento o de
          proveedores externos. No garantizamos disponibilidad
          continua ni la permanencia de todas las funciones.
        </p>

        <p>
          Estas limitaciones no eliminan las obligaciones
          legales del responsable ni excluyen responsabilidades
          que no puedan limitarse conforme a la ley. La
          gratuidad del proyecto no implica renunciar
          a tus derechos.
        </p>
      </section>

      <section>
        <h2>8. Privacidad y salida del servicio</h2>

        <p>
          El tratamiento de datos se describe en el{' '}
          <Link to="/privacidad">aviso de privacidad</Link>.
          Ahí se explica cómo retirar el acceso de Spotify y
          solicitar la eliminación de tu cuenta. Cerrar sesión
          no equivale a eliminar los registros guardados.
        </p>
      </section>

      <section>
        <h2>9. Cambios y legislación aplicable</h2>

        <p>
          Publicaremos las modificaciones con su fecha y
          comunicaremos los cambios relevantes antes de
          aplicarlos. Cuando corresponda, solicitaremos una
          nueva aceptación. Si no deseas continuar, puedes
          dejar de usar el servicio y solicitar la eliminación
          de tu cuenta.
        </p>

        <p>
          Estos términos se interpretan conforme a la legislación
          mexicana, sin excluir las normas obligatorias ni los
          derechos y vías de reclamación que te correspondan
          en tu lugar de residencia.
        </p>
      </section>
    </PaginaInformativa>
  );
}