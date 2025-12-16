import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Integration Test Configuration
 *
 * This configuration runs E2E tests against the FULL STACK (Vite + Workers).
 * Use this for testing features that require the Worker API backend.
 *
 * Key differences from playwright.config.js (frontend-only):
 * - Starts full dev environment (Vite + Wrangler Workers)
 * - Tests against Workers port (8787) for full API coverage
 * - Longer timeout to allow Workers to start
 * - Runs integration-specific test files (*.integration.spec.js)
 *
 * Requirements:
 * - .dev.vars file with API credentials (AZURE_*, etc.)
 * - All Cloudflare bindings available locally
 *
 * Usage:
 *   npm run test:e2e:integration
 */

export default defineConfig({
  testDir: './e2e',
  // Run the full E2E suite (all specs) against the Workers backend
  testMatch: ['**/*.spec.js'],

  fullyParallel: false, // Sequential for full-stack tests to avoid port conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1, // Single worker for integration tests

  reporter: [
    ['html', { outputFolder: 'playwright-report-integration' }],
    ['list']
  ],

  use: {
    // Point to Workers server which proxies to Vite for assets
    baseURL: 'http://localhost:8787',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'integration-desktop',
      use: { ...devices['Desktop Chrome'] },
      grep: /@desktop|@integration/,
    },
    {
      name: 'integration-mobile',
      use: { ...devices['iPhone 13'] },
      grep: /@mobile|@integration/,
    },
  ],

  webServer: {
    // Start full stack: Vite + Wrangler Workers
    command: 'npm run dev',
    url: 'http://localhost:8787',
    reuseExistingServer: !process.env.CI,
    // Longer timeout for full stack startup (builds frontend, starts Workers)
    timeout: 180000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
