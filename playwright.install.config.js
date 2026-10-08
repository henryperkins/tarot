import { defineConfig, devices } from '@playwright/test';

// Override the origin for a built HTTP preview. Reading fixtures stream through
// a local HTTP server; HTTPS smoke checks need a compatible fixture transport.
const baseURL = process.env.INSTALL_BASE_URL || 'http://127.0.0.1:5193';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['pwa-install.spec.js', 'pwa-install-lifecycle.spec.js', 'frontend-effect-state.spec.js'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: process.env.INSTALL_RESULTS_FILE || 'test-results/install-results.json' }]
  ],
  outputDir: 'test-results/install',
  use: {
    baseURL,
    contextOptions: { reducedMotion: 'reduce' },
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, grepInvert: /@mobile/ },
    {
      name: 'webkit',
      use: { ...devices['iPhone 13'], browserName: 'webkit' },
      grep: /@mobile|State ownership|Install guidance lifecycle/
    }
  ],
  webServer: process.env.INSTALL_BASE_URL ? undefined : {
    command: 'npm run dev:frontend -- --host 127.0.0.1 --port 5193 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000
  }
});
