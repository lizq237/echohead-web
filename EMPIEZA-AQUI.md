# EchoHead: acceso propio + Spotify opcional

Esta entrega parte de tu ZIP actualizado. Conserva tus pantallas y el acceso Spotify; añade cuentas independientes y catálogo MusicBrainz. Es una versión para probar antes del despliegue.

## 1. Extraer en una carpeta nueva

Extrae este ZIP en una carpeta nueva, por ejemplo `EchoHead-acceso-dual`, y ábrela en VS Code. La carpeta correcta contiene `backend`, `frontend` y este archivo. No reemplaces todavía tu carpeta EchoHead-seguridad ni borres su `.env`.

El ZIP no incluye contraseñas, `.env` reales, `node_modules`, `dist` ni datos de usuarios. Las dependencias se instalan de nuevo en el paso 4.

## 2. Preparar una copia de la base de datos en pgAdmin

Hazlo sobre tu base actual de pruebas, no sobre una base vacía si quieres conservar los datos:

1. En pgAdmin, clic derecho en la base que usas actualmente (`echohead_pruebas` si no la cambiaste) → **Backup / Respaldo**. Elige formato **Custom**, una ubicación y guarda el respaldo.
2. Clic derecho en **Databases / Bases de datos** → **Create / Crear** → **Database / Base de datos**. Ponle `echohead_migracion`.
3. Clic derecho en `echohead_migracion` → **Restore / Restaurar**. Selecciona el respaldo anterior y ejecútalo. Comprueba que aparecen las tablas y tus usuarios.
4. Selecciona `echohead_migracion` → **Query Tool / Herramienta de consultas**. Abre `backend/migrations/002_independent_accounts.sql` desde el botón de abrir archivo y ejecútalo completo con F5.

La copia anterior ya debe contener la migración 001. Si no existen `echohead_sessions` o `echohead_oauth_attempts`, ejecuta primero `backend/migrations/001_security.sql`. **No ejecutes `esquema.sql` sobre la copia restaurada**: ese archivo es para una instalación nueva sin tablas.

La migración 002 permite usuarios sin Spotify y añade tablas de credenciales y límites de acceso. No borra perfiles ni cambia sus IDs. No migra automáticamente los álbumes Spotify a MusicBrainz.

## 3. Preparar el `.env` local

Copia, SOLO en tu computadora, el `.env` de tu backend actual a `backend/.env` de la nueva carpeta. No lo envíes por chat.

En esa copia cambia:

```dotenv
DB_NAME=echohead_migracion
```

Añade también:

```dotenv
MUSICBRAINZ_CONTACT=
```

Después del signo `=` escribe un correo de contacto real del proyecto o una URL HTTPS pública con información de contacto. MusicBrainz necesita identificar al responsable de la aplicación en su cabecera User-Agent. No es una contraseña ni una API key. Usa un contacto que estés de acuerdo en facilitar a ese servicio.

Conserva tus valores actuales de `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `FRONTEND_ORIGIN`, `REDIRECT_URI` y los ajustes de cookies que ya funcionaban. Spotify se vuelve opcional para arrancar, pero esos dos valores siguen siendo necesarios para tus cinco usuarios autorizados.

Si el túnel cambia de dirección, actualiza `FRONTEND_ORIGIN`, `REDIRECT_URI` y la URI de redirección registrada en Spotify. Mantén la configuración del túnel que preserva la cabecera Origin; no añadas orígenes ajenos para ocultar errores. No abras PostgreSQL al público.

Si tienes un `frontend/.env` local, revisa si realmente lo necesitas: el valor predeterminado usa `/backend` mediante el proxy de Vite. Ningún secreto de Spotify debe ir en una variable `VITE_`.

## 4. Instalar y ejecutar

Detén el frontend y backend anteriores con Ctrl+C para que no ocupen los mismos puertos. Usa Node 22.12+ o Node 24.

Terminal 1, abierta en la carpeta nueva:

```powershell
cd backend
npm ci
npm test
npm start
```

Espera a ver que el backend está en el puerto 8888. `npm test` ejecuta 32 pruebas con una base temporal; no utiliza tu base de datos real.

Terminal 2, también desde la carpeta nueva:

```powershell
cd frontend
npm ci
npm run dev
```

Abre la dirección del frontend que corresponda a tu configuración actual. Si usas el túnel, conserva el puerto 5173 público y el proxy al backend, tal como ya te funcionaba. No cambies a localhost sin ajustar las variables del backend: el Origin permitido debe coincidir.

## 5. Probar los dos tipos de acceso

### Tú y los cinco usuarios que ya tenían perfil Spotify

1. Entra con **Continuar con Spotify**, como antes. No crees otra cuenta para sustituir tu perfil existente.
2. Comprueba que sigan tus reseñas, favoritos y pendientes.
3. Abre el icono de ajustes **Cuenta** del navbar (ruta `/cuenta`).
4. En **Añade acceso sin Spotify**, elige un usuario y una contraseña de al menos 15 caracteres. Hazlo dentro de los 10 minutos siguientes al inicio de sesión; si se vence ese margen, vuelve a entrar.
5. Guarda la clave de recuperación en un gestor de contraseñas o lugar seguro. Solo se muestra al crearla o renovarla. No la compartas.
6. Cierra sesión y prueba entrar con ese usuario y contraseña. Debe ser el MISMO perfil, con el mismo historial.
7. Desde Cuenta puedes conectar Spotify otra vez. La vinculación se valida en el servidor y debe corresponder al mismo perfil.

### Una persona que no está autorizada en Spotify

1. Usa **Crear cuenta** y elige nombre visible, usuario y contraseña propia.
2. Guarda su clave de recuperación antes de continuar.
3. Busca álbumes y canciones. El catálogo predeterminado será MusicBrainz.
4. Califica, reseña, marca favoritos y pendientes. Comprueba que aparecen en Perfil y que los álbumes pendientes aparecen en Inicio.
5. Prueba los cinco favoritos destacados y el seguimiento de amigos.

Las cuentas propias no piden correo en esta primera versión. La recuperación se hace con usuario + clave de recuperación. No hay todavía recuperación por correo. Perder contraseña y clave implica perder la vía de recuperación independiente; si el perfil ya tenía Spotify vinculado, sigue disponible esa vía mientras Spotify permita el acceso.

### Qué pasa con Spotify

- Los usuarios autorizados conservan biblioteca, búsqueda Spotify, resumen personal y controles de reproducción existentes, sujeto a los permisos y requisitos de Spotify.
- El frontend nunca comparte el token Spotify de un usuario con otra persona.
- EchoHead no decide la autorización de Spotify comparando un correo escrito en un formulario.
- La sesión EchoHead dura hasta 12 horas. Se restaura al recargar sin guardar contraseñas ni tokens de sesión en localStorage.
- El token Spotify permanece solo en memoria y caduca en un máximo de una hora. Recargar pierde esa conexión temporal, pero conserva la sesión EchoHead. Ve a Cuenta → Conectar Spotify para activarla de nuevo. No se añadieron refresh tokens persistentes.
- Si Spotify rechaza una conexión, tu sesión EchoHead permanece utilizable.
- Si intentas vincular una cuenta Spotify que ya pertenece a OTRO perfil EchoHead, se rechaza. No se fusionan perfiles por email ni se transfieren reseñas automáticamente.

## 6. Alcance del catálogo

MusicBrainz proporciona metadatos, no audio. Cover Art Archive proporciona portadas cuando están disponibles; puede faltar la imagen y entonces se muestra el respaldo existente. Los artistas sin imagen también usan el respaldo. El tocadiscos visual sigue disponible; no se promete reproducción para cuentas sin Spotify.

En Álbumes y Canciones puedes elegir catálogo cuando Spotify está conectado. La selección de destacados del perfil usa Spotify si está conectado y MusicBrainz en caso contrario. Las búsquedas muestran 20 resultados por página, hasta 220 en las pantallas de catálogo; la selección de destacados muestra los primeros 20. Se busca por título en álbumes/canciones, por nombre en artistas.

Los IDs de MusicBrainz tienen prefijos `mb:rg:`, `mb:rec:` y `mb:artist:`. Por compatibilidad, algunos campos se siguen llamando `spotify_id` o `album_spotify_id` internamente; contienen una clave con proveedor explícito. Los datos antiguos conservan sus IDs.

**Un mismo álbum guardado desde Spotify y desde MusicBrainz puede aparecer como dos entradas.** Esta entrega no adivina equivalencias ni fusiona reseñas. Una siguiente fase puede añadir un mapa de equivalencias revisado, especialmente entre ediciones, versiones y grabaciones.

El backend usa caché de cinco minutos, agrupa búsquedas repetidas, limita la cola y deja al menos 1.1 segundos entre solicitudes MusicBrainz. Se diseñó para UN proceso backend. Antes de lanzar varias instancias hay que compartir límites/caché entre ellas. La búsqueda real requiere acceso del servidor a MusicBrainz; no hay un catálogo ficticio en producción.

## 7. Validaciones y límites de esta entrega

Realizado sobre el código entregado:

- 32 pruebas backend: autenticación, CSRF, IDOR, validación, SQL parametrizado, OAuth/PKCE, recuperación de uso único, revocación, vinculación y conservación de datos.
- Compilación de producción del frontend.
- ESLint en archivos modificados.
- Prueba Chromium de registro sin Spotify, recuperación mostrada, restauración al recargar, búsqueda álbumes/canciones, favoritos, pendientes, perfil, rechazo de vinculación con otro perfil, flujo Spotify existente y cierre de sesión.
- Revisión visual de login en escritorio y móvil, sin desbordamiento horizontal en el móvil probado.

Las pruebas usan PostgreSQL embebido (PGlite) y respuestas simuladas de Spotify/MusicBrainz. **No se ha conectado a tu PostgreSQL real, usado tus credenciales, probado tus cinco cuentas reales ni hecho el despliegue.** La prueba con servicios reales debe realizarse en tu copia de pruebas siguiendo el apartado 5.

Se conservan y amplían las protecciones anteriores. Eso no constituye una garantía de ausencia de vulnerabilidades. Contraseñas con scrypt y sal individual; hashes de sesión y recuperación; límites de intentos; cookies HttpOnly; Origin/CSRF; consultas parametrizadas; campos públicos seleccionados. El nuevo hash usa aproximadamente 128 MiB y admite un cálculo simultáneo por proceso, para evitar agotar memoria. Si llegan varios accesos simultáneos puede pedir reintentar.

Se actualizaron los textos de Privacidad y Términos para describir cuentas propias y catálogos. Antes de publicar hay que completar los datos legales y del alojamiento que el proyecto ya marcaba como pendientes, confirmar las condiciones de uso de los proveedores según el uso real y revisar moderación/operación. La existencia de una portada pública no otorga automáticamente derechos de redistribución. No se eliminó ninguna atribución de terceros.

## 8. Volver a la versión anterior

Detén los dos procesos nuevos. Abre tu carpeta EchoHead-seguridad anterior y ejecuta sus procesos con su `.env` y su base anterior. Como se prueba con otra carpeta y otra base, el original permanece disponible. Los cambios que hagas únicamente en `echohead_migracion` no se copiarán solos a la base anterior.

## Fuentes técnicas de referencia

- MusicBrainz API: https://musicbrainz.org/doc/MusicBrainz_API
- Límites y User-Agent: https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
- Cover Art Archive: https://musicbrainz.org/doc/Cover_Art_Archive/API
- OWASP Password Storage: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- OWASP Authentication: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html

Lee este documento antes de los documentos de seguridad anteriores: aquellos describen la versión inicial basada únicamente en Spotify.
