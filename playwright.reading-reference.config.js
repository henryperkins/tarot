import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'reading-reference-design.spec.js',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  reporter: 'list',
  outputDir: '/tmp/tableu-reading-master-results',
  use: {
    baseURL: 'http://127.0.0.1:5228',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], contextOptions: { reducedMotion: 'reduce' } } },
    { name: 'chromium-phone', use: { ...devices['iPhone 13'], browserName: 'chromium', contextOptions: { reducedMotion: 'reduce' } } },
    { name: 'webkit-phone', use: { ...devices['iPhone 13'], browserName: 'webkit', contextOptions: { reducedMotion: 'reduce' } } }
  ],
  webServer: {
    command: 'npm run dev:frontend -- --host 127.0.0.1 --port 5228 --strictPort',
    url: 'http://127.0.0.1:5228',
    reuseExistingServer: false,
    timeout: 120000
  }
});
