import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', testMatch: 'navigation-gate1.spec.js',
  outputDir: process.env.NAV_OUTPUT_DIR || 'test-results/navigation',
  workers: 2, retries: 0, timeout: 30000, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4393', serviceWorkers: 'block',
    contextOptions: { reducedMotion: 'reduce' }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', grepInvert: /@webkit/, use: { browserName: 'chromium' } },
    { name: 'webkit', grep: /@webkit/, use: { browserName: 'webkit' } }
  ],
  webServer: { command: 'npm run dev:frontend -- --host 127.0.0.1 --port 4393 --strictPort',
    url: 'http://127.0.0.1:4393', reuseExistingServer: false, timeout: 120000 }
});
