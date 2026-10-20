import { defineConfig } from '@playwright/test';
import path from 'node:path';

const evidenceDir = path.resolve(process.env.CARD_INSPECTION_OUTPUT || 'output/playwright/card-inspection');

// This suite owns its source server. Browser plugin not available; use the
// installed Playwright browsers and deterministic local narrative fixtures.
export default defineConfig({
  testDir: './e2e',
  testMatch: ['card-inspection.spec.js', 'reading-reference-images.spec.js'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 6000 },
  reporter: [['list'], ['json', { outputFile: path.join(evidenceDir, 'results.json') }]],
  outputDir: path.join(evidenceDir, 'test-results'),
  use: {
    baseURL: 'http://127.0.0.1:5199',
    viewport: { width: 402, height: 724 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  projects: ['chromium', 'webkit'].flatMap(browserName => ['motion', 'reduce'].map(motion => ({
    name: `${browserName}-${motion}`,
    use: { browserName, contextOptions: { reducedMotion: motion === 'reduce' ? 'reduce' : 'no-preference' } }
  }))),
  webServer: {
    command: 'npm run dev:frontend -- --host 127.0.0.1 --port 5199 --strictPort',
    url: 'http://127.0.0.1:5199',
    reuseExistingServer: false,
    timeout: 120000
  }
});
