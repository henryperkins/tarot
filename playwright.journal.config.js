import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  outputDir: 'test-results/journal',
  testDir: './e2e', testMatch: 'journal-owner.spec.js', workers: 1,
  timeout: 60000, reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5176', contextOptions: { reducedMotion: 'reduce' }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: 'npm run dev:frontend -- --host 127.0.0.1 --port 5176 --strictPort',
    url: 'http://127.0.0.1:5176', reuseExistingServer: false, timeout: 120000
  }
});
