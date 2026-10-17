import base from '../../playwright.config.js';

export default {
  ...base,
  testDir: '../../e2e',
  testMatch: ['reading-visual-disabled.spec.js'],
  projects: base.projects.filter(project => project.name === 'chromium'),
  workers: 1,
  reporter: 'list',
  use: { ...base.use, baseURL: 'http://localhost:5187', serviceWorkers: 'block' },
  webServer: {
    ...base.webServer,
    command: 'VITE_READING_GESTURES=false npm run dev:frontend -- --port 5187 --strictPort',
    url: 'http://localhost:5187',
    reuseExistingServer: false,
  },
};
