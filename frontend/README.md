# EchoHead — Frontend

Interfaz web de **EchoHead**, una plataforma musical para registrar, calificar y reseñar álbumes y canciones.

🌐 **[Probar la aplicación](https://echohead-web.pages.dev/)** · 📖 **[README principal: producto, recorrido para reclutadores e instalación](../README.md)**

## Tecnologías

React 19, Vite 8, JavaScript, CSS, React Router, React Icons y html2canvas.

## Desarrollo local

El frontend requiere el backend de EchoHead en el puerto `8888`. Revisa primero el [README principal](../README.md) para configurar PostgreSQL y la API.

```bash
cd frontend
npm ci
npm run dev
```

Abre `http://localhost:5173`. Vite usa el proxy `/backend` hacia `http://127.0.0.1:8888`. El proyecto también incluye:

```bash
npm run build
npm run lint
```

La autenticación propia y el catálogo MusicBrainz no requieren conectar Spotify. El acceso directo a Spotify es opcional y está sujeto a los usuarios autorizados de la beta.

> Proyecto personal en desarrollo de Lizeth Quiroz Urias. Para funcionalidades, demostración y documentación completa, consulta el [README de la raíz](../README.md).
