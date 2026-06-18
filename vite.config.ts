import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: '/qr/',
  server: {
    port: 6002,
    strictPort: true, // Evita que Vite salte a otro puerto si este está ocupado
  }
})
