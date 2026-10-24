import assert from 'node:assert';
import test from 'node:test';

import { generatePDF, formatEntryAsText, onRequestGet } from '../functions/api/journal-export/index.js';

class MockAuthDb {
  constructor(sessionRow = null) {
    this.sessionRow = sessionRow;
  }

  prepare(query) {
    if (query.includes('FROM sessions')) {
      return {
        bind: () => ({
          first: async () => this.sessionRow
        })
      };
    }

    if (query.startsWith('UPDATE sessions SET last_used_at')) {
      return {
        bind: () => ({
          run: async () => ({ meta: { changes: 1 } })
        })
      };
    }

    return {
      bind: () => ({
        first: async () => null,
        all: async () => ({ results: [] }),
        run: async () => ({ meta: { changes: 0 } })
      })
    };
  }
}

function createSessionRow(overrides = {}) {
  return {
    session_id: 'session-1',
    user_id: 'user-1',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    id: 'user-1',
    email: 'user@example.com',
    username: 'mystic',
    is_active: 1,
    subscription_tier: 'plus',
    subscription_status: 'active',
    subscription_provider: 'stripe',
    stripe_customer_id: 'cus_123',
    email_verified: 1,
    ...overrides
  };
}

function createExportRequest(cookieHeader) {
  const headers = cookieHeader ? { Cookie: cookieHeader } : {};
  return new Request('https://example.com/api/journal-export?format=json', { headers });
}

test('generatePDF does not flag truncation at exact page limit', () => {
  const linesPerPage = 50; // Derived from PDF_TOP_Y, PDF_BOTTOM_Y, and PDF_LINE_HEIGHT
  const totalLines = linesPerPage * 20;

  const content = Array.from({ length: totalLines }, (_, i) => `Line ${i + 1}`).join('\n');
  const { pageCount, truncated, pdf } = generatePDF(content);

  assert.strictEqual(pageCount, 20);
  assert.strictEqual(truncated, false);
  assert.ok(pdf.startsWith('%PDF-1.4'));
});

test('generatePDF flags truncation when content exceeds page limit', () => {
  const linesPerPage = 50;
  const content = Array.from({ length: linesPerPage * 20 + 1 }, (_, i) => `Line ${i + 1}`).join('\n');

  const { pageCount, truncated } = generatePDF(content);

  assert.strictEqual(pageCount, 20);
  assert.strictEqual(truncated, true);
});

test('formatEntryAsText includes follow-up turns', () => {
  const entry = {
    ts: Date.UTC(2025, 0, 1, 12, 0, 0),
    spread: 'Three Card',
    question: 'What should I focus on this month?',
    context: 'self',
    cards: [{ position: 'Past', name: 'The Fool', orientation: 'Upright' }],
    personalReading: 'A short reading.\n\nSecond paragraph.',
    followUps: [
      { turnNumber: 1, question: 'Can you clarify the first card?', answer: 'Yes — here is the clarification.' }
    ]
  };

  const text = formatEntryAsText(entry);
  assert.ok(text.includes('## Reading'));
  assert.ok(text.includes('## Follow-up Conversation'));
  assert.ok(text.includes('Turn 1'));
  assert.ok(text.includes('Q: Can you clarify the first card?'));
  assert.ok(text.includes('A: Yes — here is the clarification.'));
});

test('onRequestGet returns 401 for unauthenticated export requests', async () => {
  const response = await onRequestGet({
    request: createExportRequest(null),
    env: { DB: new MockAuthDb(null) },
    params: {}
  });

  const payload = await response.json();
  assert.strictEqual(response.status, 401);
  assert.strictEqual(payload.error, 'Not authenticated');
});

test('onRequestGet returns 403 when user is not entitled to cloud export', async () => {
  const db = new MockAuthDb(
    createSessionRow({
      subscription_tier: 'free',
      subscription_status: 'inactive'
    })
  );

  const response = await onRequestGet({
    request: createExportRequest('session=token-1'),
    env: { DB: db },
    params: {}
  });

  const payload = await response.json();
  assert.strictEqual(response.status, 403);
  assert.strictEqual(payload.tierLimited, true);
  assert.strictEqual(payload.requiredTier, 'plus');
});

test('formatEntryAsText labels reflections by card and whole reading', () => {
  const text = formatEntryAsText({
    ts: Date.UTC(2026, 8, 22),
    spread: 'Three-Card Story (Past · Present · Future)',
    cards: [
      { position: 'Past', name: 'The Hermit', orientation: 'Upright' },
      { position: 'Present', name: 'Three of Cups', orientation: 'Reversed' }
    ],
    reflections: { 1: 'friends around me', Overall: 'gentle overall' }
  });

  assert.match(text, /## Personal Reflections\nWhole reading: gentle overall\nPresent · Three of Cups: friends around me/);
  assert.doesNotMatch(text, /Position 1:/);
});

// Task 11: saved visual recovery state, replay claims and capabilities live in
// private tables/storage. Exports and client share/export builders project
// explicit reading fields only, while user prose resembling field names stays exact.
const PRIVATE_VALUES = ['secret-visual-token-1', 'secret-visual-job-1', 'secret-attempt-1', 'secret-claim-1', 'secret-resume-token-1'];
const PROSE = 'The Star pours into a pool.\n\nA reflection on "visualJobToken", attemptId and resumeHandle is kept verbatim.';

test('server JSON and text exports never include visual retry state, replay claims or capabilities', async (t) => {
  const { createD1 } = await import('./helpers/d1Sqlite.mjs');
  const { seedUser, seedSession, seedEntry } = await import('./helpers/journalFixtures.mjs');
  const db = await createD1();
  t.after(() => db.sqlite.close());
  await seedUser(db, { id: 'user-1', tier: 'plus' });
  await seedSession(db, { id: 'session-1', userId: 'user-1' });
  await seedEntry(db, { id: 'entry-1', narrative: PROSE, reflections: { Overall: 'mentions attemptId too' },
    cards: [{ name: 'The Star', position: 'Present', orientation: 'Upright' }], deckId: 'rws-1909' });
  const now = Date.now();
  await db.prepare(`INSERT INTO visual_retry_claims (id, admission_scope, source_fingerprint, user_id, journal_entry_id,
    reading_result_id, attempt_id, visual_job_id, state_version, dispatch_status, retry_status, created_at, updated_at,
    visual_token, expires_at) VALUES (?, 'user:user-1', ?, 'user-1', 'entry-1', 'result-1', ?, ?, 1, 'reserved', 'pending', ?, ?, ?, ?)`)
    .bind(PRIVATE_VALUES[3], 'a'.repeat(64), PRIVATE_VALUES[2], PRIVATE_VALUES[1], now, now, PRIVATE_VALUES[0], now + 60000).run();
  await db.prepare(`INSERT INTO journal_visual_state (journal_entry_id, user_id, source_fingerprint, reading_result_id,
    attachment_status, retry_status, reason, validated_snapshot_json, state_version, claim_id, attempt_id, created_at, updated_at)
    VALUES ('entry-1', 'user-1', ?, 'result-1', 'pending', 'pending', NULL, ?, 2, ?, ?, ?, ?)`)
    .bind('a'.repeat(64), JSON.stringify({ visualJobToken: PRIVATE_VALUES[4] }), PRIVATE_VALUES[3], PRIVATE_VALUES[2], now, now).run();
  for (const format of ['json', 'txt']) {
    const response = await onRequestGet({
      request: new Request(`https://example.com/api/journal-export?format=${format}`, { headers: { Cookie: 'session=session-1' } }),
      env: { DB: db },
      params: {}
    });
    assert.strictEqual(response.status, 200);
    const body = await response.text();
    for (const value of PRIVATE_VALUES) assert.strictEqual(body.includes(value), false, `${format} export leaked ${value}`);
    if (format === 'json') {
      const [entry] = JSON.parse(body).entries;
      assert.strictEqual(entry.personalReading, PROSE);
      assert.deepStrictEqual(Object.keys(entry).sort(), ['cards', 'context', 'followUps', 'id', 'personalReading', 'provider',
        'question', 'reflections', 'spread', 'spreadKey', 'themes', 'ts'].sort());
    } else {
      assert.ok(body.includes('A reflection on "visualJobToken", attemptId and resumeHandle is kept verbatim.'));
    }
  }
});

test('client CSV, Markdown and summary builders never serialize visual retry or capability fields', async () => {
  const { buildJournalCsv, buildEntryMarkdown, buildJournalMarkdown } = await import('../src/lib/journalInsights.js');
  const { projectJournalEntryVisuals } = await import('../src/lib/readingVisualStorage.js');
  const leaked = {
    id: 'entry-1', ts: Date.UTC(2026, 9, 10), spread: 'One card', spreadKey: 'single', question: 'What renews me?',
    cards: [{ position: 'Present', name: 'The Star', orientation: 'Upright' }], personalReading: PROSE,
    reflections: { Overall: 'mentions attemptId too' }, deckId: 'rws-1909',
    visualJobToken: PRIVATE_VALUES[0], visualJobId: PRIVATE_VALUES[1], attemptId: PRIVATE_VALUES[2],
    resumeHandle: { visualJobToken: PRIVATE_VALUES[4] },
    visualState: { attachmentStatus: 'pending', retryStatus: 'pending', sourceFingerprint: 'a'.repeat(64), stateVersion: 2,
      reason: null, attemptId: PRIVATE_VALUES[2], visualSnapshot: { visualJobToken: PRIVATE_VALUES[0] } }
  };
  // The journal hook projects server/cache entries before they reach React state.
  const projected = projectJournalEntryVisuals(leaked);
  for (const output of [JSON.stringify(projected), buildJournalCsv([leaked]), buildEntryMarkdown(leaked), buildJournalMarkdown([leaked])]) {
    for (const value of PRIVATE_VALUES) assert.strictEqual(output.includes(value), false);
  }
  assert.strictEqual(projected.personalReading, PROSE);
  assert.ok(buildEntryMarkdown(projected).includes('A reflection on "visualJobToken", attemptId and resumeHandle is kept verbatim.'));
});

test('client text and JSON exports match the cloud formats and keep private fields out', async () => {
  const { buildJournalText, buildJournalJson, formatEntryAsText: sharedFormat } = await import('../shared/journal/exportFormats.js');
  assert.strictEqual(sharedFormat, formatEntryAsText, 'the Worker uses the shared formatter');
  const older = {
    id: 'entry-old', ts: Date.UTC(2026, 8, 1), spread: 'One card', spreadKey: 'single', question: 'What steadies me?',
    cards: [{ position: 'Present', name: 'The Tower', orientation: 'Reversed' }], personalReading: 'Old prose.'
  };
  const newer = {
    id: 'entry-new', ts: Date.UTC(2026, 9, 10), spread: 'One card', spreadKey: 'single', question: 'What renews me?',
    cards: [{ position: 'Present', name: 'The Star', orientation: 'Upright' }], personalReading: PROSE,
    reflections: { Overall: 'mentions attemptId too' }, deckId: 'thoth-a1', context: 'self', provider: 'claude-api',
    followUps: [{ turnNumber: 1, question: 'More?', answer: 'Yes.' }],
    visualJobToken: PRIVATE_VALUES[0], visualJobId: PRIVATE_VALUES[1], attemptId: PRIVATE_VALUES[2],
    resumeHandle: { visualJobToken: PRIVATE_VALUES[4] }, visualSnapshot: { visualJobToken: PRIVATE_VALUES[0] }
  };
  const generatedAt = new Date(Date.UTC(2026, 9, 24));
  const text = buildJournalText([older, newer], { generatedAt });
  assert.ok(text.startsWith('TAROT JOURNAL EXPORT\nGenerated: 2026-10-24T00:00:00.000Z\nEntries: 2\n'));
  assert.ok(text.indexOf('What renews me?') < text.indexOf('What steadies me?'), 'newest entry first');
  assert.ok(text.includes('Whole reading: mentions attemptId too'));

  const json = buildJournalJson([older, newer], { generatedAt, scope: 'Current filters' });
  assert.strictEqual(json.exportedAt, '2026-10-24T00:00:00.000Z');
  assert.strictEqual(json.entryCount, 2);
  assert.strictEqual(json.scope, 'Current filters');
  assert.deepStrictEqual(json.entries.map((entry) => entry.id), ['entry-new', 'entry-old']);
  assert.deepStrictEqual(Object.keys(json.entries[0]).sort(), ['cards', 'context', 'deckId', 'followUps', 'id', 'personalReading',
    'provider', 'question', 'reflections', 'spread', 'spreadKey', 'themes', 'ts'].sort());
  assert.strictEqual(json.entries[0].personalReading, PROSE);
  for (const output of [text, JSON.stringify(json)]) {
    for (const value of PRIVATE_VALUES) assert.strictEqual(output.includes(value), false);
  }
});
