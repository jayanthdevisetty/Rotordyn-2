import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    minify: true,
    cssMinify: true
  },
  server: {
    port: 5000,
    host: true
  }
})
