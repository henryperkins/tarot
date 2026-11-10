import assert from 'node:assert/strict';
import { test } from 'node:test';

import { journalHookDriver, journalStorageFixture } from './helpers/journalHookDriver.mjs';
import { loadStoredJournalInsights, persistJournalInsights } from '../src/lib/journalInsights.js';

// The coach trusts the fresher of the Journey snapshot and the insights cache,
// so the cache may only ever describe the whole journal. These drive the real
// useJournal body the way each page mounts it.

const DAY = 86400000;
const base = Date.parse('2026-11-06T18:00:00Z');
const reading = (id, card = 'The Tower') => ({
  id, ts: base - DAY, readingResultId: `result-${id}`, sessionSeed: `seed-${id}`, spreadKey: 'single',
  question: `Question ${id}`, personalReading: `Prose ${id}`, cards: [{ name: card, orientation: 'upright' }]
});
const journal = Array.from({ length: 30 }, (_, index) => reading(`entry-${index}`));
const newReading = {
  readingResultId: 'result-new', sessionSeed: 'seed-new', spreadKey: 'single', question: 'New question',
  personalReading: 'New prose', cards: [{ name: 'The Moon', orientation: 'upright' }]
};

test('a cloud save from the reading page hook, which never loaded the journal, leaves the insights cache whole', async t => {
  const owner = 'plus-reader';
  const { storage } = journalStorageFixture(t);
  persistJournalInsights(journal, owner);
  const complete = storage.getItem(`tarot_journal_insights_${owner}`);
  // useSaveReading mounts useJournal({ autoLoad: false }); the driver's default.
  const driver = await journalHookDriver(owner, {
    cloud: true,
    fetchImpl: async (url, options) => {
      if (options?.method === 'POST') return Response.json({ entry: { id: 'cloud-new', ts: base } });
      throw new Error(`Unexpected request ${url}`);
    }
  });
  t.after(() => driver.close());
  const hook = driver.render();
  driver.flush();

  const result = await hook.saveEntry(newReading);
  assert.equal(result.success, true);
  driver.flush();

  assert.equal(storage.getItem(`tarot_journal_insights_${owner}`), complete);
  assert.equal(loadStoredJournalInsights(owner).stats.totalReadings, 30);
});

test('a first page of a longer cloud journal does not replace the insights cache', async t => {
  const owner = 'gallery-reader';
  const { storage } = journalStorageFixture(t);
  persistJournalInsights(journal, owner);
  const complete = storage.getItem(`tarot_journal_insights_${owner}`);
  // The card gallery mounts useJournal() with default paging.
  const driver = await journalHookDriver(owner, {
    cloud: true,
    hookOptions: { autoLoad: true },
    fetchImpl: async url => {
      if (String(url).includes('/api/journal')) {
        return Response.json({ entries: journal.slice(0, 25), pagination: { hasMore: true, nextCursor: 25, total: 30 } });
      }
      throw new Error(`Unexpected request ${url}`);
    }
  });
  t.after(() => driver.close());
  driver.render();
  await new Promise(resolve => setTimeout(resolve, 20));
  driver.flush();

  assert.equal(storage.getItem(`tarot_journal_insights_${owner}`), complete);
});

test('a local save still refreshes insights from the whole stored journal', async t => {
  const owner = 'free-reader';
  const { storage } = journalStorageFixture(t);
  const local = journal.slice(0, 12);
  storage.setItem(`tarot_journal_${owner}`, JSON.stringify(local));
  persistJournalInsights(local, owner);
  // A signed-in reader without cloud entitlements saves to localStorage.
  const driver = await journalHookDriver(owner, { cloud: false });
  t.after(() => driver.close());
  const hook = driver.render();

  const result = await hook.saveEntry(newReading);
  assert.equal(result.success, true);
  driver.flush();

  assert.equal(loadStoredJournalInsights(owner).stats.totalReadings, 13);
});
