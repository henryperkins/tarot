import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  READING_SNAPSHOT_MAX_AGE_MS,
  READING_SNAPSHOT_STORAGE_KEY,
  buildReadingSnapshot,
  clearReadingSnapshot,
  loadReadingSnapshot,
  saveReadingSnapshot,
  snapshotBelongsTo
} from '../src/lib/readingSnapshot.js';

function createStorage() {
  const values = new Map();
  return {
    getItem: key => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    raw: key => values.get(key)
  };
}

const NOW = 1_800_000_000_000;
const cards = [
  { name: 'The Star', isReversed: false, upright: 'Hope', reversed: 'Doubt' },
  { name: 'Six of Swords', isReversed: true, upright: 'Transition', reversed: 'Stuck' },
  { name: 'Queen of Cups', isReversed: false, upright: 'Care', reversed: 'Overwhelm' }
];

function snapshot(overrides = {}) {
  return buildReadingSnapshot({
    owner: 'guest',
    spreadKey: 'threeCard',
    reading: cards,
    isSpreadDealt: true,
    revealedCards: new Set([0, 2]),
    dealIndex: 3,
    hasConfirmedSpread: true,
    sessionSeed: 'seed-1',
    ritual: { hasKnocked: true, knockCount: 3, hasCut: true, cutIndex: 39, knockTimes: [10, 20, 30, 40] },
    question: 'How can I rest?',
    reflections: { 0: 'Feels hopeful', 1: '' },
    now: NOW,
    ...overrides
  });
}

describe('reading snapshot', () => {
  let storage;
  beforeEach(() => {
    storage = createStorage();
  });

  it('keeps nothing until cards are drawn', () => {
    assert.equal(buildReadingSnapshot({ owner: 'guest', spreadKey: 'threeCard', reading: null }), null);
    assert.equal(buildReadingSnapshot({ owner: 'guest', spreadKey: 'threeCard', reading: [] }), null);
  });

  it('round-trips the drawn spread, ritual, question and reflections', () => {
    saveReadingSnapshot(snapshot(), { storage });
    const restored = loadReadingSnapshot({ storage, now: NOW + 1000 });
    assert.deepEqual(restored.reading.map(card => card.name), ['The Star', 'Six of Swords', 'Queen of Cups']);
    assert.equal(restored.reading[1].isReversed, true);
    assert.deepEqual(restored.revealed, [0, 2]);
    assert.equal(restored.isSpreadDealt, true);
    assert.equal(restored.sessionSeed, 'seed-1');
    assert.deepEqual(restored.ritual, { hasKnocked: true, knockCount: 3, hasCut: true, cutIndex: 39, knockTimes: [20, 30, 40] });
    assert.equal(restored.question, 'How can I rest?');
    assert.deepEqual(restored.reflections, { 0: 'Feels hopeful' });
    assert.equal(restored.narrative, null);
  });

  it('preserves draw scope even when a full-deck draw contains only Major cards', () => {
    for (const drawIncludeMinors of [true, false]) {
      saveReadingSnapshot(snapshot({ reading: [cards[0]], drawIncludeMinors }), { storage });
      assert.equal(loadReadingSnapshot({ storage, now: NOW }).drawIncludeMinors, drawIncludeMinors);
    }
  });

  it('keeps missing or malformed legacy draw scope unknown', () => {
    for (const drawIncludeMinors of [undefined, null, 'false', 0]) {
      const old = { ...snapshot(), drawIncludeMinors };
      storage.setItem(READING_SNAPSHOT_STORAGE_KEY, JSON.stringify(old));
      assert.equal(loadReadingSnapshot({ storage, now: NOW }).drawIncludeMinors, null);
    }
  });

  it('round-trips the draw deck and recovers known legacy analysis without inventing a deck', () => {
    for (const drawDeckStyleId of ['thoth-a1', 'marseille-classic', 'rws-1909']) {
      saveReadingSnapshot(snapshot({ drawDeckStyleId }), { storage });
      assert.equal(loadReadingSnapshot({ storage, now: NOW }).drawDeckStyleId, drawDeckStyleId);
    }
    for (const [analysis, want] of [
      [{ readingMeta: { deckStyle: 'thoth-a1' } }, 'thoth-a1'],
      [{ themes: { deckStyle: 'marseille-classic' } }, 'marseille-classic'],
      [{ themes: { deckStyle: 'unknown-deck' } }, null],
      [null, null]
    ]) {
      const legacy = { ...snapshot(), analysis };
      delete legacy.drawDeckStyleId;
      storage.setItem(READING_SNAPSHOT_STORAGE_KEY, JSON.stringify(legacy));
      assert.equal(loadReadingSnapshot({ storage, now: NOW }).drawDeckStyleId, want);
    }
  });

  it('keeps a finished narrative with its analysis', () => {
    saveReadingSnapshot(snapshot({
      narrative: { raw: '## Opening\nA steady rhythm.', provider: 'claude-api', requestId: 'req-1', isStreaming: false },
      analysis: { themes: { suitFocus: 'Cups' }, readingMeta: { requestId: 'req-1' } }
    }), { storage });
    const restored = loadReadingSnapshot({ storage, now: NOW });
    assert.deepEqual(restored.narrative, { raw: '## Opening\nA steady rhythm.', provider: 'claude-api', requestId: 'req-1' });
    assert.deepEqual(restored.analysis.themes, { suitFocus: 'Cups' });
  });

  it('restores follow-up work and an explicit false context choice for the same owner', () => {
    const followUp = {
      draft: 'How can I rest — 明日? 🌙',
      includeJournal: false,
      turns: [{ question: 'Where can I begin?', answer: 'Protect one quiet pause.', turnNumber: 2,
        createdAt: NOW, journalContext: { patternsFound: ['rest'] }, isInterrupted: true }]
    };
    saveReadingSnapshot(snapshot({ owner: 'user:one', narrative: { raw: 'The original reading.' }, followUp }), { storage });
    const restored = loadReadingSnapshot({ storage, owner: 'user:one', now: NOW });
    assert.deepEqual(restored.followUp, followUp);
    assert.equal(loadReadingSnapshot({ storage, owner: 'user:two', now: NOW }), null);
    assert.equal(loadReadingSnapshot({ storage, owner: 'guest', now: NOW }), null);
  });

  it('ignores pending or malformed turns without discarding the recoverable question', () => {
    saveReadingSnapshot(snapshot({ narrative: { raw: 'Reading' }, followUp: {
      draft: 'The question awaiting its answer', includeJournal: false,
      turns: [null, { question: 'Pending', answer: 'Partial delta', isStreaming: true },
        { question: 'No answer', answer: '' }, { question: 42, answer: 'Invalid' },
        { question: 'Finished', answer: 'Complete', turnNumber: 1 }]
    } }), { storage });
    const { followUp } = loadReadingSnapshot({ storage, now: NOW });
    assert.equal(followUp.draft, 'The question awaiting its answer');
    assert.equal(followUp.includeJournal, false);
    assert.deepEqual(followUp.turns.map(turn => turn.question), ['Finished']);
  });

  it('defaults old or malformed composer snapshots without changing valid false values', () => {
    for (const followUp of [undefined, null, {}, { draft: 12, includeJournal: 'false', turns: {} }]) {
      storage.setItem(READING_SNAPSHOT_STORAGE_KEY, JSON.stringify({ ...snapshot({ narrative: { raw: 'Reading' } }), followUp }));
      assert.deepEqual(loadReadingSnapshot({ storage, now: NOW }).followUp, { draft: '', includeJournal: true, turns: [] });
    }
  });

  it('does not carry a previous conversation into a new unfinished reading', () => {
    saveReadingSnapshot(snapshot({ followUp: { draft: 'Previous reading', includeJournal: false,
      turns: [{ question: 'Previous question', answer: 'Previous answer' }] } }), { storage });
    assert.deepEqual(loadReadingSnapshot({ storage, now: NOW }).followUp, { draft: '', includeJournal: true, turns: [] });
  });

  it('bounds conversation storage while retaining the latest turn and its allowance number', () => {
    saveReadingSnapshot(snapshot({ narrative: { raw: 'Reading' }, followUp: {
      draft: 'd'.repeat(600), includeJournal: false,
      turns: Array.from({ length: 70 }, (_, index) => ({ question: 'q'.repeat(900),
        answer: 'a'.repeat(17_000), turnNumber: index + 1 }))
    } }), { storage });
    const { followUp } = loadReadingSnapshot({ storage, now: NOW });
    assert.equal(followUp.draft.length, 500);
    assert.equal(followUp.includeJournal, false);
    assert.equal(followUp.turns.at(-1).turnNumber, 70);
    assert.equal(followUp.turns.at(-1).isInterrupted, true);
    assert.ok(JSON.stringify(followUp.turns).length <= 200_000);
    assert.ok(followUp.turns.every(turn => turn.question.length <= 800 && turn.answer.length <= 16_000));
  });

  it('never returns another account\'s reading, but follows a guest into sign-in', () => {
    saveReadingSnapshot(snapshot({ owner: 'user:u1' }), { storage });
    assert.equal(loadReadingSnapshot({ storage, owner: 'user:u2', now: NOW }), null);
    assert.equal(loadReadingSnapshot({ storage, owner: 'guest', now: NOW }), null);
    assert.ok(loadReadingSnapshot({ storage, owner: 'user:u1', now: NOW }));

    saveReadingSnapshot(snapshot({ owner: 'guest' }), { storage });
    assert.ok(loadReadingSnapshot({ storage, owner: 'user:u2', now: NOW }));
    assert.equal(snapshotBelongsTo({ owner: 'guest' }, 'user:u9'), true);
    assert.equal(snapshotBelongsTo({ owner: 'user:u1' }, 'user:u9'), false);
  });

  it('expires after a day and drops malformed data', () => {
    saveReadingSnapshot(snapshot(), { storage });
    assert.equal(loadReadingSnapshot({ storage, now: NOW + READING_SNAPSHOT_MAX_AGE_MS + 1 }), null);
    assert.equal(storage.raw(READING_SNAPSHOT_STORAGE_KEY), undefined);

    storage.setItem(READING_SNAPSHOT_STORAGE_KEY, JSON.stringify({ ...snapshot(), reading: [{ isReversed: true }] }));
    assert.equal(loadReadingSnapshot({ storage, now: NOW }), null);
    storage.setItem(READING_SNAPSHOT_STORAGE_KEY, '{not json');
    assert.equal(loadReadingSnapshot({ storage, now: NOW }), null);
  });

  it('drops oversized analysis before the reading itself', () => {
    const big = 'x'.repeat(450_000);
    saveReadingSnapshot(snapshot({ narrative: { raw: 'Text' }, analysis: { analysisContext: big } }), { storage });
    const restored = loadReadingSnapshot({ storage, now: NOW });
    assert.equal(restored.narrative.raw, 'Text');
    assert.equal(restored.analysis, null);
  });

  it('clears on null and on request, and survives blocked storage', () => {
    saveReadingSnapshot(snapshot(), { storage });
    saveReadingSnapshot(null, { storage });
    assert.equal(loadReadingSnapshot({ storage, now: NOW }), null);
    saveReadingSnapshot(snapshot(), { storage });
    clearReadingSnapshot({ storage });
    assert.equal(loadReadingSnapshot({ storage, now: NOW }), null);

    const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
    assert.doesNotThrow(() => saveReadingSnapshot(snapshot(), { storage: blocked }));
    assert.equal(loadReadingSnapshot({ storage: blocked, now: NOW }), null);
    assert.doesNotThrow(() => clearReadingSnapshot({ storage: blocked }));
  });
});
