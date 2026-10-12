import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = Number(process.env.READING_REVIEW_PORT || 5214);
const baseURL = `http://127.0.0.1:${port}`;
// Routine checks stay on the changed UI. The larger fixture matrix is opt-in.
const extendedMatrix = process.env.READING_REVIEW_MATRIX === '1';
const uiTests = ['reading-card-touch.spec.js', 'reading-purpose-ui.spec.js'];
const flowTests = ['reading-card-touch.spec.js', 'reading-purpose-ui.spec.js', 'reading-purpose-matrix.spec.js', 'reading-purpose-edges.spec.js', 'reading-purpose-owner.spec.js'];
const supportingTests = ['reading-visual-modals.spec.js', 'narrative-remediation.spec.js', 'reading-input-usage.spec.js', 'spread-insights.spec.js', 'media-narration-reliability.spec.js'];
export default defineConfig({
  testDir: './e2e',
  testMatch: [...flowTests, ...supportingTests],
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: join(tmpdir(), 'tableu-reading-purpose/results.json') }]],
  outputDir: join(tmpdir(), 'tableu-reading-purpose/artifacts'),
  use: { baseURL, serviceWorkers: 'block', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: ['chromium', 'webkit'].flatMap(browserName => ['desktop', 'phone'].flatMap(size => ['no-preference', 'reduce'].map(reducedMotion => ({
    name: `${browserName}-${size}-${reducedMotion}`,
    // Supporting suites contain their own width/theme/state loops. Run those
    // in complementary engines/motion modes; exercise the core journey in all eight.
    testMatch: !extendedMatrix ? uiTests : (browserName === 'chromium' && size === 'desktop' && reducedMotion === 'no-preference')
      || (browserName === 'webkit' && size === 'phone' && reducedMotion === 'reduce')
      ? [...flowTests, ...supportingTests] : flowTests,
    use: {
      ...(size === 'phone' ? devices['iPhone 13'] : devices['Desktop Chrome']),
      browserName,
      contextOptions: { reducedMotion }
    }
  })))).filter(project => extendedMatrix || ['chromium-desktop-no-preference', 'webkit-phone-no-preference'].includes(project.name)),
  webServer: {
    command: `npx vite --config vite.reading-purpose.config.js --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000
  }
});
