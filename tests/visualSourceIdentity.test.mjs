import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fingerprintVisualSource, normalizeVisualSource } from '../shared/reading/visualSourceIdentity.js';
import { buildReadingRequestCard } from '../shared/contracts/readingRequestCards.js';
import { startReadingJob } from '../functions/lib/readingJobs.js';
import { onRequestPost } from '../functions/api/tarot-reading-job-start.js';
import { saveAppJournalEntry } from '../functions/lib/journalEntries.js';
import { loadJournalVisualResult, updateVisualResultSource } from '../functions/lib/readingVisualResults.js';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedUser, seedSession } from './helpers/journalFixtures.mjs';

const configuredVisual = {
  VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: '@cf/controlled/visual',
  AI: { run: async () => ({ response: { proposals: [] } }) }
};

const cards = [{ name: 'The Star', upright: 'Hope', reversed: 'Doubt', number: 17 }, { name: 'The Tower', upright: 'Change', reversed: 'Delay', number: 16 }];
const reflections = { 0: '  Memory is important.  ', 1: 'Ready for change.' };
const payload = {
  spreadInfo: { name: 'Two Cards', key: 'two' }, deckStyle: 'rws-1909', userQuestion: ' What now? ', reflectionsText: '',
  cardsInfo: cards.map((card, index) => buildReadingRequestCard(card, { position: `Position ${index + 1}`, isReversed: index === 1, userReflection: reflections[index] }))
};

test('generation and actual saved card/reflection shapes share exact occurrence and context identity', async () => {
  const saved = { cards: cards.map((card, index) => ({ name: card.name, number: card.number, position: `Position ${index + 1}`, orientation: index ? 'Reversed' : 'Upright' })),
    deckId: 'rws-1909', question: ' What now? ', reflections };
  assert.deepEqual(await fingerprintVisualSource(payload), await fingerprintVisualSource(saved));
  assert.deepEqual(normalizeVisualSource(payload).cards.map(card => card.spreadIndex), [0, 1]);
  assert.notEqual((await fingerprintVisualSource({ ...saved, reflections: {} })).contextHash, (await fingerprintVisualSource(saved)).contextHash);
});

test('non-RWS decks keep identity edition and cannot receive vector detail geometry', async () => {
  let body;
  const env = { ...configuredVisual, READING_JOBS: { idFromName: x => x, get: () => ({ fetch: async (_url, init) => { body = JSON.parse(init.body); return new Response('{}'); } }) },
    READING_VISUAL_JOBS: { idFromName: x => x, get: () => ({ fetch: async () => new Response('{}') }) } };
  await startReadingJob({ env, payload: { ...payload, deckStyle: 'thoth-a1' } });
  assert.equal(body.visualBinding.artworkEdition, 'identity:thoth-a1');
  assert.deepEqual(body.visualInit.validationContext.cards.map(card => card.detailIds), [[], []]);
});

test('stalled optional visual initialization cannot block the narrative start or response', async () => {
  let narrativeStarted = false;
  let visualStarted = false;
  const scheduled = [];
  const env = { ...configuredVisual, READING_JOBS: { idFromName: x => x, get: () => ({ fetch: async () => { narrativeStarted = true; return new Response('{}'); } }) },
    READING_VISUAL_JOBS: { idFromName: x => x, get: () => ({ fetch: () => { visualStarted = true; return new Promise(() => {}); } }) } };
  const started = await startReadingJob({ env, payload, waitUntil: task => scheduled.push(task) });
  assert.equal(started.ok, true);
  assert.equal(narrativeStarted, true);
  assert.equal(visualStarted, true);
  assert.equal(scheduled.length, 1);
});

test('public start derives visual owner from authenticated session without becoming an MCP principal job', async t => {
  const db = await createD1(); t.after(() => db.sqlite.close());
  await seedUser(db, { id: 'owner' }); await seedSession(db, { id: 'owner-session', userId: 'owner' });
  let body;
  const env = { ...configuredVisual, DB: db, READING_JOBS: { idFromName: x => x, get: () => ({ fetch: async (_url, init) => { body = JSON.parse(init.body); return new Response('{}'); } }) },
    READING_VISUAL_JOBS: { idFromName: x => x, get: () => ({ fetch: async () => new Response('{}') }) } };
  const response = await onRequestPost({ env, request: new Request('https://test.invalid/api/tarot-reading/jobs', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'session=owner-session' },
    body: JSON.stringify({ ...payload, principal: { userId: 'spoofed' }, ownerUserId: 'spoofed' })
  }) });
  assert.equal(response.status, 200);
  assert.equal(body.visualInit.ownerUserId, 'owner');
  assert.equal(body.principal, undefined);
  assert.equal(body.visualInit.validationContext.cards[0].detailIds.includes('pool-pour'), true);
});

test('immediate save attaches trusted identity while optional visual initialization remains stalled', async t => {
  const db = await createD1(); t.after(() => db.sqlite.close());
  await seedUser(db, { id: 'owner' });
  let body;
  const env = { ...configuredVisual, DB: db, READING_JOBS: { idFromName: x => x, get: () => ({ fetch: async (_url, init) => { body = JSON.parse(init.body); return new Response('{}'); } }) },
    READING_VISUAL_JOBS: { idFromName: x => x, get: () => ({ fetch: () => new Promise(() => {}) }) } };
  const started = await startReadingJob({ env, payload, ownerUserId: 'owner', waitUntil: () => {} });
  const raw = 'The Star and The Tower offer perspective.';
  const saved = await saveAppJournalEntry({ env, user: { id: 'owner', subscription_tier: 'plus' }, body: {
    spread: 'Two Cards', spreadKey: 'two', personalReading: raw, question: payload.userQuestion,
    cards: payload.cardsInfo.map(card => ({ name: card.canonicalName, position: card.position, orientation: card.orientation })),
    reflections, readingResultId: started.readingResultId
  } });
  assert.equal(saved.body.success, true);
  assert.equal(saved.body.visual.status, 'pending');
  assert.equal((await updateVisualResultSource({ db, userId: 'owner', readingResultId: started.readingResultId,
    binding: body.visualBinding, raw, complete: true })).ok, true);
  const restored = await loadJournalVisualResult({ db, userId: 'owner', entryId: saved.body.entry.id });
  assert.equal(restored.finalRaw, raw);
});
