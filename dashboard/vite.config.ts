import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@mysten')) {
              return 'mysten-sui';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('@tanstack') || id.includes('scheduler')) {
              return 'react-framework';
            }
            return 'vendor';
          }
        }
      }
    },
    chunkSizeWarningLimit: 800, // Safe limit for premium dashboards
  }
})
