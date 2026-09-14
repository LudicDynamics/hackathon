import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // A deploy under a URL prefix sets e.g. AIRP_WEB_BASE=/airp-infini-canvas/;
  // src/lib/base-path.ts then prefixes the app's /api and /ws URLs.
  base: process.env.AIRP_WEB_BASE ?? '/',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true
      }
    }
  }
});
