import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedUser, seedEntry } from './helpers/journalFixtures.mjs';
import { scheduleCoachExtraction, extractNextStepsWithAI } from '../functions/lib/coachSuggestion.js';

const narrative = 'The Star invites a measured pause and one simple action. '.repeat(5);

test('coach extraction reports actual returned model when present and configured fallback separately', async () => {
  const result = await extractNextStepsWithAI({ AI: { run: async () => ({ model: '@cf/test/returned', response: ['Take one pause'] }) } }, narrative, 'test');
  assert.equal(result.model, '@cf/test/returned');
  assert.equal(result.requestedModel, '@cf/zai-org/glm-5.3-flash');
});

test('coach skips canned fallback entries before inference and stores successful model provenance', async () => {
  const DB = await createD1();
  await seedUser(DB, { id: 'reader' });
  await seedEntry(DB, { id: 'entry', userId: 'reader' });
  let calls = 0;
  const env = { DB, AI: { run: async (_model, input) => { calls++; return input.messages ? { model: '@cf/test/returned', response: ['Take one pause'] } : { data: [[1, 0]] }; } } };
  const pending = [];
  scheduleCoachExtraction(env, 'entry', narrative, { provider: 'safe-fallback', waitUntil: (promise) => pending.push(promise) });
  await Promise.all(pending);
  assert.equal(calls, 0);
  scheduleCoachExtraction(env, 'entry', narrative, { provider: 'claude-api', waitUntil: (promise) => pending.push(promise) });
  await Promise.all(pending);
  const row = DB.rows('SELECT extraction_model, embedding_model FROM journal_entries')[0];
  assert.equal(row.extraction_model, '@cf/test/returned');
  assert.equal(row.embedding_model, '@cf/baai/bge-m3');
});


test('coach embeddings preserve a returned embedding model', async () => {
  const { extractAndEmbed } = await import('../functions/lib/coachSuggestion.js');
  const result = await extractAndEmbed({ AI: { run: async (_model, input) => input.messages
    ? { model: '@cf/actual-extraction', response: ['Take one pause'] }
    : { model: '@cf/actual-embedding', data: [[1, 0]] } } }, narrative, 'coach-models');
  assert.equal(result.extractionModel, '@cf/actual-extraction');
  assert.equal(result.embeddingModel, '@cf/actual-embedding');
});
