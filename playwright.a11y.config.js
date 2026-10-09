import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for accessibility tests.
 * Starts its own strict test server.
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results/a11y',
  testMatch: 'accessibility.spec.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://127.0.0.1:5191',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Disable animations for test stability
    contextOptions: { reducedMotion: 'reduce' },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      grepInvert: /@mobile/,
    },
    // Mobile tests require webkit: npx playwright install webkit
    // {
    //   name: 'mobile',
    //   use: { ...devices['iPhone 13'] },
    //   grep: /@mobile/,
    // },
  ],

  webServer: {
    command: 'npm run dev:frontend -- --host 127.0.0.1 --port 5191 --strictPort',
    url: 'http://127.0.0.1:5191',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
