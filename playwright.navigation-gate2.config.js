import { defineConfig, devices } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outputDir = process.env.NAV_GATE2_OUTPUT_DIR || 'test-results/navigation-gate2';
// Preserve the normal exclusion of optimized dependencies from React Refresh.
const cacheRoot = join(tmpdir(), `tableu-navigation-gate2-vite-${randomUUID()}`, 'node_modules');
const suites = [
  'navigation-gate1', 'navigation-gate2', 'navigation-integration', 'navigation-review-regressions', 'bottom-navigation-remediation', 'keyboard-viewport', 'responsive-adaptation', 'question-field',
  'mobile-overlays', 'frontend-p1-hardening', 'account-data-safety', 'account-recovery',
  'storage-hardening', 'account-plan-hardening', 'journal-responsive-adaptation',
  'journal-visual-restoration', 'reading-deck-scope', 'pwa-install',
  'pwa-install-lifecycle', 'share-note-hardening', 'page-transitions'
];

export default defineConfig({
  testDir: './e2e',
  testMatch: suites.map(name => `${name}.spec.js`),
  fullyParallel: true,
  workers: 4,
  retries: 0,
  timeout: 60000,
  outputDir,
  reporter: [['list'], ['json', { outputFile: `${outputDir}/results.json` }]],
  use: {
    baseURL: 'http://127.0.0.1:5191',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    contextOptions: { reducedMotion: 'reduce' }
  },
  projects: [
    { name: 'chromium', testIgnore: '**/journal-visual-restoration.spec.js', grepInvert: /@mobile|@webkit/, use: { ...devices['Desktop Chrome'], browserName: 'chromium' } },
    { name: 'chromium-mobile', testIgnore: '**/journal-visual-restoration.spec.js', grep: /@mobile/, use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'webkit', testIgnore: '**/journal-visual-restoration.spec.js', grepInvert: /@mobile|@webkit/, use: { ...devices['Desktop Safari'], browserName: 'webkit' } },
    { name: 'webkit-mobile', testIgnore: '**/journal-visual-restoration.spec.js', grep: /@mobile/, use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    ...[
      ['chromium-visual', 'Desktop Chrome', 'chromium', false],
      ['chromium-mobile-visual', 'Pixel 7', 'chromium', true],
      ['webkit-visual', 'Desktop Safari', 'webkit', false],
      ['webkit-mobile-visual', 'iPhone 13', 'webkit', true]
    ].map(([name, device, browserName, handset]) => ({
      name, testMatch: 'journal-visual-restoration.spec.js',
      // Bound the CPU-heavy restored-artwork lane without dropping cases.
      ...(browserName === 'webkit' ? { workers: 2 } : {}),
      ...(handset ? { grep: /@mobile/ } : { grepInvert: /@mobile/ }),
      use: { ...devices[device], browserName, baseURL: 'http://127.0.0.1:5192' }
    }))
  ],
  webServer: [{
    command: 'npm run dev:frontend -- --config vite.navigation-gate2.config.js --host 127.0.0.1 --port 5191 --strictPort',
    url: 'http://127.0.0.1:5191',
    reuseExistingServer: false,
    timeout: 120000,
    env: { NAV_GATE2_VITE_CACHE_DIR: join(cacheRoot, 'default') }
  }, {
    command: 'npm run dev:frontend -- --config vite.navigation-gate2.config.js --host 127.0.0.1 --port 5192 --strictPort',
    url: 'http://127.0.0.1:5192', reuseExistingServer: false, timeout: 120000,
    env: { NAV_GATE2_VITE_CACHE_DIR: join(cacheRoot, 'visual'), VITE_READING_GESTURES: 'true', VITE_READING_MODEL_ANNOTATIONS: 'true' }
  }]
});
