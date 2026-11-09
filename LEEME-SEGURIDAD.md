# EchoHead — aplicar las correcciones de seguridad

Esta entrega contiene el proyecto del ZIP con el backend corregido y las llamadas del frontend adaptadas. No contiene .env reales, node_modules, dist, bases de datos ni contraseñas. No se ha desplegado ni conectado a tu PostgreSQL o cuenta de Spotify.

## Antes de reemplazar archivos

1. Haz una copia de tu carpeta actual y un respaldo de PostgreSQL desde pgAdmin.
2. Extrae este ZIP en una carpeta nueva. Conserva tu configuración privada únicamente en tu equipo.
3. El ZIP original incluía backend/.env. No se leyó ni utilizó. Si contenía credenciales reales, renueva el secreto de Spotify y la contraseña de BD; actualiza después tu .env local. No lo subas a GitHub ni lo incluyas en próximos ZIP.
4. Backend y frontend deben actualizarse juntos: el backend nuevo rechaza las llamadas antiguas sin sesión/CSRF. No desactives esa protección para resolver un error 401/403.

## Paso 1 — preparar la base de datos

En pgAdmin, abre Query Tool sobre una COPIA de prueba de tu base EchoHead. Abre `backend/migrations/001_security.sql` y ejecútalo. Después de probar, aplica esa misma migración a la base que realmente usarás, con respaldo previo.

Esta migración agrega tablas de sesiones y de intentos OAuth. Crea `seguidores` solo si no existe. No borra tus usuarios, álbumes, calificaciones o reseñas. **No ejecutes esquema.sql sobre una base existente**: es solo para una base vacía. Para una instalación nueva, ejecutar primero esquema.sql y después la migración.

El esquema de `seguidores` no venía en el ZIP; las pruebas usan la tabla incluida en la migración. Si tu tabla existente tiene una estructura distinta, comprueba que tenga seguidor_id, seguido_id y una restricción UNIQUE para ese par. Las relaciones públicas conservan la conversión a texto usada por tu código anterior para tolerar IDs de tipo texto en esa tabla.

Usa un usuario PostgreSQL de aplicación sin superusuario, sin CREATEDB y sin CREATEROLE. La cuenta que ejecuta migraciones puede ser diferente. Concede a la cuenta de aplicación SELECT/INSERT/UPDATE/DELETE en las tablas necesarias y USAGE/SELECT en sus secuencias; no permisos de crear o eliminar tablas. Si PostgreSQL es remoto, exige TLS con certificado verificado y restringe su puerto por firewall.

## Paso 2 — configurar backend/.env

Usa `backend/.env.example` como guía. Conserva las variables DB_USER, DB_HOST, DB_NAME, DB_PASSWORD y DB_PORT que correspondan a tu instalación. Añade:

```dotenv
FRONTEND_ORIGIN=https://TU-TUNEL-DEL-FRONTEND
REDIRECT_URI=https://TU-TUNEL-DEL-FRONTEND/callback
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
BIND_HOST=127.0.0.1
PORT=8888
TRUST_PROXY=
```

FRONTEND_ORIGIN solo lleva protocolo y dominio, sin ruta. REDIRECT_URI debe estar registrada exactamente igual en Spotify Dashboard, incluyendo `/callback`. SPOTIFY_CLIENT_SECRET permanece exclusivamente en el backend.

Para trabajar sin túnel, usa frontend `http://127.0.0.1:5173`, callback `http://127.0.0.1:5173/callback` y `COOKIE_SECURE=false`. Esto solo se permite en desarrollo local. Registra también esa dirección de retorno en Spotify. No uses HTTP público.

## Paso 3 — instalar y arrancar backend

Abre una terminal en la carpeta backend:

```powershell
npm ci
npm test
npm start
```

Necesitas Node 22.12 o posterior; Node 24 LTS es apropiado para esta entrega. `npm test` usa PostgreSQL temporal con PGlite y Spotify simulado: no usa .env ni toca tus datos reales. Las pruebas están en `backend/test/security.test.js`.

## Paso 4 — conectar frontend

En `frontend/.env` configura:

```dotenv
VITE_API_BASE_URL=/backend
```

**Reemplaza cualquier VITE_API_BASE_URL antigua que apunte al túnel de puerto 8888.** En desarrollo, Vite enviará `/backend` hacia `http://127.0.0.1:8888`. Publica únicamente el túnel del frontend (5173). El backend no necesita un túnel público. Reinicia Vite tras cambiar variables de entorno.

En una segunda terminal, dentro de frontend:

```powershell
npm ci
npm run dev
```

Abre la dirección del frontend indicada en FRONTEND_ORIGIN. Si Vite pide permitir el hostname de tu túnel, define ese hostname exacto en `server.allowedHosts` de vite.config.js; no uses `allowedHosts: true`.

## Paso 5 — comprobar con tus cuentas de prueba

- Conecta Spotify. Debe mostrarse «Preparando tu perfil» y después Inicio.
- Abre Álbumes y Canciones; guarda una calificación, favorito y reseña.
- Edita tu descripción y tus cinco favoritos en Perfil.
- Visita otro perfil: no debe permitir editarlo. Intenta seguirlo y dejar de seguirlo.
- Prueba el nuevo botón «Cerrar sesión» del navbar.
- Una llamada sin cookie de sesión a `/backend/api/interacciones/1` debe devolver 401.

Si aparece 400, comprueba límites: descripción de perfil 255 caracteres, reseña 5000, calificación de 0 a 5 en pasos de 0.5, cinco favoritos como máximo por categoría, IDs Spotify de 22 caracteres e imágenes HTTPS de los CDN de Spotify. Otros hosts no están admitidos como imágenes guardadas.

Si aparece 403: verifica FRONTEND_ORIGIN, que estés usando el frontend nuevo y que hayas iniciado sesión de nuevo. Si aparece 401 tras conectar: verifica cookies, protocolo HTTPS y `/backend`. No reemplaces los controles de seguridad por CORS abierto.

## Comportamiento de las sesiones

La sesión dura como máximo una hora (o menos si Spotify indica una duración menor). Al vencer, la app pide volver a conectar. El token de acceso de Spotify y el token CSRF solo están en memoria del navegador; no se guardan en localStorage. El refresh token NO se devuelve al navegador, NO se guarda y NO se utiliza.

Al recargar se vuelve al login, igual que en la versión recibida; no se añadió restauración automática de sesión. Si necesitas sesiones persistentes, la siguiente mejora es almacenar refresh tokens cifrados en el servidor e implementar renovación y revocación controladas. No guardar refresh tokens en localStorage.

El botón Cerrar sesión revoca la sesión de EchoHead. No revoca por sí solo la autorización otorgada a Spotify ni borra el perfil. La eliminación de cuenta y desconexión completa todavía requieren trabajo específico.

## Despliegue futuro

`deploy/nginx.conf.example` muestra cómo servir frontend y API bajo un mismo dominio con HTTPS y cabeceras de seguridad. Es una plantilla, no una configuración ya instalada. `vite preview` no sustituye un servidor de producción. Las cabeceras Helmet del backend no protegen automáticamente el HTML servido desde otro servidor.

Si Nginx local es el único que accede al backend, configura `TRUST_PROXY=127.0.0.1` y evita acceso directo al puerto 8888. El proxy debe sobrescribir X-Forwarded-For. No uses `trust proxy=true`. Mientras TRUST_PROXY esté vacío y uses el proxy de Vite, todos los clientes comparten su IP para el límite global, una opción conservadora de desarrollo.

Los límites incluidos usan memoria por proceso: 300 peticiones/minuto por IP, 60 escrituras/minuto por usuario y 15 intentos de login/intercambio cada diez minutos por IP. Para varios servidores, usa un almacén compartido y límites en el proxy. Esto no es protección contra un DDoS volumétrico.

No registrar code, state, cookies, Authorization ni cuerpos con datos personales en logs del proxy. El HTML lleva Referrer-Policy=no-referrer y el callback se limpia antes de iniciar llamadas externas.

## Archivos principales

- backend/app.js: rutas, permisos, CORS, límites y manejo de errores.
- backend/auth.js: OAuth con state/PKCE, cookies HttpOnly, sesiones y CSRF.
- backend/validation.js: esquemas estrictos y comprobación de propietario.
- backend/config.js y server.js: configuración, conexión y arranque.
- frontend/src/lib/api.js: llamadas autenticadas y cierre/expiración de sesión.
- frontend/src/App.jsx: intercambio seguro, identidad verificada por servidor.
- Otros componentes del frontend: solo integración de solicitudes y envío de campos permitidos; sin rediseño.

Las reseñas se conservan como texto. No se deben renderizar con dangerouslySetInnerHTML o innerHTML. El frontend actual usa la interpolación de React.
