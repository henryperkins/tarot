import { defineConfig } from 'vite';
import base from './vite.config.js';

if (!process.env.NAV_GATE2_VITE_CACHE_DIR) throw new Error('Gate 2 requires an owned Vite dependency cache');

// Distinct feature lanes must not invalidate one another's optimized modules.
// Keep the application configuration and development environment unchanged.
export default defineConfig({ ...base, cacheDir: process.env.NAV_GATE2_VITE_CACHE_DIR });
