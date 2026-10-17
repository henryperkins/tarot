import { defineConfig } from 'vite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import base from './vite.config.js';

const port = Number(process.env.READING_REVIEW_PORT || 5214);

// An owned frontend: no forwarding to the running beta or paid providers.
export default defineConfig({
  ...base,
  cacheDir: join(tmpdir(), `tableu-reading-purpose-vite-${port}`),
  server: { ...base.server, host: '127.0.0.1', port, strictPort: true, proxy: {} }
});
