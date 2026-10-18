import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tarotStateHarness } from './helpers/tarotStateHarness.mjs';

const emptyReading = state => ({
  reading: state.reading, scope: state.drawIncludeMinors, seed: state.sessionSeed,
  shuffling: state.isShuffling, knocked: state.hasKnocked, cut: state.hasCut
});
const cleared = { reading: null, scope: null, seed: null, shuffling: false, knocked: false, cut: false };

test('an uninterrupted shuffle commits the chosen spread and its ritual', async t => {
  const h = await tarotStateHarness(); t.after(() => h.unmount());
  h.render().shuffle();
  assert.equal(h.render().isShuffling, true);
  h.pendingShuffle()();
  assert.equal(h.render().reading.length, 3);
  assert.equal(h.render().drawIncludeMinors, false);
  assert.equal(h.render().hasKnocked, true);
  assert.equal(h.render().hasCut, true);
  assert.equal(h.render().isShuffling, false);
});

test('draw deck stays with its cards when the preference changes; a new draw uses the new deck', async t => {
  const h = await tarotStateHarness({ preferences: { deckStyleId: 'thoth-a1' } });
  t.after(() => h.unmount());
  h.render().shuffle(); h.pendingShuffle()();
  h.preferences.deckStyleId = 'marseille-classic';
  assert.equal(h.render().drawDeckStyleId, 'thoth-a1');
  assert.equal(h.render().readingDeckStyleId, 'thoth-a1');
  h.render().shuffle(); h.pendingShuffle()();
  assert.equal(h.render().drawDeckStyleId, 'marseille-classic');
  h.render().resetReadingState();
  assert.equal(h.render().drawDeckStyleId, null);
});

test('restored draw deck and journal deck win over the current preference', async t => {
  const h = await tarotStateHarness({ preferences: { deckStyleId: 'rws-1909' }, snapshot: {
    owner: 'user:owner-a', spreadKey: 'threeCard', reading: [{ name: 'Temperance' }],
    analysis: { themes: { deckStyle: 'thoth-a1' } }
  } });
  t.after(() => h.unmount());
  assert.equal(h.render().readingDeckStyleId, 'thoth-a1');
  h.render().setReading([{ name: 'Death' }], false, 'marseille-classic');
  assert.equal(h.render().readingDeckStyleId, 'marseille-classic');
  h.render().setReading([{ name: 'The Star' }]);
  assert.equal(h.render().drawDeckStyleId, null, 'unknown imports do not inherit the previous draw deck');
});

for (const [name, invalidate] of [
  ['reset', (h, state) => state.resetReadingState()],
  ['spread selection', (h, state) => state.selectSpread('celtic')],
  ['direct spread replacement', (h, state) => state.setSelectedSpread('celtic')],
  ['logout', h => h.setOwner(null)],
  ['account switch', h => h.setOwner('owner-b')],
  ['auto-selected spread change', h => { h.preferences.personalization.preferredSpreadDepth = 'deep'; }]
]) {
  test(`a pending shuffle cannot restore cards, scope or ritual after ${name}`, async t => {
    const h = await tarotStateHarness();
    t.after(() => h.unmount());
    h.render().shuffle();
    const queued = h.pendingShuffle();
    assert.equal(typeof queued, 'function');
    invalidate(h, h.render());
    assert.equal(h.render().reading, null);
    // Even work already queued by the browser must not commit after cancel.
    queued();
    assert.deepEqual(emptyReading(h.render()), cleared);
  });
}

test('restoring a saved reading invalidates a pending shuffle even for the same spread', async t => {
  const h = await tarotStateHarness(); t.after(() => h.unmount());
  h.render().shuffle(); const queued = h.pendingShuffle();
  h.render().setReading([{ name: 'The Star' }], true);
  queued();
  assert.deepEqual(h.render().reading, [{ name: 'The Star' }]);
  assert.equal(h.render().drawIncludeMinors, true);
  assert.equal(h.render().isShuffling, false);
});

test('a superseded callback cannot finish a newer shuffle', async t => {
  const h = await tarotStateHarness(); t.after(() => h.unmount());
  h.render().shuffle(); const obsolete = h.pendingShuffle();
  h.render().shuffle(); const current = h.pendingShuffle();
  obsolete();
  assert.equal(h.render().reading, null);
  assert.equal(h.render().isShuffling, true);
  current();
  assert.equal(h.render().reading.length, 3);
  assert.equal(h.render().drawIncludeMinors, false);
  assert.equal(h.render().isShuffling, false);
  assert.equal(h.render().hasKnocked, true);
  assert.equal(h.render().hasCut, true);
});

test('an unmounted shuffle cannot commit an already queued callback', async () => {
  const h = await tarotStateHarness();
  h.render().shuffle(); const queued = h.pendingShuffle();
  h.unmount(); queued();
  assert.equal(h.render().reading, null);
  assert.equal(h.render().sessionSeed, null);
});

test('a cancellation from the shuffle-start callback prevents scheduling a draw', async t => {
  const h = await tarotStateHarness(); t.after(() => h.unmount());
  h.render().shuffle(() => h.render().resetReadingState());
  h.pendingShuffle()?.();
  assert.deepEqual(emptyReading(h.render()), cleared);
});
