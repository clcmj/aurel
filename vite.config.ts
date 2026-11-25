import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    target: 'chrome130',
    rollupOptions: {
      input: {
        main: 'src/renderer/index.html',
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
})
