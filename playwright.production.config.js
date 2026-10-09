import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PRODUCTION_BASE_URL || 'http://127.0.0.1:5199';
export default defineConfig({
  testDir: './e2e',
  testMatch: ['initial-loading.spec.js', 'startup-polish.spec.js'],
  workers: 1, retries: 0, timeout: 60000, reporter: 'list',
  outputDir: 'test-results/production',
  use: {
    baseURL, serviceWorkers: 'block', contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure', screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, grepInvert: /@mobile/ },
    { name: 'webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' }, grep: /@mobile/ }
  ],
  webServer: process.env.PRODUCTION_BASE_URL ? undefined : {
    command: 'npm run preview -- --host 127.0.0.1 --port 5199 --strictPort',
    url: baseURL, reuseExistingServer: false, timeout: 120000
  }
});
