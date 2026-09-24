import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/mcpOAuthRouting.integration.spec.js'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://localhost:8787' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
  // No webServer: Task 17 starts Wrangler with the local config and migration.
});
