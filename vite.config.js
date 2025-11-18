import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      external: [
        /^node:/  // Exclude all Node.js built-in modules
      ],
      output: {
        manualChunks: {
          // Split vendor chunks to reduce bundle size
          vision: ['@xenova/transformers'],
          react: ['react', 'react-dom', 'react-router-dom'],
          markdown: ['react-markdown', 'remark-gfm']
        }
      }
    },
    chunkSizeWarningLimit: 1000  // Increase limit for vision models
  },
  resolve: {
    alias: {
      // Polyfill Node.js modules for browser
      'node:fs/promises': false,
      'node:path': false,
      'node:fs': false
    }
  }
});