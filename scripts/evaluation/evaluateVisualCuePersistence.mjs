#!/usr/bin/env node
/** Controlled Task 5 persistence acceptance. No external database or model calls. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { createD1 } from '../../tests/helpers/d1Sqlite.mjs';
import { seedSession, seedUser } from '../../tests/helpers/journalFixtures.mjs';
import { saveAppJournalEntry } from '../../functions/lib/journalEntries.js';
import {
  commitVisualResult, computeSourceFingerprint, loadJournalVisualResult
} from '../../functions/lib/readingVisualResults.js';
import { onRequestDelete } from '../../functions/api/journal/[id].js';
import { ReadingVisualJob } from '../../src/worker/readingVisualJob.js';

const OWNER = 'controlled-owner';
const OTHER = 'controlled-other';
const SESSION = 'controlled-session-fixture';
const QUOTE = 'A figure pours one pitcher into a pool.';
const CARDS = [{
  index: 0, name: 'The Star', canonicalName: 'The Star',
  position: 'Only card', orientation: 'Upright'
}];
const BASE = {
  spread: 'One Card', spreadKey: 'single', cards: CARDS,
  question: 'Controlled fixture question.', reflections: '', deckId: 'rws-1909'
};

function outputOption(args) {
  if (!args.length) return null;
  if (args.length === 2 && args[0] === '--output' && args[1]) return resolve(args[1]);
  if (args.length === 1 && args[0].startsWith('--output=') && args[0].slice(9)) {
    return resolve(args[0].slice(9));
  }
  throw new Error('Usage: node scripts/evaluation/evaluateVisualCuePersistence.mjs [--output path]');
}

async function setup() {
  const db = await createD1();
  await seedUser(db, { id: OWNER });
  await seedUser(db, { id: OTHER });
  await seedSession(db, { id: SESSION, userId: OWNER });
  const jobs = new Map();
  const env = {
    DB: db,
    READING_VISUAL_JOBS: {
      idFromName: id => id,
      get: id => ({ fetch: (input, init) => {
        const job = jobs.get(id);
        if (!job) throw new Error('Unknown controlled visual job');
        return job.fetch(input instanceof Request ? input : new Request(input, init));
      } })
    }
  };
  return { db, env, jobs };
}

async function save(fixture, userId, raw, readingResultId, sessionSeed) {
  const result = await saveAppJournalEntry({
    env: fixture.env,
    user: { id: userId, subscription_tier: 'plus', subscription_status: 'active', auth_provider: 'session' },
    body: { ...BASE, personalReading: raw, readingResultId, ...(sessionSeed ? { sessionSeed } : {}) }
  });
  assert.equal(result.body.success, true, 'The prose save must succeed');
  return result;
}

async function visualJob(fixture, { id, raw, ownerUserId = OWNER }) {
  const fingerprints = await computeSourceFingerprint({ ...BASE, raw });
  const binding = {
    readingResultId: id, sourceRevision: 0,
    spreadHash: fingerprints.spreadHash, contextHash: fingerprints.contextHash,
    artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1'
  };
  const stored = new Map();
  const pending = [];
  const state = {
    storage: {
      get: async key => structuredClone(stored.get(key)),
      put: async (key, value) => { stored.set(key, structuredClone(value)); }
    },
    blockConcurrencyWhile: callback => callback(),
    waitUntil: promise => { pending.push(promise); }
  };
  const job = new ReadingVisualJob(state, fixture.env, {
    runAnnotation: async () => ({ proposals: [{
      localAlias: 'controlled-pool', kind: 'literal', quote: QUOTE,
      targets: [{ spreadIndex: 0, detailIds: ['pool-pour'] }]
    }] })
  });
  fixture.jobs.set(id, job);
  const init = await job.fetch(new Request('https://controlled.invalid/init', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      binding, ownerUserId, visualToken: 'controlled-capability-fixture',
      validationContext: { cards: CARDS, question: BASE.question, reflections: BASE.reflections }
    })
  }));
  assert.equal(init.status, 200, 'Controlled visual job must initialize');
  return {
    job, binding,
    async complete() {
      const response = await job.fetch(new Request('https://controlled.invalid/observe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ binding, raw, complete: true, deliveredEventId: 1, availableAt: 1 })
      }));
      assert.equal(response.status, 202, 'Controlled final source must be accepted');
      for (let index = 0; index < pending.length; index++) await pending[index];
      assert.equal(job.status, 'complete', 'The controlled adapter must complete');
      assert.equal(job.ledger.cues.length, 1, 'The real ledger validator must accept the fixture cue');
      return job.ledger;
    }
  };
}

const cases = [
  {
    id: 'completion_before_save',
    expected: { proseSaved: true, restoredStatus: 'complete', restoredRevision: 1, restoredCueCount: 1 },
    async run(fixture) {
      const raw = `${QUOTE} Controlled source A.`;
      const visual = await visualJob(fixture, { id: 'completed-before-save', raw });
      await visual.complete();
      const saved = await save(fixture, OWNER, raw, visual.binding.readingResultId);
      const restored = await loadJournalVisualResult({ db: fixture.db, userId: OWNER, entryId: saved.body.entry.id });
      return {
        proseSaved: saved.body.success,
        restoredStatus: restored?.status ?? null,
        restoredRevision: restored?.ledgerRevision ?? null,
        restoredCueCount: restored?.cues.length ?? 0
      };
    }
  },
  {
    id: 'unverified_result_id_claim_then_null_owner_completion',
    expected: { proseSaved: true, unverifiedAttachment: false, foreignLedgerVisible: false, savedProseUnchanged: true },
    async run(fixture) {
      const raw = `${QUOTE} Controlled source A.`;
      // Matches the app visual job's current null-owner initialization seam.
      // The other user knows only the result ID, never its capability.
      const visual = await visualJob(fixture, { id: 'known-controlled-result', raw, ownerUserId: null });
      const unrelatedRaw = 'Controlled source B with a different fingerprint.';
      const saved = await save(fixture, OTHER, unrelatedRaw, visual.binding.readingResultId);
      await visual.complete();
      const restored = await loadJournalVisualResult({ db: fixture.db, userId: OTHER, entryId: saved.body.entry.id });
      const entry = await fixture.db.prepare('SELECT narrative FROM journal_entries WHERE id = ?')
        .bind(saved.body.entry.id).first();
      return {
        proseSaved: saved.body.success,
        unverifiedAttachment: Boolean(saved.body.visual),
        foreignLedgerVisible: restored?.cueLedger?.raw === raw,
        savedProseUnchanged: entry?.narrative === unrelatedRaw
      };
    }
  },
  {
    id: 'dedup_attachment_matches_stored_prose',
    expected: { deduplicated: true, storedProseUnchanged: true, originalResultRetained: true, visualRawMatchesStoredProse: true },
    async run(fixture) {
      const oldRaw = `${QUOTE} Controlled source A.`;
      const newRaw = `${QUOTE} Controlled source B.`;
      const firstVisual = await visualJob(fixture, { id: 'first-controlled-result', raw: oldRaw });
      const first = await save(fixture, OWNER, oldRaw, firstVisual.binding.readingResultId, 'controlled-seed');
      await firstVisual.complete();
      const secondVisual = await visualJob(fixture, { id: 'second-controlled-result', raw: newRaw });
      const second = await save(fixture, OWNER, newRaw, secondVisual.binding.readingResultId, 'controlled-seed');
      await secondVisual.complete();
      const entry = await fixture.db.prepare('SELECT narrative FROM journal_entries WHERE id = ?')
        .bind(first.body.entry.id).first();
      const restored = await loadJournalVisualResult({ db: fixture.db, userId: OWNER, entryId: first.body.entry.id });
      return {
        deduplicated: second.body.deduplicated === true,
        storedProseUnchanged: entry?.narrative === oldRaw,
        originalResultRetained: restored?.readingResultId === firstVisual.binding.readingResultId,
        visualRawMatchesStoredProse: restored?.finalRaw === entry?.narrative
      };
    }
  },
  {
    id: 'journal_delete_route_removes_last_result_and_rejects_late_commit',
    expected: { httpStatus: 200, entryRemoved: true, linkRemoved: true, resultRemoved: true, lateCommitRejected: true },
    async run(fixture) {
      const raw = `${QUOTE} Controlled deletion fixture.`;
      const visual = await visualJob(fixture, { id: 'deleted-controlled-result', raw });
      const saved = await save(fixture, OWNER, raw, visual.binding.readingResultId);
      const ledger = await visual.complete();
      const entryId = saved.body.entry.id;
      const response = await onRequestDelete({
        env: fixture.env, params: { id: entryId },
        request: new Request(`https://controlled.invalid/api/journal/${entryId}`, {
          method: 'DELETE', headers: { Cookie: `session=${SESSION}` }
        })
      });
      const entry = await fixture.db.prepare('SELECT id FROM journal_entries WHERE id = ?').bind(entryId).first();
      const link = await fixture.db.prepare('SELECT journal_entry_id FROM journal_visual_links WHERE journal_entry_id = ?')
        .bind(entryId).first();
      const result = await fixture.db.prepare('SELECT id FROM reading_visual_results WHERE id = ?')
        .bind(visual.binding.readingResultId).first();
      const lateCommit = await commitVisualResult({
        db: fixture.db, userId: OWNER, readingResultId: visual.binding.readingResultId,
        binding: visual.binding, ledger, status: 'complete', finalRaw: raw
      });
      return {
        httpStatus: response.status, entryRemoved: !entry, linkRemoved: !link,
        resultRemoved: !result, lateCommitRejected: lateCommit.ok === false
      };
    }
  }
];

const output = outputOption(process.argv.slice(2));
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('Network access is forbidden in the controlled persistence acceptance runner'); };
const results = [];
try {
  for (const item of cases) {
    let fixture;
    try {
      fixture = await setup();
      const actual = await item.run(fixture);
      results.push({ id: item.id, expected: item.expected, actual, pass: isDeepStrictEqual(actual, item.expected) });
    } catch (error) {
      results.push({ id: item.id, expected: item.expected, actual: { error: error.message }, pass: false });
    } finally {
      fixture?.db.sqlite.close();
    }
  }
} finally {
  globalThis.fetch = originalFetch;
}

const passed = results.filter(result => result.pass).length;
const report = {
  version: 1,
  scope: {
    mode: 'controlled-persistence-acceptance',
    database: 'isolated in-memory sql.js SQLite with repository migrations and foreign keys enabled',
    adapter: 'injected deterministic proposal; actual ReadingVisualJob and cue validator',
    durableObjectRuntime: 'in-memory storage/waitUntil stand-in; no Cloudflare runtime or eviction simulation',
    httpRoute: 'actual DELETE /api/journal/:id handler with a seeded synthetic session',
    saveAndRestore: 'actual saveAppJournalEntry and loadJournalVisualResult helpers; POST/GET route handlers and browser not exercised',
    lateCommit: 'direct commitVisualResult call after route deletion; in-flight cancellation not exercised',
    externalRequests: 'forbidden; no live database or model calls',
    productionQualification: false
  },
  summary: { total: results.length, passed, failed: results.length - passed, pass: passed === results.length },
  cases: results
};
const json = `${JSON.stringify(report, null, 2)}\n`;
if (output) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, json);
}
process.stdout.write(json);
process.exitCode = report.summary.pass ? 0 : 1;
