import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.REGRESSION_BASE_URL || 'http://127.0.0.1:5198';
const profiles = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'webkit-desktop', use: { ...devices['Desktop Safari'] } },
  { name: 'webkit-iphone', use: { ...devices['iPhone 13'], browserName: 'webkit' } }
];

export default defineConfig({
  testDir: './e2e',
  testMatch: ['frontend-effect-state.spec.js', 'auth-route-recheck.spec.js', 'intention-polish.spec.js', 'startup-hardening.spec.js', 'frontend-state-sync.spec.js', 'onboarding-exit-focus.spec.js', 'intention-coach.spec.js', 'journal-filters.spec.js', 'cards-drawn-section.spec.js', 'frontend-p1-hardening.spec.js', 'pwa-install.spec.js'],
  fullyParallel: false,
  timeout: 60000,
  // Keep the six profiles sequential to avoid competing WebKit processes.
  workers: 1,
  retries: 0,
  reporter: 'list',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-mobile-{platform}{ext}',
  outputDir: process.env.REGRESSION_OUTPUT_DIR || 'test-results/regressions',
  use: {
    baseURL,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: profiles.flatMap(profile => ['reduce', 'no-preference'].map(reducedMotion => ({
    name: `${profile.name}-${reducedMotion}`,
    use: { ...profile.use, contextOptions: { reducedMotion } },
    ...(profile.name === 'webkit-iphone' ? { grep: /@mobile|State ownership|Auth checks|Onboarding exit|state transitions/ } : { grepInvert: /@mobile/ })
  }))),
  webServer: process.env.REGRESSION_BASE_URL ? undefined : {
    command: 'npm run dev:frontend -- --host 127.0.0.1 --port 5198 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000
  }
});
