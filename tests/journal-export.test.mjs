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
