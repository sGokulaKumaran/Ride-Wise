import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/      This link provide vite official doc 
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    optimizeDeps: {
      include: ['leaflet', 'leaflet-routing-machine'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src') //this point the src file always with @ 
      }
    },
    server: {
      proxy: {
        // Forward every /api/* call to local Spring Boot backend by default
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:8080',
          changeOrigin: true,
          secure: false,
        },
        // Live group-ride location socket — must be proxied with ws:true
        // so the browser's WebSocket upgrade reaches Spring Boot.
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


