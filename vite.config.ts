import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Set to '/' because Cloudflare Tunnel/Localhost acts as the root. 
  // (Change back to '/TwinCinema/' ONLY when deploying to GitHub Pages)
base: '/TwinCinema/',

  server: {
    allowedHosts: true, // Required for Cloudflare Tunnel
    host: '0.0.0.0',    // Allows external access
    port: 5173,         // Your specific port
    
    // HMR (Hot Module Replacement) fix for Tunnels
    hmr: {
      protocol: 'wss',
      host: 'cellular-aaa-techno-even.trycloudflare.com',
      clientPort: 443,
    },

    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Your backend bot server
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