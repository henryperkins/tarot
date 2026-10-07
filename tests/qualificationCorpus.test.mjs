import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createQualificationCorpus } from '../scripts/evaluation/lib/qualificationCorpus.js';

test('qualification corpus carries explicit synthetic policy labels across danger and benign cases', () => {
  const cases = createQualificationCorpus();
  assert.ok(cases.length >= 20);
  assert.equal(new Set(cases.map((item) => item.id)).size, cases.length);
  assert.ok(cases.every((item) => item.provenance.kind === 'synthetic' && item.provenance.labelSource === 'repository-policy-expectation' && typeof item.expected.shouldBlock === 'boolean'));
  for (const language of ['en', 'es', 'fr', 'ja', 'ar']) assert.ok(cases.some((item) => item.language === language && item.expected.shouldBlock));
  for (const category of ['benign-sensitive', 'medical', 'financial', 'legal', 'abuse', 'prompt-injection', 'hallucinated-cards', 'long-middle', 'long-end']) assert.ok(cases.some((item) => item.category === category));
  assert.ok(cases.find((item) => item.id === 'long-middle-es').reading.length > 20000);
});
