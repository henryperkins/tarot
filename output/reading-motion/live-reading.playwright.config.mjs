import base from '../../playwright.config.js';

// The real reading route opts into gestures only on this separate dev server.
export default {
  ...base,
  testDir: '../../e2e',
  testMatch: ['reading-gestures-live.spec.js', 'reading-reflection-gestures.spec.js', 'reading-gestures-geometry.spec.js'],
  workers: 1,
  reporter: 'list',
  use: { ...base.use, baseURL: 'http://localhost:5186', serviceWorkers: 'block' },
  webServer: {
    ...base.webServer,
    command: 'VITE_READING_GESTURES=true npm run dev:frontend -- --port 5186 --strictPort',
    url: 'http://localhost:5186',
    reuseExistingServer: false,
  },
};
