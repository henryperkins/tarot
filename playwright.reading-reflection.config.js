import { defineConfig, devices } from '@playwright/test';

const port = 5218;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: 'reading-reflection-gestures.spec.js',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: 'test-results/reading-reflection',
  use: {
    baseURL,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    contextOptions: { reducedMotion: 'reduce' }
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 13'] } }
  ],
  webServer: {
    command: `npm run dev:frontend -- --config vite.reading-reflection.config.js --host 127.0.0.1 --port ${port} --strictPort`,
    env: {
      VITE_READING_ALIGNER_ENABLED: 'true',
      VITE_READING_MODEL_ANNOTATIONS: 'true'
    },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000
  }
});
