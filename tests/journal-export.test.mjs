import assert from 'node:assert';
import test from 'node:test';

import { generatePDF, formatEntryAsText } from '../functions/api/journal-export/index.js';

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
