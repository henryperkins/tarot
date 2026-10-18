import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', testMatch: 'journey-p1.spec.js', workers: 1,
  outputDir: 'test-results/journey-p1', timeout: 30000, reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5187',
    viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce',
    serviceWorkers: 'block', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: 'npm run dev:frontend -- --host 127.0.0.1 --port 5187 --strictPort',
    url: 'http://127.0.0.1:5187', reuseExistingServer: false, timeout: 120000
  }
});
