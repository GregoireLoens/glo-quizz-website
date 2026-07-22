import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Pas d'assets inlinés en data: URI — la CSP (font-src 'self') les refuse.
    assetsInlineLimit: 0,
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://server:8000',
      '/ws': { target: 'ws://server:8000', ws: true },
    },
  },
})
