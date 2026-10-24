import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'reading-reference-preview.spec.js',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  reporter: [['list']],
  outputDir: '../output/playwright/reading-reference-preview',
  use: {
    baseURL: 'http://localhost:5190',
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
    contextOptions: { reducedMotion: 'reduce' },
    // Real login uses a private password; request traces/storage state are never saved.
    trace: 'off',
    screenshot: 'off'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 1000 } } }
  ],
  webServer: {
    command: 'npm run dev:frontend -- --host 127.0.0.1 --port 5190 --strictPort',
    url: 'http://127.0.0.1:5190',
    reuseExistingServer: false,
    timeout: 120000
  }
});
