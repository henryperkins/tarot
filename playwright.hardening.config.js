import { defineConfig } from '@playwright/test';

// The hardening regressions stub APIs and exercise real rendered components.
// Override the origin to validate production assets on a running local Worker.
const baseURL = process.env.HARDENING_BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  testMatch: [
    'account-plan-hardening.spec.js',
    'journal-filter-hardening.spec.js',
    'share-note-hardening.spec.js',
    'storage-hardening.spec.js'
  ],
  fullyParallel: false,
  workers: 2,
  retries: 0,
  timeout: 45000,
  reporter: 'list',
  use: {
    baseURL,
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
    trace: 'off',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ],
  webServer: process.env.HARDENING_BASE_URL ? undefined : {
    command: 'npm run dev:frontend',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
