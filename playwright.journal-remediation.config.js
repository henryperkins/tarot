import { defineConfig } from '@playwright/test';

const baseURL = process.env.JOURNAL_REMEDIATION_BASE_URL || 'http://127.0.0.1:5193';
export default defineConfig({
  testDir: './e2e', testMatch: ['journal-remediation.spec.js', 'journal-filter-hardening.spec.js', 'journal-owner.spec.js', 'journal-responsive-adaptation.spec.js'],
  outputDir: 'test-results/journal-remediation', fullyParallel: false, workers: 2, retries: 0, timeout: 45000,
  reporter: 'list',
  use: { baseURL, serviceWorkers: 'block', contextOptions: { reducedMotion: 'reduce' }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: process.env.JOURNAL_REMEDIATION_BASE_URL ? undefined : {
    command: 'npm run dev:frontend -- --host 127.0.0.1 --port 5193 --strictPort', url: baseURL, reuseExistingServer: false, timeout: 120000
  }
});
