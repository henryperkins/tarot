import { defineConfig } from '@playwright/test';
import base from './playwright.journey-p1.config.js';

// Journal features reachable from the signed-in UI: share-link management,
// reflection editing, card trends, search by meaning, mobile pattern alerts,
// text/JSON exports and link titles. Spread rather than merged, so only this
// config's server starts (merging would also start the base config's server).
export default defineConfig({
  ...base,
  testMatch: ['journal-reachability.spec.js'],
  outputDir: 'test-results/journal-reachability',
  use: { ...base.use, baseURL: 'http://127.0.0.1:5194', timezoneId: 'UTC' },
  webServer: {
    ...base.webServer,
    command: 'npm run dev:frontend -- --host 127.0.0.1 --port 5194 --strictPort',
    url: 'http://127.0.0.1:5194'
  }
});
