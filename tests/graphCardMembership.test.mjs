import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectAllPatterns, detectSuitProgressions } from '../functions/lib/knowledgeGraph.js';
import { buildGraphContext } from '../functions/lib/graphContext.js';
import { startReadingJob } from '../functions/lib/readingJobs.js';

const card = (name, extra = {}) => ({ card: name, position: 'Theme', orientation: 'Upright', meaning: 'Reflection', ...extra });

test('duplicate pips cannot strengthen a suit progression and all slots survive', () => {
  const cards = [card('Ace of Cups'), card('Two of Cups'), card('Two of Cups', { orientation: 'Reversed' })];
  const [progression] = detectSuitProgressions(cards);
  assert.equal(progression.significance, 'emerging-progression');
  assert.equal(progression.stageCardCount, 2);
  assert.deepEqual(progression.matchedCardIndices, [0, 1, 2]);
});

test('duplicate court cannot manufacture a council', () => {
  const patterns = detectAllPatterns([card('Queen of Cups'), card('King of Cups'), card('King of Cups')]);
  assert.equal(patterns.courtLineages[0].significance, 'alliance');
  assert.equal(patterns.courtLineages[0].count, 2);
  assert.deepEqual(patterns.courtLineages[0].matchedCardIndices, [0, 1, 2]);
});

test('repeated Thoth titles cannot create a current', () => {
  const patterns = detectAllPatterns([card('Two of Cups'), card('Two of Cups')], { deckStyle: 'thoth-a1' });
  assert.equal(patterns.thothEpithets.suitHighlights.length, 0);
  assert.equal(patterns.thothEpithets.entries.length, 1);
  assert.deepEqual(patterns.thothEpithets.entries[0].matchedCardIndices, [0, 1]);
});

test('Marseille clusters require distinct cards but retain equal ranks across suits', () => {
  const options = { deckStyle: 'marseille-classic' };
  assert.equal(detectAllPatterns([card('Two of Cups'), card('Two of Cups')], options)?.marseillePip, undefined);
  const patterns = detectAllPatterns([card('Two of Cups'), card('Two of Swords')], options);
  assert.equal(patterns.marseillePip.numerologyClusters[0].cards.length, 2);
});

test('duplicate Major slots do not inflate graph total or lose indices', () => {
  const graph = buildGraphContext([card('The Sun', { number: 19 }), card('The Sun', { number: 19 })]);
  assert.equal(graph.graphKeys.totalMajors, 1);
  assert.deepEqual(graph.patterns.foolsJourney.matchedCardIndices, [0, 1]);
});

test('public and principal job admission reject duplicates before DO creation', async () => {
  let calls = 0;
  const env = { READING_JOBS: { idFromName() { calls++; throw new Error('must not allocate a job'); } } };
  for (const principal of [null, { userId: 'synthetic-owner' }]) {
    const result = await startReadingJob({ env, principal, payload: {
      spreadInfo: { name: 'Three-Card Story' },
      cardsInfo: [card('The Sun'), card('The Sun'), card('The Moon')]
    } });
    assert.equal(result.status, 400);
    assert.equal(result.code, 'duplicate_card_identity');
  }
  assert.equal(calls, 0);
});

test('grouping preserves Thoth resolved courts and excludes invalid internal identities', async () => {
  const { groupGraphCardIdentities } = await import('../functions/lib/graphCardMembership.js');
  const result = groupGraphCardIdentities([
    card('Prince of Cups', { canonicalName: 'Knight of Cups', canonicalKey: 'knight of cups' }),
    card('Prince of Cups', { canonicalName: 'Knight of Cups', orientation: 'Reversed' }),
    card('Unknown', { number: 19, suit: 'Cups', rankValue: 2 })
  ], { deckStyle: 'thoth-a1' });
  assert.deepEqual(result.invalidIndices, [2]);
  assert.equal(result.members.length, 1);
  assert.equal(result.members[0].canonicalKey, 'knight of cups');
  assert.deepEqual(result.members[0].indices, [0, 1]);
});

test('historical canonicalization retains duplicate-bearing saved readings', async () => {
  const { canonicalizeReadingCards } = await import('../functions/lib/readingCardResolution.js');
  const saved = [card('The Sun'), card('The Sun', { orientation: 'Reversed' })];
  assert.equal(canonicalizeReadingCards(saved).length, 2);
  assert.deepEqual(canonicalizeReadingCards(saved).map(c => c.orientation), ['Upright', 'Reversed']);
});

test('unknown internal labels contribute no Major strength or matching slots', () => {
  const patterns = detectAllPatterns([
    card('Unknown', { number: 13 }), card('Temperance', { number: 14 }), card('The Star', { number: 17 })
  ]);
  const triad = patterns.triads.find(row => row.id === 'death-temperance-star');
  assert.equal(triad.isComplete, false);
  assert.deepEqual(triad.matchedCards, [14, 17]);
  assert.deepEqual(triad.matchedCardIndices, [1, 2]);
});

test('catalog identity governs internal metadata and invalid pips do not acquire slots', () => {
  const invalid = card('Unknown', { suit: 'Cups', rankValue: 2 });
  const cards = [invalid, card('Ace of Cups', { number: 13 }), card('Two of Cups')];
  const patterns = detectAllPatterns(cards);
  assert.equal(patterns.foolsJourney, undefined);
  assert.deepEqual(patterns.suitProgressions[0].matchedCardIndices, [1, 2]);
});

test('public job HTTP admission exposes the stable duplicate code without creating a job', async () => {
  const { onRequestPost } = await import('../functions/api/tarot-reading-job-start.js');
  let allocations = 0;
  const response = await onRequestPost({ env: { READING_JOBS: { idFromName() { allocations++; throw new Error('unexpected job allocation'); } } },
    request: new Request('https://tableau.test/api/tarot-reading/jobs', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ spreadInfo: { name: 'Three-Card Story' }, cardsInfo: [card('The Sun'), card('The Sun'), card('The Moon')] }) }) });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'duplicate_card_identity');
  assert.equal(allocations, 0);
});
