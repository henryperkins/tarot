import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as scene from '../functions/lib/canonicalSceneEvidence.js';
const KEYS = 'rws-hierophant-keys-at-feet';
const ART = 'thoth-art-motif-on-cauldron';
const hierophant = { card: 'The Hierophant', number: 5, position: 'Bond', orientation: 'Reversed' };
const art = { card: 'Art', number: 14, position: 'Present', orientation: 'Upright' };
const envelope = blocks => JSON.stringify({ format: 'card-scenes-v1', blocks });
const prose = { type: 'prose', text: '### Bond: The Hierophant\n\nTradition can offer a practice to try.' };
const options = { cardsInfo: [hierophant], deckStyle: 'rws-1909', allowedFactIds: [KEYS], required: true };

function render(raw, context = options) {
  return scene.renderCanonicalSceneReading(raw, context);
}

test('only accepted drawn identity and selected deck authorize a reviewed fact', () => {
  assert.deepEqual(scene.getCanonicalSceneFacts([hierophant], 'rws-1909').map(fact => fact.id), [KEYS]);
  assert.deepEqual(scene.getCanonicalSceneFacts([art], 'thoth-a1').map(fact => fact.id), [ART]);
  assert.deepEqual(scene.getCanonicalSceneFacts([{ ...art, card: 'Temperance' }], 'thoth-a1').map(fact => fact.id), [ART]);
  assert.deepEqual(scene.getCanonicalSceneFacts([hierophant], 'marseille-classic'), []);
  assert.deepEqual(scene.getCanonicalSceneFacts([art], 'rws-1909'), []);
  assert.deepEqual(scene.getCanonicalSceneFacts([{ card: 'The Sun', number: 5, canonicalName: 'The Hierophant' }], 'rws-1909'), []);
});

test('an approved reference renders the source caption while preserving prose and raw transport', () => {
  const raw = envelope([prose, { type: 'fact', id: KEYS, language: 'en' }]);
  const result = render(raw);
  assert.equal(result.reading, prose.text + "\n\nIn the traditional RWS image, the crossed keys are at the Hierophant's feet.");
  assert.equal(result.rawReading, raw);
  assert.deepEqual(result.usedFactIds, [KEYS]);
  assert.doesNotMatch(result.reading, /card-scenes-v1|"blocks"|rws-hierophant-keys-at-feet/);
});

test('the Thoth caption retains the supported broad relation without adding a rim or ingredient', () => {
  const result = render(envelope([{ type: 'prose', text: '### Art\n\nUne invitation à réunir.' }, { type: 'fact', id: ART, language: 'fr' }]), {
    cardsInfo: [art], deckStyle: 'thoth-a1', allowedFactIds: [ART], required: true
  });
  assert.match(result.reading, /le motif du corbeau sur un crâne figure sur le chaudron/);
  assert.doesNotMatch(result.reading, /bord|intérieur|ingrédient|rim|inside/);
});

for (const language of ['en', 'fr', 'es', 'pt', 'de', 'it', 'ja', 'zh']) {
  test(`an approved ${language} caption renders without an internal transport envelope`, () => {
    const result = render(envelope([prose, { type: 'fact', id: KEYS, language }]));
    assert.ok(result.reading.startsWith(prose.text + '\n\n'));
    assert.ok(result.reading.length > prose.text.length + 20);
    assert.doesNotMatch(result.reading, /"type"|card-scenes-v1|rws-hierophant/);
  });
}

for (const [name, block, context] of [
  ['unknown fact', { type: 'fact', id: 'invented', language: 'en' }, options],
  ['undrawn card', { type: 'fact', id: KEYS, language: 'en' }, { ...options, cardsInfo: [{ card: 'The Sun', number: 19 }] }],
  ['cross-deck fact', { type: 'fact', id: KEYS, language: 'en' }, { ...options, deckStyle: 'thoth-a1' }],
  ['fact absent from final prompt', { type: 'fact', id: KEYS, language: 'en' }, { ...options, allowedFactIds: [] }],
  ['missing language', { type: 'fact', id: KEYS }, options],
  ['unsupported language', { type: 'fact', id: KEYS, language: 'xx' }, options],
  ['unknown locale suffix', { type: 'fact', id: KEYS, language: 'en-Invented' }, options],
  ['unlisted regional tag', { type: 'fact', id: KEYS, language: 'fr-CA' }, options],
  ['replacement literal text', { type: 'fact', id: KEYS, language: 'en', text: 'He holds crossed keys.' }, options],
  ['unknown block', { type: 'image', text: 'He holds crossed keys.' }, options]
]) {
  test(`${name} fails before any consumer reading is returned`, () => {
    assert.throws(() => render(envelope([prose, block]), context), { code: 'invalid_card_fact_reference' });
  });
}

for (const raw of ['A plain reading.', '{"format":"card-scenes-v1","blocks":[', envelope([prose]) + '\nUnvalidated trailer', JSON.stringify({ format: 'card-scenes-v1', blocks: [prose], injected: 'extra' })]) {
  test(`a required contract rejects malformed or unvalidated transport: ${raw.slice(0, 24)}`, () => {
    assert.throws(() => render(raw), { code: 'invalid_card_fact_reference' });
  });
}

test('a prose-only envelope remains usable without requiring a literal description', () => {
  const result = render(envelope([prose]));
  assert.equal(result.reading, prose.text);
  assert.deepEqual(result.usedFactIds, []);
});

test('a prose block cannot smuggle the internal fact transport into the consumer reading', () => {
  for (const text of ['Use rws-hierophant-keys-at-feet for this card.', '{"format":"card-scenes-v1","blocks":[]}']) {
    assert.throws(() => render(envelope([{ type: 'prose', text }])), { code: 'invalid_card_fact_reference' });
  }
});

test('readings without the controlled fact contract preserve their ordinary text', () => {
  const raw = '### The Sun\n\nConsider a small experiment.\n\nYour choices matter.';
  assert.equal(render(raw, { cardsInfo: [{ card: 'The Sun' }], deckStyle: 'rws-1909', allowedFactIds: [], required: false }).reading, raw);
});

// 2026-10-31 F3b standard run: the contract described interpretation blocks as
// `Type:"interpretation" adds text:"..."`, so a Celtic response sent
// {"type":"interpretation","text":...} without id/language and the strict
// renderer rejected the whole reading. Every documented shape must render.
test('every reference block the contract documents is accepted by the strict renderer', () => {
  const contract = scene.buildCanonicalSceneContract([hierophant], 'rws-1909').split('\n')[0];
  const shapes = [...contract.matchAll(/\{"type":"(?:fact|interpretation)"[^{}]*\}/g)].map(match => JSON.parse(match[0]));
  assert.deepEqual(shapes.map(shape => shape.type).sort(), ['fact', 'interpretation']);
  for (const shape of shapes) {
    assert.deepEqual(Object.keys(shape).filter(key => key === 'id' || key === 'language'), ['id', 'language'], shape.type);
    const block = { ...shape, id: KEYS, ...(shape.type === 'interpretation' ? { text: 'Consider one shared practice.' } : {}) };
    assert.deepEqual(render(envelope([prose, block])).usedFactIds, [KEYS], shape.type);
  }
});

test('an interpretation block without id and language is still rejected', () => {
  assert.throws(() => render(envelope([
    prose,
    { type: 'fact', id: KEYS, language: 'en' },
    { type: 'interpretation', text: 'Symbolically, a practice to try.' }
  ])), { code: 'invalid_card_fact_reference' });
});
