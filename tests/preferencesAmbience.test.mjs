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

// --- Choices made in another tab ----------------------------------------------

// Another tab's write, as this tab sees it: the shared store already holds
// the new value when the storage event arrives. Returns what this tab wrote
// to the store while handling the event.
function fromAnotherTab({ values, tab }, change) {
  const event = Object.assign(new Event('storage'), change(values));
  const writes = [];
  const set = values.set;
  values.set = (key, value) => { writes.push([key, value]); return set.call(values, key, value); };
  tab.dispatchEvent(event);
  values.set = set;
  return writes;
}

async function openTab(saved) {
  const tab = new EventTarget();
  const opened = await open({ saved, overrides: { window: tab } });
  opened.player.length = 0;
  return { ...opened, tab };
}

test('ambience turned off in another tab stops this tab without saving anything', async () => {
  const opened = await openTab('true');
  const writes = fromAnotherTab(opened, values => { values.set(KEY, 'false'); return { key: KEY, newValue: 'false' }; });
  assert.deepEqual(opened.player.map(([on]) => on), [false]);
  assert.equal(opened.harness.render().ambienceOn, false);
  assert.deepEqual(writes.filter(([key]) => key === KEY), [], 'a received choice must not be written back');
});

test('ambience turned on in another tab switches this tab on and waits for an interaction here', async () => {
  const opened = await openTab('false');
  const writes = fromAnotherTab(opened, values => { values.set(KEY, 'true'); return { key: KEY, newValue: 'true' }; });
  assert.deepEqual(opened.player, [[true, { waitForInteraction: true }]]);
  assert.equal(opened.harness.render().ambienceOn, true);
  assert.deepEqual(writes.filter(([key]) => key === KEY), []);
});

test('removing the saved ambience choice in another tab turns this tab off', async () => {
  const opened = await openTab('true');
  fromAnotherTab(opened, values => { values.delete(KEY); return { key: KEY, newValue: null }; });
  assert.deepEqual(opened.player.map(([on]) => on), [false]);
  assert.equal(opened.harness.render().ambienceOn, false);
});

test('clearing storage in another tab turns this tab off', async () => {
  const opened = await openTab('true');
  fromAnotherTab(opened, values => { values.clear(); return { key: null, newValue: null }; });
  assert.deepEqual(opened.player.map(([on]) => on), [false]);
  assert.equal(opened.harness.render().ambienceOn, false);
});

test('the saved value decides, not the event that announced it', async () => {
  const opened = await openTab('true');
  // The other tab went Off and back On before this event was delivered.
  fromAnotherTab(opened, () => ({ key: KEY, newValue: 'false' }));
  assert.deepEqual(opened.player, []);
  assert.equal(opened.harness.render().ambienceOn, true);
});

test('a change to another saved setting leaves ambience alone', async () => {
  const opened = await openTab('true');
  fromAnotherTab(opened, values => { values.set('tarot-theme', 'light'); values.set(KEY, 'false'); return { key: 'tarot-theme', newValue: 'light' }; });
  assert.deepEqual(opened.player, []);
  assert.equal(opened.harness.render().ambienceOn, true);
});

test('the switch still works when the browser refuses to store the choice', async () => {
  const blocked = { getItem: () => null, setItem: () => false, removeItem() {} };
  const { harness, player, state } = await open({ overrides: { safeStorage: blocked, safeSessionStorage: blocked } });
  state.setAmbienceOn(true);
  assert.deepEqual(player, [[true]]);
  assert.equal(harness.render().ambienceOn, true);
  harness.render().setAmbienceOn(false);
  assert.deepEqual(player, [[true], [false]]);
  assert.equal(harness.render().ambienceOn, false);
});
