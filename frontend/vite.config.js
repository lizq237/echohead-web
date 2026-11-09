import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/backend': {
        target: 'http://127.0.0.1:8888',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/backend/, ''),
        // No aceptar un X-Forwarded-For inventado del cliente.
        xfwd: false,
      },
    },
  },
});
