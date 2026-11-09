# Cambios respecto a tu ZIP actualizado

## Backend

- `migrations/002_independent_accounts.sql`: usuarios sin Spotify, credenciales propias, límites persistentes y vinculación de OAuth a una sesión concreta.
- `accounts.js`, `passwords.js`: registro, acceso, configuración del perfil existente, cambio de contraseña y recuperación por clave de uso único.
- `auth.js`: sesión EchoHead independiente de la duración Spotify, restauración segura al recargar y vinculación explícita sin fusionar perfiles ajenos.
- `catalog.js`: búsquedas MusicBrainz, validación, caché, cola limitada y pausas entre solicitudes.
- `app.js`, `validation.js`, `config.js`, `server.js`, `.env.example`: rutas y configuración nuevas; IDs con proveedor; fuentes de imágenes acotadas; limpieza de límites temporales.
- `test/security.test.js`: 19 pruebas existentes más 13 para los flujos nuevos.

## Frontend

- `App.jsx`, `App.css`: formulario de acceso propio, conexión Spotify opcional y restauración de sesión. Se conserva el diseño general del login.
- `components/AccountAccess.jsx`, `AccountAccess.css`, `lib/accounts.js`: formularios y presentación de la clave de recuperación.
- `pages/Cuenta.jsx`, `components/Navbar.jsx`: acceso a ajustes y conexión opcional de Spotify.
- `lib/catalog.js`, `pages/Albumes.jsx`, `Canciones.jsx`, `Perfil.jsx`: búsquedas con ambos proveedores, selección de catálogo, paginación y favoritos destacados sin Spotify.
- `components/Privacidad.jsx`, `Terminos.jsx`: descripción de cuentas propias y nuevos proveedores.
- `components/TarjetaInteractiva.jsx`: conserva tus correcciones de pendientes; evita llamar a Node.contains con Window durante eventos de desplazamiento/redimensionamiento.

No se modificaron las dependencias ni se reemplazaron tus pantallas por una plantilla nueva. El ZIP omite paquetes instalados, compilaciones y archivos locales de entorno. Las bases de datos reales no se han tocado.
