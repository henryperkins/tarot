import assert from 'node:assert';
import test from 'node:test';

import { generatePDF } from '../functions/api/journal-export/index.js';

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
