import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5000,
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
    // Keep dependency scanning on browser entrypoints only.
    // Broad src globs pull the Cloudflare worker graph into the frontend optimizer.
    entries: ['index.html', 'src/main.jsx']
  },
  build: {
    modulePreload: {
      // Dynamic route dependencies can point back to the already-running entry.
      // WebKit otherwise fetches it again as a modulepreload.
      resolveDependencies: (_filename, dependencies, { hostType }) => hostType === 'js'
        ? dependencies.filter(dependency => !dependency.startsWith('assets/app-'))
        : dependencies
    },
    rollupOptions: {
      external: [
        /^node:/  // Exclude all Node.js built-in modules
      ],
      output: {
        entryFileNames: 'assets/app-[hash].js',
        manualChunks(id) {
          // Assign the whole runtime, including CommonJS and JSX entrypoints,
          // before optional features can absorb its dependencies.
          if (/\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'react';
          if (id.includes('/node_modules/@xenova/transformers/')) return 'vision';
          if (/\/node_modules\/(react-markdown|remark-gfm)\//.test(id)) return 'markdown';
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
