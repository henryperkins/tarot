import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Frontend-only runs: skip integration-tagged specs that require Workers
  testIgnore: ['**/*.integration.spec.js'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Disable animations for test stability - triggers useReducedMotion hook
    reducedMotion: 'reduce',
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      grep: /@desktop/,
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
      grep: /@mobile/,
    },
  ],

  webServer: {
    command: 'npm run dev:frontend',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
