import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true, // Exposes server to LAN (192.168.29.105)
    port: 5173,
    allowedHosts: true, // Allows Localtunnel, Ngrok, and all tunnel hosts
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:3002',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    tailwindcss()
  ],
})
