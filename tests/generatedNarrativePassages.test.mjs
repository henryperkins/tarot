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

const binding = { readingResultId: 'bound-reading', sourceRevision: 0, spreadHash: 'a'.repeat(64), contextHash: 'b'.repeat(64),
  artworkEdition: 'rws-immanuelle-vector', catalogVersion: '1' };
const acceptedCues = document.annotations.map(annotation => ({
  id: `vc:${annotation.id}`, kind: annotation.kind,
  passage: { start: raw.indexOf(annotation.quote), end: raw.indexOf(annotation.quote) + annotation.quote.length, quote: annotation.quote },
  targets: annotation.targets.map(target => ({ ...target, canonicalName: 'The Star' })),
  ...(annotation.personalContext ? { personalContext: annotation.personalContext } : {})
}));
const ledger = { version: 1, binding, ledgerRevision: 2, raw, analyzedEnd: raw.length, analyzedHash: 'c'.repeat(64),
  cues: acceptedCues, introductions: [{ spreadIndex: 0, canonicalName: 'The Star', start: 0, namedEnd: 0,
    descriptionStart: 0, midpoint: 11, end: 22 }], receipts: [] };

test('a verified cumulative ledger resolves late prefix interpretations after prose completion', () => {
  const source = { runId: binding.readingResultId, sourceRevision: 0, raw: `${raw} Another paragraph.`, status: 'complete',
    visualBinding: binding, cueLedger: ledger, question: '¿Cómo dar un nuevo comienzo?' };
  const result = resolveNarrativePassages({ source, cards });
  assert.deepEqual(result.associations.map(cue => cue.id), ['vc:water', 'vc:beginning']);
  assert.equal(result.associations[1].personalContext.quote, 'nuevo comienzo');
  assert.equal(result.associations[0].targets[0].occurrenceId, 'bound-reading:0');
  assert.equal(result.ledgerRevision, 2);
  assert.equal(result.binding, binding);
  const noReflection = resolveNarrativePassages({ source: { ...source, question: '' }, cards });
  assert.equal(noReflection.associations[1].id, 'vc:beginning');
  assert.equal(noReflection.associations[1].personalContext, undefined);
});

test('unbound, replaced, wrong-edition and mismatched cumulative cues never reach the registry', () => {
  const source = { runId: binding.readingResultId, sourceRevision: 0, raw, status: 'complete', visualBinding: binding, cueLedger: ledger };
  for (const change of [{ visualBinding: undefined }, { runId: 'other' }, { sourceRevision: 1 },
    { visualBinding: { ...binding, catalogVersion: 'changed' } }, { raw: 'Different reading' }]) {
    assert.equal(resolveNarrativePassages({ source: { ...source, ...change }, cards }).associations.some(cue => cue.id.startsWith('vc:')), false);
  }
  assert.equal(resolveNarrativePassages({ source, cards, artworkEdition: 'other' }).associations.some(cue => cue.id.startsWith('vc:')), false);
});
