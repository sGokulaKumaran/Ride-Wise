import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],

    optimizeDeps: {
      include: ['leaflet', 'leaflet-routing-machine'],
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
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