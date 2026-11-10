import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSyncEvaluationGate } from '../functions/lib/evaluation.js';
import { resolveReadingCards } from '../functions/lib/readingCardResolution.js';
import { checkMemoryCompatibility, selectMemoriesForReading } from '../functions/lib/readingMemorySelection.js';
import { detectHallucinatedCards } from '../functions/lib/readingQuality.js';
import { detectUndrawnCardAssertions } from '../functions/lib/readingCardAssertions.js';
import { createReadingPassageGuard } from '../functions/lib/readingPassageGuard.js';
import { createVisionPromptProjector } from '../functions/lib/visionPromptProjection.js';
import { performSpreadAnalysis } from '../functions/lib/spreadAnalysisOrchestrator.js';
import { getTraditionalPassagePreview } from '../src/hooks/narrativeReadingModelUtils.js';

const drawn = [{ card: 'Temperance', canonicalName: 'Temperance', canonicalKey: 'temperance' }];
const falsePresence = 'The Tower and The Devil are in your spread. ';

test('public detector, passage delivery and vision projection retain undrawn-assertion protection', () => {
  assert.deepEqual(detectHallucinatedCards(falsePresence, drawn), ['The Tower', 'The Devil']);
  assert.throws(() => createReadingPassageGuard({ cardsInfo: drawn, spreadKey: 'single' }).push(falsePresence), { code: 'reading_stream_rejected' });
  assert.throws(() => createReadingPassageGuard({ cardsInfo: drawn, spreadKey: 'single' }).push('The Moon appears in your spread. '), { code: 'reading_stream_rejected' });
  assert.equal(createVisionPromptProjector(drawn)(falsePresence + 'A quiet color remains.'), 'A quiet color remains.');
});

for (const text of [
  'She said: “I have a story. My child is 8. I am happy.”',
  'Suppose this story is true: “It is summer. My child is 8. We live nearby.”',
  'She said: "I have a story. My child is 8. I am happy."',
  "She said: 'I have a story. My child is 8. I am happy.'"
]) test(`quoted middle sentences cannot authorize memory: ${text}`, () => {
  const sources = [{ id: 'question', text }];
  assert.notEqual(checkMemoryCompatibility('My child is 8', sources).status, 'supported');
  assert.deepEqual(selectMemoriesForReading([{ id: 'synthetic-age', text: 'My child is 8' }], { sources }).selectedIds, []);
  assert.equal(checkMemoryCompatibility('My child is 8', [{ id: 'question', text: `${text} My child is 8.` }]).status, 'supported');
});

for (const text of [
  'It is not true that The Moon appears in your spread.',
  'It is not the case that you drew The Moon.',
  'It is false that The Moon is in your spread.',
  'Imagine you drew Temperance, and The Moon appears in your spread.'
]) test(`outer scope preserves an explicit non-assertion: ${text}`, () => {
  assert.deepEqual(detectUndrawnCardAssertions(text, drawn), []);
  assert.deepEqual(detectHallucinatedCards(text, drawn), []);
});

test('independent affirmed clause after denial or hypothetical remains rejected', () => {
  for (const text of [
    'It is not true that Temperance is drawn, and The Moon appears in your spread.',
    'Imagine you drew Temperance, but The Moon appears in your spread.'
  ]) assert.deepEqual(detectUndrawnCardAssertions(text, drawn), ['The Moon']);
  assert.deepEqual(detectUndrawnCardAssertions('It is not true that The Moon is not drawn.', drawn), ['The Moon']);
});

test('legacy decision positions inform context before preliminary analysis', async t => {
  t.mock.method(console, 'log', () => {});
  const cards = ['The Sun', 'The Star', 'Temperance', 'The Hermit', 'The Fool'].map((card, index) => ({ card,
    position: ['Core', 'Path A: continue in my career at work', 'Path B: take the promotion at work', 'Advice', 'Outcome'][index], orientation: 'Upright' }));
  const analysis = await performSpreadAnalysis({ name: 'Decision', key: 'decision' }, cards, {
    userQuestion: 'What should I know?', focusAreas: ['Love & relationships'], enableSemanticScoring: false,
    env: { GRAPHRAG_ENABLED: 'true', ENABLE_SEMANTIC_SCORING: 'false' }
  }, 'synthetic-review-decision');
  assert.equal(analysis.graphRAGPayload.retrievalSummary.contextSource, 'decisionPaths');
  assert.equal(analysis.graphRAGPayload.retrievalSummary.questionContext, 'career');
  assert.ok(analysis.graphRAGPayload.retrievalSummary.queryCoverage.some(row => row.id === 'pathA' && row.included));
});

for (const malformed of ['legacy', { text: 'legacy' }]) test(`malformed optional preview ${typeof malformed} cannot crash historical reconstruction`, () => {
  const themes = { knowledgeGraph: { retrievedPassages: malformed } };
  const recovery = { savedDeckStyle: 'thoth-a1', cardsInfo: [{ name: 'Strength', number: 8 }] };
  const previews = getTraditionalPassagePreview(themes, null, 'thoth-a1', recovery);
  assert.ok(previews.length > 0);
  assert.ok(previews.every(row => row.previewOrigin === 'reconstructed'));
  assert.deepEqual(getTraditionalPassagePreview(themes, null, 'thoth-a1'), []);
});


test('deterministic evaluation preserves resolved Thoth deck identity when explicit deck is absent', async t => {
  t.mock.method(console, 'log', () => {});
  const cardsInfo = resolveReadingCards([{ card: 'Knight of Cups', position: 'Theme', orientation: 'Upright', meaning: 'Reflection' }], 'thoth-a1');
  for (const explicit of [undefined, 'thoth-a1']) {
    const result = await runSyncEvaluationGate({ EVAL_ENABLED: 'false', EVAL_GATE_ENABLED: 'false' }, {
      reading: 'You drew Knight of Cups. You can choose a patient approach.', cardsInfo, deckStyle: explicit, spreadKey: 'single'
    }, { cardCoverage: 1, cardCount: 1, hallucinatedCards: [], undrawnCardAssertions: [] });
    assert.equal(result.passed, true, JSON.stringify(result));
  }
});


for (const text of [
  'It is not true that The Moon appears in your spread. ',
  'It is not the case that you drew The Moon. ',
  'It is false that The Moon is in your spread. ',
  'Imagine you drew Temperance, and The Moon appears in your spread. '
]) test(`passage streaming preserves nonassertive outer scope across deltas: ${text}`, () => {
  const guard = createReadingPassageGuard({ cardsInfo: drawn, spreadKey: 'single' });
  const split = text.indexOf('The Moon') + 5;
  assert.deepEqual(guard.push(text.slice(0, split)), []);
  assert.equal(guard.push(text.slice(split)).join('') + guard.finish().join(''), text);
});

test('quoted qualifiers and unfinished reported quotations cannot become present-age authority', () => {
  for (const text of ['My child is 8 “next year”.', 'She said: “A story. My child is 8.']) {
    assert.notEqual(checkMemoryCompatibility('My child is 8', [{ id: 'question', text }]).status, 'supported');
    assert.deepEqual(selectMemoriesForReading([{ id: 'age', text: 'My child is 8' }], { sources: [{ id: 'question', text }] }).selectedIds, []);
  }
});
