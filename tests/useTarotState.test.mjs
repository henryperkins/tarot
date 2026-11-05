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
  ['account switch', h => h.setOwner('owner-b')]
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

test('choosing the spread already in use keeps its cards, ritual and a pending shuffle', async t => {
  const h = await tarotStateHarness(); t.after(() => h.unmount());
  h.render().shuffle(); h.pendingShuffle()();
  const { selectedSpread, reading } = h.render();
  assert.equal(reading.length, 3);
  h.render().chooseSpread(selectedSpread);
  assert.deepEqual(h.render().reading, reading);
  assert.equal(h.render().hasKnocked, true);
  assert.equal(h.render().hasCut, true);

  h.render().shuffle();
  const queued = h.pendingShuffle();
  h.render().chooseSpread(selectedSpread);
  queued();
  assert.equal(h.render().reading.length, 3, 'a re-tap during the shuffle does not cancel the draw');
});

test('a programmatic choice of the same spread still starts a fresh table', async t => {
  // Journal suggestions and restored follow-ups rely on selectSpread clearing
  // the previous cards and ritual even when the spread does not change.
  const h = await tarotStateHarness(); t.after(() => h.unmount());
  h.render().shuffle(); h.pendingShuffle()();
  const { selectedSpread } = h.render();
  h.render().selectSpread(selectedSpread);
  assert.deepEqual(emptyReading(h.render()), cleared);
});

test('choosing a different spread clears the table', async t => {
  const h = await tarotStateHarness(); t.after(() => h.unmount());
  h.render().shuffle(); h.pendingShuffle()();
  h.render().chooseSpread('fiveCard');
  assert.equal(h.render().selectedSpread, 'fiveCard');
  assert.deepEqual(emptyReading(h.render()), cleared);
});

test('re-choosing the default spread makes it the reader\'s choice without a reset', async t => {
  const h = await tarotStateHarness(); t.after(() => h.unmount());
  // The personalization default follows the preferred depth until a choice is made.
  assert.equal(h.render().selectedSpread, 'threeCard');
  h.render().chooseSpread('threeCard');
  h.preferences.personalization.preferredSpreadDepth = 'deep';
  assert.equal(h.render().selectedSpread, 'threeCard');
  assert.equal(h.savedSpreadDrafts.at(-1), 'threeCard');
});

test('a spread chosen before the draw survives a reload; a saved reading wins over it', async t => {
  const h = await tarotStateHarness({ spreadDraft: 'fiveCard' }); t.after(() => h.unmount());
  assert.equal(h.render().selectedSpread, 'fiveCard', 'the saved choice wins over the personalization default');
  h.render().chooseSpread('single');
  assert.equal(h.render().selectedSpread, 'single');
  assert.equal(h.savedSpreadDrafts.at(-1), 'single');

  const restored = await tarotStateHarness({ spreadDraft: 'fiveCard', snapshot: {
    owner: 'user:owner-a', spreadKey: 'threeCard', reading: [{ name: 'Temperance' }]
  } });
  t.after(() => restored.unmount());
  assert.equal(restored.render().selectedSpread, 'threeCard');
});

test('an untouched default is not saved as a choice', async t => {
  const h = await tarotStateHarness(); t.after(() => h.unmount());
  h.render();
  assert.deepEqual(h.savedSpreadDrafts, []);
});

test('an untouched spread follows preferences received before drawing', async t => {
  const h = await tarotStateHarness(); t.after(() => h.unmount());
  assert.equal(h.render().selectedSpread, 'threeCard');
  h.preferences.personalization.preferredSpreadDepth = 'deep';
  assert.equal(h.render().selectedSpread, 'celtic');
  assert.deepEqual(h.savedSpreadDrafts, []);
});

test('late preferences keep the accepted spread through shuffle, deal and reveal', async t => {
  const h = await tarotStateHarness(); t.after(() => h.unmount());
  h.render().shuffle();
  const queued = h.pendingShuffle();
  h.preferences.personalization.preferredSpreadDepth = 'deep';
  assert.equal(h.render().selectedSpread, 'threeCard');
  assert.equal(h.render().isShuffling, true, 'account loading must not cancel the draw');
  queued();
  assert.equal(h.render().reading.length, 3);
  h.render().dealSpread();
  h.preferences.personalization.preferredSpreadDepth = 'short';
  assert.equal(h.render().selectedSpread, 'threeCard');
  assert.equal(h.render().reading.length, 3);
  h.render().dealNext();
  assert.deepEqual([...h.render().revealedCards], [0]);
});

test('drawing accepts the personalized spread shown instead of the initial fallback', async t => {
  const h = await tarotStateHarness({ preferences: {
    personalization: { preferredSpreadDepth: 'deep', showRitualSteps: true }
  } });
  t.after(() => h.unmount());
  assert.equal(h.render().selectedSpread, 'celtic');
  h.render().shuffle();
  assert.equal(h.render().selectedSpread, 'celtic');
  h.pendingShuffle()();
  h.preferences.personalization.preferredSpreadDepth = 'short';
  assert.equal(h.render().selectedSpread, 'celtic');
  assert.equal(h.render().reading.length, 10);
  assert.equal(h.savedSpreadDrafts.at(-1), 'celtic', 'the accepted spread survives a reload');
});

test('a plan fallback stands in for a locked spread without replacing the saved choice', async t => {
  const freePlan = ['single', 'threeCard', 'fiveCard'];
  const h = await tarotStateHarness({
    spreadDraft: 'celtic',
    subscription: { canUseSpread: key => freePlan.includes(key), config: { spreads: freePlan } }
  });
  t.after(() => h.unmount());
  assert.equal(h.render().selectedSpread, 'celtic');
  const savedBefore = h.savedSpreadDrafts.length;
  h.flushFrames();
  const { selectedSpread } = h.render();
  assert.ok(freePlan.includes(selectedSpread), `fallback ${selectedSpread} is on the plan`);
  assert.equal(h.savedSpreadDrafts.slice(savedBefore).includes(selectedSpread), false, 'the substitute is not saved');
  h.render().shuffle();
  h.pendingShuffle()();
  h.preferences.personalization.preferredSpreadDepth = 'short';
  assert.equal(h.render().selectedSpread, selectedSpread, 'the fallback draw keeps its accepted spread');
  assert.equal(h.savedSpreadDrafts.slice(savedBefore).includes(selectedSpread), false, 'drawing a fallback preserves the saved choice');
  h.render().chooseSpread(selectedSpread);
  assert.equal(h.render().selectedSpread, selectedSpread);
  assert.equal(h.savedSpreadDrafts.at(-1), selectedSpread, 'choosing it afterwards does save it');
});
