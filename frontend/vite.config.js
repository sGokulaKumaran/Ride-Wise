import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

// https://vite.dev/config/      This link provide vite official doc 
export default defineConfig({
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
      // Forward every /api/* call to the Spring Boot backend
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})

