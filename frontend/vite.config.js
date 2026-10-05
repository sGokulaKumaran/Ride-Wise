import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],

    optimizeDeps: {
      include: ['leaflet', 'leaflet-routing-machine', 'leaflet-rotate'],
    },

    resolve: {
      alias: {
        // The ES-module way to say "the src folder next to this file"
        // (__dirname does not exist in ES modules; Vite warned about it
        // on every start).
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },

    server: {
      // Allow Cloudflare Quick Tunnel hostname
      // Only use this for local testing
      allowedHosts: true,

      proxy: {
        // Forward every /api/* call to local Spring Boot backend
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:8080',
          changeOrigin: true,
          secure: false,
        },

        // Live group-ride location socket
        '/ws': {
          target: env.VITE_API_URL || 'http://localhost:8080',
          changeOrigin: true,
          secure: false,
          ws: true,
        }
      }
    }
  }
})