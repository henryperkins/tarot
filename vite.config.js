import { defineConfig } from 'vite';
import { realpathSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const scratchDirectories = new Set(['.worktrees', '.superpowers', 'tmp', 'test-results', 'playwright-report']);
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
    watch: {
      ignored: [watchedPath => relative(projectRoot, resolve(watchedPath)).split(sep)
        .some(segment => scratchDirectories.has(segment))]
    },
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
      allow: ['.', realpathSync('./node_modules')],
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
      // WebKit otherwise fetches it again as a modulepreload. Failed validation
      // preloads also remain negatively cached across reloads in WebKit; import
      // that small chunk directly so a real HTTP failure can recover on reload.
      resolveDependencies: (_filename, dependencies, { hostType }) => hostType === 'js'
        ? dependencies.filter(dependency => !dependency.startsWith('assets/app-') && !dependency.startsWith('assets/readingSchema-'))
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
