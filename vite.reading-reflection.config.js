import { defineConfig } from 'vite';
import base from './vite.config.js';

export default defineConfig({
  ...base,
  // Keep this visual-enabled lane's optimized dependencies separate from ordinary runs.
  cacheDir: 'node_modules/.vite-reading-reflection',
  server: { ...base.server, proxy: {} }
});
