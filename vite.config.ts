import { defineConfig } from 'vite'

export default defineConfig({
  root: './',
  server: {
    open: true,  // auto-open browser
    port: 5173
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})