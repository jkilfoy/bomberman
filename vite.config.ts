import { defineConfig } from 'vite'

export default defineConfig({
  root: './',
  server: {
    open: true,  // auto-open browser
    port: 9652
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})