import base from '../../playwright.config.js';

// Keep fixture verification on its own port beside an existing app development server.
export default {
  ...base,
  testDir: '../../e2e',
  testMatch: ['reading-gestures.spec.js', 'reading-gestures-lifecycle.spec.js', 'reading-gestures-dynamic.spec.js', 'reading-gestures-refinement.spec.js', 'reading-gestures-deck.spec.js'],
  workers: 1,
  reporter: 'list',
  use: { ...base.use, baseURL: 'http://localhost:5174' },
  webServer: {
    ...base.webServer,
    command: 'npm run dev:frontend -- --port 5174 --strictPort',
    url: 'http://localhost:5174',
  },
};
