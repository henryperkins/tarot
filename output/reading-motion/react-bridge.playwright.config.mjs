import process from 'node:process';
import base from '../../playwright.config.js';

const qualification = process.argv.some(arg => arg.includes('reading-cue-qualification.spec.js')) || process.env.CUE_QUALIFICATION === 'true';
if (qualification) process.env.CUE_QUALIFICATION = 'true';

// Keep fixture verification on its own port beside an existing app development server.
export default {
  ...base,
  testDir: '../../e2e',
  testMatch: ['reading-cue-qualification.spec.js', 'reading-gestures.spec.js', 'reading-gestures-lifecycle.spec.js', 'reading-gestures-dynamic.spec.js', 'reading-gestures-refinement.spec.js', 'reading-gestures-deck.spec.js', 'reading-gestures-generated.spec.js', 'reading-visual-handoff.spec.js', 'journal-visual-restoration.spec.js'],
  workers: 1,
  ...(qualification ? { projects: [{ name: 'cue-qualification', use: { browserName: 'chromium', viewport: { width: 1100, height: 1000 }, contextOptions: { reducedMotion: 'no-preference' } } }], timeout: 420000, retries: 0, outputDir: process.env.CUE_EVIDENCE_DIR || 'test-results/cue-qualification' } : {}),
  reporter: 'list',
  // Controlled API routes must not escape interception through the app's SW.
  // Trace recording during the long frame-polled reader wait produced >100 ms
  // unobserved frames in the measured page (0/60 s without it, 9/60 s with it),
  // so timing qualification never records a Playwright trace.
  use: { ...base.use, baseURL: 'http://localhost:5174', serviceWorkers: 'block', ...(qualification ? { trace: 'off' } : {}) },
  webServer: qualification ? undefined : {
    ...base.webServer,
    command: 'VITE_READING_GESTURES=true npm run dev:frontend -- --port 5174 --strictPort',
    url: 'http://localhost:5174',
  },
};
