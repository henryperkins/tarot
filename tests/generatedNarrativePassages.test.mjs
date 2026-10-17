import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveNarrativePassages, measureNarrativePassage } from '../src/lib/generatedNarrativePassages.js';
import { createGestureFocusState, reduceGestureFocus } from '../src/components/reading/narrative/narrativeGestureState.js';

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


test('pending visual work retains fallback phrases for inspection without starting an introduction', () => {
  const source = { runId: binding.readingResultId, sourceRevision: 0,
    raw: 'The Star invites a gentler pace.', status: 'complete', kind: 'complete',
    visualBinding: binding, visualJobStatus: 'pending' };
  const pending = resolveNarrativePassages({ source, cards });
  assert.equal(pending.associations.length, 1);
  assert.equal(pending.associations[0].kind, 'identity');
  assert.equal(pending.associations[0].automatic, false);
  assert.equal(pending.introductions[0].occurrenceId, `${binding.readingResultId}:0`);
  for (const visualJobStatus of ['failed', 'cancelled', 'expired', 'complete', 'idle', undefined]) {
    const fallback = resolveNarrativePassages({ source: { ...source, visualJobStatus }, cards });
    assert.equal(fallback.associations[0].id, pending.associations[0].id);
    assert.notEqual(fallback.associations[0].automatic, false, visualJobStatus);
  }
  assert.notEqual(resolveNarrativePassages({ source: { ...source, kind: 'hydrate' }, cards }).associations[0].automatic, false);
});

test('accepted ledger connections keep their turns while pending work suppresses only supplemented fallback cards', () => {
  const extendedRaw = `${raw} The Hermit invites a quieter pace.`;
  const spread = [...cards, { index: 1, canonicalName: 'The Hermit', artworkEdition: 'rws-immanuelle-vector' }];
  const source = { runId: binding.readingResultId, sourceRevision: 0, raw: extendedRaw,
    status: 'complete', kind: 'complete', visualBinding: binding, cueLedger: ledger, visualJobStatus: 'running',
    question: '¿Cómo dar un nuevo comienzo?' };
  const result = resolveNarrativePassages({ source, cards: spread });
  assert.deepEqual(result.associations.filter(cue => cue.automatic !== false).map(cue => cue.id), ['vc:water', 'vc:beginning']);
  const fallback = result.associations.find(cue => cue.targets[0].spreadIndex === 1);
  assert.equal(fallback.kind, 'identity');
  assert.equal(fallback.automatic, false);
  assert.deepEqual(result.introductions.map(intro => intro.occurrenceId), [`${binding.readingResultId}:0`, `${binding.readingResultId}:1`]);
});

test('pending legacy annotations wait for their accepted ledger successor without repeating an introduction', () => {
  const text = 'The Star invites a gentler pace.';
  const semanticDocument = { version: 1, artworkEdition: binding.artworkEdition, raw: text, annotations: [
    { id: 'legacy-star', kind: 'identity', quote: 'The Star', targets: [{ spreadIndex: 0, detailIds: [] }] }
  ] };
  const source = { runId: binding.readingResultId, sourceRevision: 0, raw: text, kind: 'complete', status: 'complete',
    visualBinding: binding, visualJobStatus: 'pending', semanticDocument };
  const pending = resolveNarrativePassages({ source, cards });
  assert.equal(pending.associations[0].id, 'legacy-star');
  assert.equal(pending.associations[0].automatic, false);
  let state = createGestureFocusState({ runId: source.runId, sourceRevision: 0, ...pending });
  const event = (type, fields) => ({ type, runId: source.runId, sourceRevision: 0, ...fields });
  state = reduceGestureFocus(state, event('PROGRESS', { progress: { visibleEnd: text.length }, now: 100 }));
  state = reduceGestureFocus(state, event('VISIBILITY', { visibilitySnapshot: { 'legacy-star': true }, now: 100 }));
  assert.equal(state.current, null);
  state = reduceGestureFocus(state, event('HOLD', { selection: { kind: 'association', id: 'legacy-star' }, now: 200 }));
  assert.equal(state.phase, 'held');
  state = reduceGestureFocus(state, event('RELEASE', { now: 300 }));
  const acceptedLedger = { ...ledger, ledgerRevision: 3, raw: text, analyzedEnd: text.length,
    cues: [{ ...pending.associations[0], id: 'vc:star' }], introductions: pending.introductions };
  const accepted = resolveNarrativePassages({ source: { ...source, cueLedger: acceptedLedger }, cards });
  assert.equal(accepted.mode, 'ledger');
  assert.notEqual(accepted.associations[0].automatic, false);
  state = reduceGestureFocus(state, event('CUES_ARRIVED', { binding, ledgerRevision: 3, ...accepted,
    visibilitySnapshot: { 'vc:star': true }, now: 1000 }));
  assert.equal(state.current.id, 'vc:star');
  assert.equal(state.turnUntil, 2800);
  for (const fields of [{ visualJobStatus: 'failed' }, { visualJobStatus: undefined }, { kind: 'hydrate' }]) {
    assert.notEqual(resolveNarrativePassages({ source: { ...source, ...fields }, cards }).associations[0].automatic, false);
  }
});

// DOM layout cannot run in Node. The browser regression exercises actual Range
// geometry; these fixtures bound the renderer's full-source visibility decision.
test('passage eligibility uses all nonempty source rects instead of padded wrapper geometry', () => {
  const rect = (top, bottom, left = 20, right = 100) => ({ top, bottom, left, right, width: right - left, height: bottom - top });
  const document = { hidden: false, defaultView: { innerWidth: 300, innerHeight: 200,
    getComputedStyle: () => ({ opacity: '1', visibility: 'visible', display: 'inline', overflowX: 'visible', overflowY: 'visible' }) },
    elementFromPoint: () => element, createRange: () => ({ selectNodeContents() {}, getClientRects: () => rects }) };
  const element = { ownerDocument: document, nodeType: 1, parentElement: null, contains: hit => hit === element,
    getBoundingClientRect: () => rect(190, 250) };
  let rects = [rect(203, 224), rect(239, 260)];
  assert.equal(measureNarrativePassage(element).visible, false);
  rects = [rect(178, 199), rect(214, 235)];
  assert.equal(measureNarrativePassage(element).visible, false);
  rects = [rect(130, 151), rect(166, 187)];
  assert.equal(measureNarrativePassage(element).visible, true);
  document.hidden = true;
  assert.equal(measureNarrativePassage(element).visible, false);
  document.hidden = false;
  rects = [rect(-60, -39), rect(-24, -3)];
  assert.deepEqual(measureNarrativePassage(element), { visible: false, passed: true });
  rects = [];
  assert.deepEqual(measureNarrativePassage(element), { visible: false, passed: false });
});

test('ancestor clipping, hiding and actual occlusion reject quoted-source visibility', () => {
  const rect = { top: 20, bottom: 40, left: 20, right: 100, width: 80, height: 20 };
  let style = { opacity: '1', visibility: 'visible', display: 'block', overflowX: 'visible', overflowY: 'visible' };
  let hit;
  const document = { hidden: false, defaultView: { innerWidth: 300, innerHeight: 200, getComputedStyle: () => style },
    elementFromPoint: () => hit, createRange: () => ({ selectNodeContents() {}, getClientRects: () => [rect] }) };
  const parent = { nodeType: 1, parentElement: null, getBoundingClientRect: () => ({ top: 0, bottom: 30, left: 0, right: 300 }) };
  const element = { ownerDocument: document, nodeType: 1, parentElement: parent, contains: node => node === element, getBoundingClientRect: () => rect };
  hit = element;
  assert.equal(measureNarrativePassage(element).visible, true);
  style = { ...style, overflowY: 'hidden' };
  assert.equal(measureNarrativePassage(element).visible, false);
  style = { ...style, overflowY: 'visible', visibility: 'hidden' };
  assert.equal(measureNarrativePassage(element).visible, false);
  style = { ...style, visibility: 'visible', opacity: '0' };
  assert.equal(measureNarrativePassage(element).visible, false);
  style = { ...style, opacity: '1' }; hit = { contains: () => false };
  assert.equal(measureNarrativePassage(element).visible, false);
});


test('oversized quotations remain eligible through a fully exposed source line', () => {
  const rect = (top, bottom) => ({ top, bottom, left: 20, right: 180, width: 160, height: bottom - top });
  let rects = [rect(-60, -20), rect(0, 40), rect(60, 100), rect(120, 160), rect(180, 220)];
  let hit;
  const document = { hidden: false, defaultView: { innerWidth: 300, innerHeight: 200,
    getComputedStyle: () => ({ opacity: '1', visibility: 'visible', display: 'inline', overflowX: 'visible', overflowY: 'visible' }) },
    elementFromPoint: () => hit, createRange: () => ({ selectNodeContents() {}, getClientRects: () => rects }) };
  const element = { ownerDocument: document, nodeType: 1, parentElement: null, contains: node => node === element };
  hit = element;
  assert.equal(measureNarrativePassage(element).visible, true);
  // A sliver cannot start a turn, even when the complete quote is too tall.
  rects = [rect(195, 235), rect(255, 295), rect(315, 355), rect(375, 415), rect(435, 475)];
  assert.equal(measureNarrativePassage(element).visible, false);
  rects = [rect(-60, -20), rect(0, 40), rect(60, 100), rect(120, 160), rect(180, 220)];
  hit = { contains: () => false };
  assert.equal(measureNarrativePassage(element).visible, false);
  hit = element; document.hidden = true;
  assert.equal(measureNarrativePassage(element).visible, false);
});

test('sticky phone artwork bounds the readable area without relaxing ordinary quotations', () => {
  const rect = (top, bottom) => ({ top, bottom, left: 20, right: 180, width: 160, height: bottom - top });
  let rects = [rect(80, 120), rect(140, 180), rect(200, 240)];
  const companion = { getBoundingClientRect: () => ({ top: 0, bottom: 150, left: 0, right: 300 }) };
  const document = { hidden: false, defaultView: { innerWidth: 300, innerHeight: 300,
    getComputedStyle: node => node === companion ? { position: 'sticky', top: '0px' }
      : { opacity: '1', visibility: 'visible', display: 'inline', overflowX: 'visible', overflowY: 'visible' } },
    elementFromPoint: () => element, createRange: () => ({ selectNodeContents() {}, getClientRects: () => rects }) };
  const element = { ownerDocument: document, nodeType: 1, parentElement: null, contains: node => node === element,
    closest: () => ({ querySelector: () => companion }) };
  // 160px source cannot fit the 150px readable strip; its last complete line can play.
  assert.equal(measureNarrativePassage(element).visible, true);
  // This quote fits the strip: partial entry must still wait for every line.
  rects = [rect(130, 170), rect(190, 230)];
  assert.equal(measureNarrativePassage(element).visible, false);
  rects = [rect(150, 190), rect(210, 250)];
  assert.equal(measureNarrativePassage(element).visible, true);
});
