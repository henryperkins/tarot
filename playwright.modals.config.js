import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.MODAL_BASE_URL || 'http://127.0.0.1:5197';
const profiles = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'webkit-desktop', use: { ...devices['Desktop Safari'] } },
  { name: 'webkit-iphone', use: { ...devices['iPhone 13'], browserName: 'webkit' } }
];

export default defineConfig({
  testDir: './e2e',
  testMatch: ['saved-intentions-modal.spec.js', 'onboarding-exit-focus.spec.js'],
  fullyParallel: false,
  timeout: 60000,
  // Keep the six profiles sequential to avoid competing WebKit processes.
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: process.env.MODAL_OUTPUT_DIR || 'test-results/modals',
  use: {
    baseURL,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: profiles.flatMap(profile => ['reduce', 'no-preference'].map(reducedMotion => ({
    name: `${profile.name}-${reducedMotion}`,
    use: { ...profile.use, contextOptions: { reducedMotion } }
  }))),
  webServer: process.env.MODAL_BASE_URL ? undefined : {
    command: 'npm run dev:frontend -- --host 127.0.0.1 --port 5197 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000
  }
});
