import test from 'node:test';
import assert from 'node:assert/strict';
import { compilePassageAnnotations } from '../shared/contracts/generatedPassageAnnotations.js';

const raw = 'La Estrella. Vierte agua en la piscina. Esa agua puede guardar lo que extrañas.';
const cards = [{ index: 0, canonicalName: 'The Star' }];
const options = { cards, getSupportedDetails: () => ['pool-pour'], userQuestion: '¿Cómo empezar de nuevo?', reflections: 'Extraño mi hogar.' };
const document = () => ({ version: 1, artworkEdition: 'rws-immanuelle-vector', raw,
  annotations: [
    { id: 'intro', kind: 'identity', quote: 'La Estrella', targets: [{ spreadIndex: 0, detailIds: [] }] },
    { id: 'water', kind: 'literal', quote: 'Vierte agua en la piscina', targets: [{ spreadIndex: 0, detailIds: ['pool-pour'] }] },
    { id: 'memory', kind: 'interpretation', quote: 'Esa agua puede guardar lo que extrañas', targets: [{ spreadIndex: 0, detailIds: ['pool-pour'] }], establishedBy: ['water'], personalContext: { type: 'querent-reflection', quote: 'Extraño mi hogar.' } }
  ] });

test('generated non-English imagery, interpretive returns and actual personal context compile without rewriting prose', () => {
  const result = compilePassageAnnotations(document(), options);
  assert.equal(result.errors.length, 0);
  assert.equal(result.payload.expectedRaw, raw);
  assert.deepEqual(result.payload.associations.map(cue => cue.kind), ['identity', 'literal', 'interpretation']);
  assert.equal(result.payload.associations[2].personalContext.quote, options.reflections);
  for (const cue of result.payload.associations) assert.equal(raw.slice(cue.passage.start, cue.passage.end), cue.passage.quote);
  assert.equal(result.payload.introductions[0].canonicalName, 'The Star');
});

test('interpretation requires an earlier literal of the same occurrence and supported detail', () => {
  const candidate = document();
  candidate.annotations[2].establishedBy = ['intro'];
  const result = compilePassageAnnotations(candidate, options);
  assert.equal(result.payload.associations.some(cue => cue.kind === 'interpretation'), false);
  assert.ok(result.errors.some(error => error.id === 'memory'));
});

test('invalid quotes, unknown details, duplicate IDs and invented context never become visual claims', () => {
  for (const mutate of [
    data => { data.annotations[1].quote = 'Nonexistent sentence'; },
    data => { data.annotations[1].targets[0].detailIds = ['invented-detail']; },
    data => { data.annotations[1].id = 'intro'; }
  ]) {
    const candidate = document(); mutate(candidate);
    const result = compilePassageAnnotations(candidate, options);
    assert.equal(result.payload.associations.some(cue => cue.kind === 'interpretation'), false);
    assert.ok(result.errors.length > 0);
  }
  const candidate = document();
  candidate.annotations[2].personalContext.quote = 'An invented diagnosis';
  const result = compilePassageAnnotations(candidate, options);
  assert.equal(result.payload.associations.at(-1).personalContext, undefined);
});

test('ambiguous repeated quote needs occurrence and a removed reflection leaves the reading complete', () => {
  const candidate = document();
  candidate.raw += ' La Estrella.';
  assert.ok(compilePassageAnnotations(candidate, options).errors.some(error => error.id === 'intro'));
  candidate.annotations[0].occurrence = 0;
  const result = compilePassageAnnotations(candidate, { ...options, reflections: '' });
  assert.equal(result.payload.associations.length, 3);
  assert.equal(result.payload.associations.at(-1).personalContext, undefined);
});

test('a named relationship cannot reuse unrelated details or target a different repeated card', () => {
  const candidate = document();
  candidate.annotations[2].kind = 'relationship';
  candidate.annotations[2].targets[0].spreadIndex = 1;
  const result = compilePassageAnnotations(candidate, { ...options, cards: [...cards, { index: 1, canonicalName: 'The Star' }] });
  assert.equal(result.payload.associations.some(cue => cue.kind === 'relationship'), false);
});

test('a vector document cannot lend geometry to an individual card in another artwork edition', () => {
  const candidate = document();
  const result = compilePassageAnnotations(candidate, { ...options,
    cards: [{ ...cards[0], artworkEdition: 'rws-1909-scan' }] });
  assert.deepEqual(result.payload.associations.map(cue => cue.kind), ['identity']);
  assert.ok(result.errors.some(error => error.id === 'water'));
  assert.ok(result.errors.some(error => error.id === 'memory'));
});
