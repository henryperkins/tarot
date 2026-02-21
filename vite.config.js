import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        cookiePathRewrite: {
          '*': '/'
        }
      }
    },
    fs: {
      deny: ['venv/**', '.git/**']
    }
  },
  optimizeDeps: {
    // Explicitly specify entry points to avoid scanning venv
    entries: ['index.html', 'src/**/*.{js,jsx}']
  },
  build: {
    rollupOptions: {
      external: [
        /^node:/  // Exclude all Node.js built-in modules
      ],
      output: {
        manualChunks: {
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
