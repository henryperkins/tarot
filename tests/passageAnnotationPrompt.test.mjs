import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { buildPassageAnnotationPrompt } from '../shared/generation/passageAnnotationPrompt.js';
import { generatedPassageDocumentSchema } from '../shared/contracts/generatedPassageAnnotations.js';
import { GENERATION_CASES, validateGeneratedSample } from '../scripts/evaluation/generateGestureReadings.mjs';

const sample = {
  userQuestion: 'What could help me begin?', reflectionsText: '', language: 'es',
  cards: [{ card: 'The Fool', position: 'Situation', orientation: 'Reversed' }],
  detailCatalog: [{ spreadIndex: 0, canonicalName: 'The Fool', details: [{ id: 'white-dog', terms: ['white dog'] }] }]
};

test('semantic generation prompt keeps case data separate and includes exact-reference safeguards', () => {
  const prompt = buildPassageAnnotationPrompt(sample);
  assert.deepEqual(JSON.parse(prompt.messages[0].content), sample);
  assert.match(prompt.systemPrompt, /earlier literal annotation IDs/);
  assert.match(prompt.systemPrompt, /nonoverlapping/);
  assert.match(prompt.systemPrompt, /Do not impose a quota/);
  assert.match(prompt.systemPrompt, /reflection when none was supplied/);
  assert.ok(!prompt.systemPrompt.includes(sample.userQuestion));
  const extra = buildPassageAnnotationPrompt({ ...sample, detailCatalog: [{ ...sample.detailCatalog[0], EXAMPLES: ['fixture prose'], details: [{ id: 'white-dog', terms: ['white dog'], match: 'regex rules', text: 'fixture prose' }] }] });
  assert.deepEqual(JSON.parse(extra.messages[0].content).detailCatalog, sample.detailCatalog);
  assert.throws(() => buildPassageAnnotationPrompt({ ...sample, cards: [] }), /required/);
});

test('generation evaluation schema and cases cover missing reflection, reversals, and Spanish without example prose', () => {
  const schema = z.toJSONSchema(generatedPassageDocumentSchema, { target: 'draft-7' });
  assert.equal(schema.type, 'object');
  assert.equal(schema.$schema, 'http://json-schema.org/draft-07/schema#');
  assert.equal(schema.properties.annotations.type, 'array');
  assert.equal(GENERATION_CASES.length, 15);
  assert.equal(new Set(GENERATION_CASES.map(item => item.id)).size, 15);
  assert.equal(GENERATION_CASES.filter(item => item.language === 'es').length, 2);
  assert.ok(GENERATION_CASES.filter(item => !item.reflectionsText).length >= 5);
  assert.ok(GENERATION_CASES.some(item => item.cards.length === 5));
  assert.ok(GENERATION_CASES.some(item => item.cards.some(card => card.orientation === 'Reversed')));
  assert.ok(GENERATION_CASES.every(item => !item.reading && !item.raw && !item.annotations));
});

test('generated sample evaluation preserves failed exact quotes as errors instead of rewriting model prose', () => {
  const document = { version: 1, artworkEdition: 'rws-immanuelle-vector', raw: 'The Fool. A small dog leaps beside the traveler.', annotations: [
    { id: 'name', kind: 'identity', quote: 'The Fool', targets: [{ spreadIndex: 0, detailIds: [] }] },
    { id: 'dog', kind: 'literal', quote: 'a nonexistent dog', targets: [{ spreadIndex: 0, detailIds: ['white-dog'] }] }
  ] };
  const original = structuredClone(document);
  const validation = validateGeneratedSample({ ...sample, document });
  assert.equal(validation.suppliedAnnotations, 2);
  assert.equal(validation.acceptedAnnotations, 1);
  assert.equal(validation.errors.length, 1);
  assert.deepEqual(document, original);
  assert.equal(validation.fallbackCounts.literal, 1);
  assert.equal(validation.compiledCounts.interpretation, 0);
});

test('fresh generated corpus compiles unchanged model documents with multilingual and reflection-optional coverage', async () => {
  const { readFile } = await import('node:fs/promises');
  const dataset = JSON.parse(await readFile(new URL('../output/reading-motion/fixtures/generated-gesture-readings.json', import.meta.url), 'utf8'));
  assert.equal(dataset.samples.length, 15);
  for (const item of dataset.samples) {
    assert.equal(item.generation.actualModel, 'claude-opus-5-5', item.id);
    const original = JSON.parse(await readFile(new URL(`../output/reading-motion/evidence/2026-10-09-generated-associations/${item.id}.json`, import.meta.url), 'utf8'));
    assert.deepEqual(item.document, original.result.structured, `${item.id}: preserve raw generation`);
    const validation = validateGeneratedSample(item);
    assert.deepEqual(validation.errors, [], item.id);
    assert.equal(validation.acceptedAnnotations, validation.suppliedAnnotations, item.id);
    assert.equal(validation.introducedCards, item.cards.length, item.id);
    if (!item.reflectionsText) assert.ok(item.document.annotations.every(cue => cue.personalContext?.type !== 'querent-reflection'), `${item.id}: absent reflections cannot be invented`);
    assert.ok(validation.compiledCounts.interpretation > 0, `${item.id}: interpretation comes from the generated document`);
    assert.equal(validation.fallbackCounts.interpretation, 0, `${item.id}: no memorized return fallback`);
  }
});
