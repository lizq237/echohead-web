# Revisión de seguridad de EchoHead

Fecha: 27 de octubre de 2026. Alcance: código del backend y archivos de integración del frontend incluidos en ezyZip.zip. Se realizaron cambios en una copia de trabajo; no se accedió al servidor real, PostgreSQL real ni credenciales Spotify. La revisión no equivale a una certificación ni garantiza ausencia de vulnerabilidades.

## Hallazgos y correcciones

| Prioridad | Hallazgo en la versión recibida | Corrección implementada |
|---|---|---|
| Crítica | Las rutas para modificar descripción, selecciones, interacciones y seguidores aceptaban IDs enviados por cualquier cliente, sin sesión. Permitiría modificar datos de terceros sin iniciar sesión. | Sesión emitida por el servidor tras verificar Spotify. Cookies HttpOnly y Secure en HTTPS; ID propietario derivado de la sesión. Un ID ajeno se rechaza con 403. Todas las rutas de datos requieren sesión. |
| Alta | `/usuarios/sync` confiaba en spotify_id, nombre y email aportados por el navegador. Permitía crear o actualizar una identidad sin demostrar que pertenecía al visitante. | El servidor consulta `/v1/me` con el token obtenido del intercambio OAuth. El endpoint de compatibilidad no acepta datos de identidad y solo devuelve el usuario autenticado. |
| Alta | OAuth carecía de validación de state y de vinculación del intento al navegador. El intercambio era público y retornaba toda la respuesta de tokens. | state aleatorio vinculado a cookie HttpOnly, con expiración y consumo atómico; PKCE S256; tiempos límite en Spotify. No se devuelve ni guarda refresh_token. Se retira code/state de la URL del frontend. |
| Alta | `SELECT *` y `RETURNING *` devolvían email y otros campos internos de usuarios. | Respuestas con lista explícita de campos públicos. No se incluyen email, spotify_id ni hashes de sesión/CSRF. |
| Media | No existían reglas por campo para IDs, tipos, calificaciones, reseñas, imágenes o tamaño de selecciones. | Esquemas estrictos; rechazo de propiedades inesperadas, arrays excesivos, valores inválidos y URLs fuera de CDN de Spotify. Límites coherentes con PostgreSQL. |
| Media | No había límites de frecuencia, tiempos máximos de consultas o cabeceras de seguridad explícitas. | Límites globales, de escrituras y OAuth; JSON máximo 32 KiB; timeout Spotify/HTTP/SQL; Helmet; errores genéricos y logs sin datos personales. |
| Media | Reemplazo de favoritos con DELETE seguido de INSERT independientes. Un fallo podía borrar la selección anterior; dos ediciones podían mezclarse. | Transacción en un mismo cliente PostgreSQL, rollback y bloqueo de la fila del propietario durante el reemplazo. |
| Operativa | El ZIP incluía backend/.env. | No se leyó ni utilizó; excluido del paquete corregido. Renovar credenciales si eran reales. Esta exclusión no elimina las copias previamente compartidas. |
| Dependencias | Auditoría del lockfile original del backend: 6 paquetes afectados (1 crítico, 3 altos, 2 moderados). | Actualizaciones compatibles y lockfiles nuevos. Auditoría final del backend: 0 alertas. También se actualizaron dependencias del frontend, cuya auditoría inicial mostró 13 paquetes afectados; auditoría final: 0. |

La gravedad de las alertas de dependencias es la del registro de npm, no una afirmación de que todas fueran explotables a través de estas rutas. Los paquetes afectados del backend original fueron axios, body-parser, follow-redirects, form-data, proxy-addr y qs. Los resultados dependen de la fecha de consulta.

## Inyección SQL, ejecución de código y XSS: qué se encontró realmente

Las consultas del backend original ya utilizaban parámetros `$1`, `$2`, etc. No se encontró una inyección SQL directa en esas consultas ni llamadas a eval, ejecución de comandos del sistema o carga de código proporcionado por usuarios. No sería correcto afirmar que había una vulnerabilidad de ejecución remota solo por permitir texto en una reseña.

Se conservaron las consultas parametrizadas. Las pocas interpolaciones de nombres de tablas/columnas en la nueva versión usan exclusivamente constantes internas; ninguna procede de parámetros HTTP. La búsqueda escapa también los comodines `%`, `_` y `\` para que la consulta represente texto literal.

La aplicación trata reseñas y descripciones como texto; React las escapa. No se encontró un uso de dangerouslySetInnerHTML o innerHTML en el código revisado. Se probó que una cadena similar a SQL no altera tablas y que las etiquetas de script se devuelven como texto JSON, no HTML. Si en el futuro se añade un editor de HTML/Markdown con HTML habilitado, será necesario sanitizar su salida antes de renderizarla.

## Protección adicional contra CSRF

Las escrituras exigen Origin exacto y token CSRF ligado a la sesión. Cookies HttpOnly impiden leer el identificador desde JavaScript; SameSite y Secure complementan la protección. El intercambio OAuth usa la validación state/cookie de un solo uso antes de existir una sesión. CORS no se usa como sustituto de autenticación.

Las cookies de sesión se almacenan como hashes SHA-256 en la BD, no como el valor que recibe el navegador. Se rotan al volver a iniciar sesión y se eliminan al salir. La consulta de sesión verifica la expiración aunque aún no se haya ejecutado la limpieza periódica.

## Correcciones funcionales incluidas

- `es_pendiente` de canciones ahora se obtiene de la columna correcta, no de es_escuchado.
- La consulta de interacciones incluye artista, evitando perderlo al editar desde el perfil.
- La conexión inicial de PostgreSQL ya no deja un cliente retenido del pool.
- Se añadió el punto y coma que faltaba al final del esquema base y la creación de seguidores en la migración, porque no venía en esquema.sql.
- El frontend envía las cookies y el CSRF solo al backend configurado; las llamadas a Spotify no reciben esas credenciales.
- El frontend obtiene el usuario del servidor, tiene cierre y expiración de sesión y envía solo los campos admitidos al editar selecciones. Se mantuvieron el diseño y las funciones de catálogo, perfil y reproductor.

## Validación realizada

19 pruebas automatizadas del backend, todas aprobadas, usando PostgreSQL temporal mediante PGlite y Spotify simulado:

1. Cierre de rutas de datos sin sesión.
2. Sesiones falsas y vencidas.
3. Permisos de propietario en todas las familias de escritura.
4. Origin y CSRF ausente/incorrecto.
5. OAuth vinculado al navegador, PKCE y reutilización concurrente del intento.
6. Expiración de OAuth y atributos de cookie segura.
7. Suplantación en sync y privacidad de los perfiles.
8. Cadenas SQL, IDs maliciosos y comodines de búsqueda.
9. Tipos, longitudes, URLs, IDs y campos inesperados.
10. Reseñas con etiquetas como texto JSON.
11. Rollback ante un error de inserción.
12. Edición legítima, favoritos, seguimiento y pendientes.
13. Revocación al cerrar sesión.
14. JSON inválido, tamaño excesivo y Content-Type incorrecto.
15. Límite global y Retry-After.
16. Configuración insegura rechazada.
17. Rotación de sesión al reconectar Spotify.
18. Límites de escrituras y OAuth.
19. Propiedades de prototipo y X-Forwarded-For falsificado.

Además, prueba en Chromium con frontend real, backend real de la copia, BD temporal y Spotify simulado: entrada, intercambio, cookie HttpOnly, navegación sin volver inesperadamente a Inicio, guardar favorito con CSRF, perfil sin email y cierre de sesión. Sin errores JavaScript durante ese recorrido. No se llamó a Spotify real.

Build de producción del frontend aprobado y ESLint aprobado para los archivos de integración modificados. npm audit final sin alertas para ambos proyectos, incluyendo dependencias de desarrollo. No se realizaron pruebas de carga, pentest externo ni validación del hosting real.

## Límites y trabajo pendiente antes de publicar

- Aplicar la migración, configurar las variables reales y probar con tus cuentas Spotify de desarrollo. No se verificó tu esquema existente de seguidores ni tu infraestructura.
- Sesiones de hasta una hora; no hay renovación ni restauración persistente al recargar. Se evita guardar refresh tokens mientras no exista almacenamiento cifrado y un ciclo de revocación completo.
- Perfiles, reseñas y relaciones siguen siendo visibles para otros usuarios autenticados. No se añadió un modelo de cuentas privadas ni bloqueo de usuarios.
- Falta implementar eliminación de cuenta, desconexión completa y los procesos de privacidad prometidos en los textos legales. Cerrar sesión no borra datos ni revoca Spotify.
- El listado completo de interacciones y relaciones conserva el contrato actual del frontend. Para colecciones grandes, añadir paginación de servidor y cuotas de almacenamiento; los límites actuales no sustituyen esos controles.
- Los límites de solicitudes son por proceso. Para escalar a varios servidores se necesita almacenamiento compartido y límites en el proxy; no evitan DDoS volumétricos.
- Habilitar HTTPS, permisos mínimos de PostgreSQL, respaldos y TLS verificado en conexiones remotas. Los permisos reales de la cuenta de BD no se pudieron comprobar.
- Aplicar CSP y otras cabeceras al HTML en el servidor que aloje el frontend. Helmet solo cubre las respuestas del backend. Se incluye una plantilla Nginx sin desplegar.
- Revisar compatibilidad con requisitos de Spotify y los textos de privacidad antes de acceso público; esta revisión es técnica, no una aprobación legal ni de Spotify.

## Referencias técnicas consultadas

- OWASP, Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- OWASP, CSRF Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- Express, Production Security: https://expressjs.com/advanced/best-practice-security/
- Spotify, Authorization Code Flow: https://developer.spotify.com/documentation/web-api/tutorials/code-flow
- Spotify, PKCE: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
- node-postgres, consultas parametrizadas: https://node-postgres.com/features/queries
- node-postgres, transacciones: https://node-postgres.com/features/transactions
