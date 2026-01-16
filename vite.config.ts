import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true, // Allow all tunnel hosts (Cloudflare, Localtunnel, etc.)
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      // Proxy WebSocket for development
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      }
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});