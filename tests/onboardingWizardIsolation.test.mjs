import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const wizardSource = await readFile(new URL('../src/components/onboarding/OnboardingWizard.jsx', import.meta.url), 'utf8');

test('onboarding wizard isolates the background while open', () => {
  const call = wizardSource.match(/useModalA11y\(isOpen, \{([\s\S]*?)\}\);/);
  assert.ok(call, 'wizard should configure useModalA11y');
  assert.match(call[1], /isolateBackground:\s*true/, 'background must be inert + aria-hidden so only the wizard heading is exposed');
});

test('onboarding wizard dialog keeps a single labelled heading', () => {
  assert.match(wizardSource, /role="dialog"/);
  assert.match(wizardSource, /aria-modal="true"/);
  assert.match(wizardSource, /aria-labelledby=\{titleId\}/);
  assert.match(wizardSource, /<h1 id=\{titleId\} className="sr-only">\s*Welcome to Tableu\s*<\/h1>/);
});

test('onboarding wizard uses semantic ambient surface, themed scrollbars, and consistent header ordering', () => {
  assert.match(wizardSource, /onboarding-modal__ambient/);
  assert.doesNotMatch(wizardSource, /rgba\(169,\s*146,\s*255/);
  assert.match(wizardSource, /onboarding-modal__scroll\s+scrollbar-themed/);
  const closeIdx = wizardSource.indexOf('ref={closeButtonRef}');
  const progressIdx = wizardSource.indexOf('<OnboardingProgress');
  assert.ok(closeIdx > 0 && progressIdx > closeIdx, 'close button should remain first in DOM order for initial focus and tab wrapping');
});
