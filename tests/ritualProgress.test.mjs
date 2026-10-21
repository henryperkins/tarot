import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tarotStateHarness } from './helpers/tarotStateHarness.mjs';

test('drawing retains a performed ritual instead of presenting it as skipped', async () => {
  const harness = await tarotStateHarness({ preferences: { personalization: { showRitualSteps: true } } });
  try {
    let state = harness.render();
    for (let i = 0; i < 3; i++) { state.handleKnock(); state = harness.render(); }
    state.applyCut(); state = harness.render();
    state.shuffle(); harness.render(); harness.pendingShuffle()(); state = harness.render();
    assert.equal(state.ritualWasPerformed, true);
    assert.equal(state.knockCount, 3);
    assert.equal(state.hasCut, true);
    state.resetReadingState(); state = harness.render();
    assert.equal(state.ritualWasPerformed, false);
  } finally { harness.unmount(); }
});

test('synthetic skipped-ritual readiness is not presented as a performed ritual', async () => {
  const harness = await tarotStateHarness();
  try {
    let state = harness.render(); state.shuffle(); harness.render(); harness.pendingShuffle()(); state = harness.render();
    assert.equal(state.hasKnocked, true, 'retain established skip readiness');
    assert.equal(state.ritualWasPerformed, false);
  } finally { harness.unmount(); }
});

for (const [name, ritual, performed] of [
  ['performed', { hasKnocked: true, knockCount: 3, hasCut: true, knockTimes: [1200, 2340, 3500] }, true],
  ['skipped', { hasKnocked: true, knockCount: 3, hasCut: true, knockTimes: [100, 200, 300] }, false]
]) {
  test(`restored ${name} ritual keeps its truthful progress`, async t => {
    const h = await tarotStateHarness({ snapshot: { owner: 'user:owner-a', spreadKey: 'single', reading: [{ name: 'The Star' }], ritual } });
    t.after(() => h.unmount());
    assert.equal(h.render().ritualWasPerformed, performed);
  });
}

test('an actual cut counts even when ritual preferences are disabled', async t => {
  const h = await tarotStateHarness(); t.after(() => h.unmount());
  h.render().applyCut(); h.render().shuffle(); h.pendingShuffle()();
  assert.equal(h.render().ritualWasPerformed, true);
});

test('New reading does not reuse the previous reading ritual or its seed', async t => {
  const h = await tarotStateHarness({ preferences: { personalization: { showRitualSteps: true } } });
  t.after(() => h.unmount());
  let state = h.render();
  for (let i = 0; i < 3; i++) { state.handleKnock(); state = h.render(); }
  state.applyCut(); state = h.render();
  state.shuffle(); h.render(); h.pendingShuffle()(); state = h.render();
  assert.equal(state.ritualWasPerformed, true);
  assert.notEqual(state.sessionSeed, null);
  state.shuffle(); h.render(); h.pendingShuffle()(); state = h.render();
  assert.equal(state.ritualWasPerformed, false);
  assert.equal(state.hasKnocked, false);
  assert.equal(state.hasCut, false);
  assert.equal(state.knockCount, 0);
  assert.equal(state.sessionSeed, null);
});
