import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

let server;
let OnboardingProgress;

before(async () => {
  server = await createServer({
    configFile: false,
    cacheDir: fileURLToPath(new URL('../node_modules/.cache/onboarding-labels-vite', import.meta.url)),
    plugins: [react()],
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom'
  });
  ({ OnboardingProgress } = await server.ssrLoadModule('/src/components/onboarding/OnboardingProgress.jsx'));
});

after(async () => { await server?.close(); });

for (const currentStep of [1, 4, 7]) {
  test(`both onboarding layouts share numbered names and state at step ${currentStep}`, () => {
    const markup = renderToStaticMarkup(createElement(OnboardingProgress, { currentStep, totalSteps: 7 }));
    const names = [...markup.matchAll(/<button\b[^>]*aria-label="([^"]+)"/g)].map(([, name]) => name);
    const expected = ['Welcome', 'Account', 'Spreads', 'Question', 'Ritual', 'Journal', 'Begin'].map((label, i) => {
      const step = i + 1;
      return `${step} ${label}${step === currentStep ? ' (current)' : step < currentStep ? ' (completed)' : ''}`;
    });
    assert.deepEqual(names, [...expected, ...expected]);
    assert.equal((markup.match(/aria-current="step"/g) || []).length, 2);
    for (const [, name, content] of markup.matchAll(/<button\b[^>]*aria-label="([^"]+)"[^>]*>(.*?)<\/button>/gs)) {
      const visibleText = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      assert.ok(name.includes(visibleText), `${name} contains its visible number and label: ${visibleText}`);
    }
  });
}

test('custom and missing onboarding labels retain a meaningful step number in both layouts', () => {
  const markup = renderToStaticMarkup(createElement(OnboardingProgress, {
    currentStep: 2, totalSteps: 3, stepLabels: ['Bienvenue 🌿', '安心'], allowNavigation: false
  }));
  const names = [...markup.matchAll(/<button\b[^>]*aria-label="([^"]+)"/g)].map(([, name]) => name);
  assert.deepEqual(names, ['1 Bienvenue 🌿 (completed)', '2 安心 (current)', 'Step 3',
    '1 Bienvenue 🌿 (completed)', '2 安心 (current)', 'Step 3']);
  assert.equal((markup.match(/<button\b[^>]*disabled=""/g) || []).length, 6);
});
