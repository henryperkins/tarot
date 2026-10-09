import base from '../../playwright.config.js';

// Keep fixture verification on its own port beside an existing app development server.
export default {
  ...base,
  testDir: '../../e2e',
  testMatch: ['reading-gestures.spec.js', 'reading-gestures-lifecycle.spec.js', 'reading-gestures-dynamic.spec.js', 'reading-gestures-refinement.spec.js', 'reading-gestures-deck.spec.js', 'reading-gestures-generated.spec.js', 'reading-visual-handoff.spec.js', 'journal-visual-restoration.spec.js'],
  workers: 1,
  reporter: 'list',
  // Controlled API routes must not escape interception through the app's SW.
  use: { ...base.use, baseURL: 'http://localhost:5174', serviceWorkers: 'block' },
  webServer: {
    ...base.webServer,
    command: 'VITE_READING_GESTURES=true npm run dev:frontend -- --port 5174 --strictPort',
    url: 'http://localhost:5174',
  },
};
