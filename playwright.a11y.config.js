import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for accessibility tests.
 * Uses existing dev server if available, otherwise starts one.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'accessibility.spec.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Disable animations for test stability
    reducedMotion: 'reduce',
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
    command: 'npm run dev:frontend',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60000,
  },
});
