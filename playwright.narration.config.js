import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['narration-cancellation.spec.js', 'narration-defaults.spec.js', 'narration-lifecycle.spec.js', 'media-narration-reliability.spec.js'],
  fullyParallel: false, workers: 1, retries: 0, timeout: 60000,
  reporter: 'list', outputDir: 'test-results/narration',
  use: {
    baseURL: 'http://127.0.0.1:5197', serviceWorkers: 'block',
    contextOptions: { reducedMotion: 'reduce' }, screenshot: 'only-on-failure', trace: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'] } },
    { name: 'webkit-iphone', use: { ...devices['iPhone 13'] } }
  ],
  webServer: {
    command: 'npm run dev:frontend -- --host 127.0.0.1 --port 5197 --strictPort',
    url: 'http://127.0.0.1:5197', reuseExistingServer: false, timeout: 120000
  }
});
