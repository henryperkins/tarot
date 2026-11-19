import assert from 'node:assert/strict';
import test from 'node:test';
import { preferencesAccountHarness } from './helpers/preferencesAccountHarness.mjs';

const KEY = 'tarot-ambience-enabled';

// Opens the real provider for a guest, with a player that records its calls.
async function open({ saved, overrides = {} } = {}) {
  const player = [];
  const values = new Map(saved === undefined ? [] : [[KEY, saved]]);
  const harness = await preferencesAccountHarness({
    owner: null,
    values,
    overrides: { toggleAmbience: (...args) => player.push(args), ...overrides }
  });
  return { harness, player, values, state: harness.render() };
}

test('a saved On preference gets one start attempt when the app opens', async () => {
  const { harness, player, state } = await open({ saved: 'true' });
  harness.render();
  assert.equal(state.ambienceOn, true);
  assert.deepEqual(player, [[true]]);
});

test('a saved Off preference leaves the player alone when the app opens', async () => {
  const { player, state } = await open({ saved: 'false' });
  assert.equal(state.ambienceOn, false);
  assert.deepEqual(player, []);
});

test('turning ambience on starts the player inside the interaction', async () => {
  const { harness, player, state } = await open();
  state.setAmbienceOn(true);
  assert.deepEqual(player, [[true]], 'the player must start before React renders again');
  assert.equal(harness.render().ambienceOn, true);
  assert.deepEqual(player, [[true]], 'rendering must not start it a second time');
});

test('turning ambience off stops the player inside the interaction', async () => {
  const { harness, player, state } = await open({ saved: 'true' });
  state.setAmbienceOn(false);
  assert.deepEqual(player, [[true], [false]]);
  assert.equal(harness.render().ambienceOn, false);
  assert.deepEqual(player, [[true], [false]]);
});
