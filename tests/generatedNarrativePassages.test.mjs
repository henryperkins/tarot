import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveNarrativePassages } from '../src/lib/generatedNarrativePassages.js';

const cards = [{ index: 0, canonicalName: 'The Star', artworkEdition: 'rws-immanuelle-vector' }];
const raw = 'La Estrella vierte agua. Esta corriente puede acompañar tu nuevo comienzo.';
const document = { version: 1, artworkEdition: 'rws-immanuelle-vector', raw, annotations: [
  { id: 'water', kind: 'literal', quote: 'La Estrella vierte agua', targets: [{ spreadIndex: 0, detailIds: ['pool-pour'] }] },
  { id: 'beginning', kind: 'interpretation', quote: 'Esta corriente puede acompañar tu nuevo comienzo', targets: [{ spreadIndex: 0, detailIds: ['pool-pour'] }], establishedBy: ['water'], personalContext: { type: 'question', quote: 'nuevo comienzo' } }
] };

test('generated associations become available only as their exact source arrives', () => {
  const source = { runId: 'fresh', raw: 'La Estrella ', status: 'streaming', semanticDocument: document, question: '¿Cómo dar un nuevo comienzo?' };
  assert.equal(resolveNarrativePassages({ source, cards }).associations.length, 0);
  source.raw = raw.slice(0, 24);
  assert.deepEqual(resolveNarrativePassages({ source, cards }).associations.map(cue => cue.id), ['water']);
  source.raw = raw; source.status = 'complete';
  const result = resolveNarrativePassages({ source, cards });
  assert.equal(result.associations[1].personalContext.quote, 'nuevo comienzo');
  assert.equal(result.associations[1].targets[0].occurrenceId, 'fresh:0');
});

test('replacement text and a different edition cannot inherit generated interpretations', () => {
  for (const source of [
    { runId: 'replacement', raw: 'The Star. A figure pours water into a pool.', status: 'complete', semanticDocument: document },
    { runId: 'edition', raw, status: 'complete', semanticDocument: document }
  ]) {
    const result = resolveNarrativePassages({ source, cards, artworkEdition: source.runId === 'edition' ? 'rws-1909-scan' : cards[0].artworkEdition });
    assert.equal(result.associations.some(cue => cue.kind === 'interpretation'), false);
  }
});

test('partial semantic coverage still introduces other explicitly named spread cards', () => {
  const partial = { ...document, raw: `${raw} The Hermit invites a quieter pace.` };
  const spread = [...cards, { index: 1, canonicalName: 'The Hermit', artworkEdition: 'rws-immanuelle-vector' }];
  const result = resolveNarrativePassages({ source: { runId: 'partial', raw: partial.raw, status: 'complete', semanticDocument: partial }, cards: spread });
  assert.deepEqual(result.introductions.map(item => item.spreadIndex), [0, 1]);
  assert.ok(result.associations.some(cue => cue.kind === 'identity' && cue.targets[0].spreadIndex === 1));
  assert.ok(result.associations.some(cue => cue.kind === 'interpretation'));
});
