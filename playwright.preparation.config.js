import { defineConfig } from '@playwright/test';

const baseURL = process.env.PREPARATION_BASE_URL || 'http://127.0.0.1:5234';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['reading-preparation.spec.js', 'reading-reference-design.spec.js'],
  outputDir: 'test-results/reading-preparation',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  reporter: 'list',
  use: {
    baseURL,
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'block',
    contextOptions: { reducedMotion: 'reduce' },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ],
  webServer: process.env.PREPARATION_BASE_URL ? undefined : {
    command: 'npm run dev:frontend -- --host 127.0.0.1 --port 5234 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000
  }
});
