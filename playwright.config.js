import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Frontend-only runs: skip integration-tagged specs that require Workers, and
  // the journal owner spec, which uses its own Worker MCP fixture (test:e2e:journal).
  testIgnore: ['**/*.integration.spec.js', '**/journal-owner.spec.js'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  outputDir: 'test-results/frontend',

  use: {
    baseURL: 'http://127.0.0.1:5190',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Disable animations for test stability - triggers useReducedMotion hook
    contextOptions: { reducedMotion: 'reduce' },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // Run all untagged tests on desktop; mobile-only specs opt-in via @mobile.
      grepInvert: /@mobile/,
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
      grep: /@mobile/,
    },
  ],

  webServer: {
    command: 'npm run dev:frontend -- --host 127.0.0.1 --port 5190 --strictPort',
    url: 'http://127.0.0.1:5190',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
