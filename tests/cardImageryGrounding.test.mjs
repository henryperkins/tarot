import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCanonicalSceneFacts, buildCanonicalSceneContract, renderCanonicalSceneReading } from '../functions/lib/canonicalSceneEvidence.js';
import { buildEnhancedClaudePrompt, buildThreeCardReading } from '../functions/lib/narrativeBuilder.js';
import { analyzeThreeCard } from '../functions/lib/spreadAnalysis.js';
import { generateWithClaudeApi } from '../functions/lib/narrativeBackends.js';
import { parseUserContext } from '../functions/lib/narrative/prompts/userContext.js';
import { buildPositionCardText } from '../functions/lib/narrative/helpers.js';

const CUPS = 'rws-eight-cups-uncovered-head';
const HERMIT = 'rws-hermit-star-in-lantern';
const cups = { card: 'Eight of Cups', suit: 'Cups', rank: 'Eight', rankValue: 8, orientation: 'Upright', meaning: 'Seeking a meaningful direction.', position: 'Past' };
const hermit = { card: 'The Hermit', number: 9, orientation: 'Upright', meaning: 'Reflection and discernment.', position: 'Present' };
const sun = { card: 'The Sun', number: 19, orientation: 'Reversed', meaning: 'Clarity and warmth.', position: 'Future' };
const cardsInfo = [cups, hermit, sun];
const options = { cardsInfo, deckStyle: 'rws-1909', allowedFactIds: [CUPS, HERMIT], required: true };
const prose = { type: 'prose', text: '### Opening\n\nConsider your stated question without assuming an answer.' };
const envelope = blocks => JSON.stringify({ format: 'card-scenes-v1', blocks });

test('the two reviewed observations belong to their drawn cards, without inventing light range', () => {
  assert.deepEqual(getCanonicalSceneFacts([cups], 'rws-1909').map(fact => fact.id), [CUPS]);
  const facts = getCanonicalSceneFacts([hermit], 'rws-1909');
  assert.deepEqual(facts.map(fact => fact.id), [HERMIT]);
  assert.equal(facts[0].captions.en, 'In the traditional RWS image, The Hermit holds a lantern containing a star.');
  assert.equal(getCanonicalSceneFacts([cups], 'rws-1909')[0].captions.es, 'En la imagen tradicional del RWS, la figura de Eight of Cups lleva la cabeza descubierta y una capa roja.');
  assert.deepEqual(getCanonicalSceneFacts([cups, hermit], 'thoth-a1'), []);
  assert.deepEqual(getCanonicalSceneFacts([{ ...hermit, card: 'The Sun', canonicalName: 'The Hermit' }], 'rws-1909'), []);
});

test('the actual contract associates each observation with its own card instead of a shared symbol pool', () => {
  const line = buildCanonicalSceneContract(cardsInfo, 'rws-1909').split('\n').find(row => row.startsWith('- SCENE FACTS (JSON):'));
  const facts = line ? JSON.parse(line.slice('- SCENE FACTS (JSON): '.length)) : [];
  assert.equal(facts.find(fact => fact.id === CUPS)?.card, 'eight of cups');
  assert.equal(facts.find(fact => fact.id === HERMIT)?.card, 'the hermit');
});

test('a referenced Spanish interpretation renders the fixed observation before a distinct symbolic lead-in', () => {
  const raw = envelope([prose, { type: 'interpretation', id: CUPS, language: 'es', text: 'Puedes usar esta imagen para reflexionar sobre una elección.' }]);
  const rendered = renderCanonicalSceneReading(raw, options);
  assert.equal(rendered.reading, prose.text + '\n\nEn la imagen tradicional del RWS, la figura de Eight of Cups lleva la cabeza descubierta y una capa roja. Como lectura simbólica: Puedes usar esta imagen para reflexionar sobre una elección.');
  assert.equal(rendered.rawReading, raw);
  assert.deepEqual(rendered.usedFactIds, [CUPS]);
  assert.doesNotMatch(rendered.reading, /card-scenes-v1|"blocks"|rws-eight/);
});

for (const [language, prefix] of [['en', 'As a symbolic reading:'], ['fr', 'Comme lecture symbolique :'], ['pt', 'Como leitura simbólica:'], ['de', 'Als symbolische Deutung:'], ['it', 'Come lettura simbolica:'], ['ja', '象徴的な読みとして：'], ['zh', '作为象征性解读：']]) {
  test(`a ${language} interpretation keeps a local symbolic distinction and the card-owned caption`, () => {
    const rendered = renderCanonicalSceneReading(envelope([prose, { type: 'interpretation', id: HERMIT, language, text: 'Optional reflection.' }]), options);
    assert.ok(rendered.reading.includes(prefix + ' Optional reflection.'));
    assert.deepEqual(rendered.usedFactIds, [HERMIT]);
  });
}

for (const [name, block, context] of [
  ['wrong deck', { id: HERMIT, language: 'en', text: 'Reflect.' }, { ...options, deckStyle: 'thoth-a1' }],
  ['undrawn card', { id: HERMIT, language: 'en', text: 'Reflect.' }, { ...options, cardsInfo: [cups] }],
  ['removed evidence', { id: HERMIT, language: 'en', text: 'Reflect.' }, { ...options, allowedFactIds: [] }],
  ['unknown evidence', { id: 'invented', language: 'en', text: 'Reflect.' }, options],
  ['replacement caption', { id: CUPS, language: 'es', text: 'Reflexiona.', caption: 'Figura encapuchada.' }, options],
  ['invented attribute', { id: HERMIT, language: 'en', text: 'Reflect.', lightRange: 'three steps' }, options],
  ['unsupported locale', { id: HERMIT, language: 'es-MX', text: 'Reflexiona.' }, options],
  ['empty interpretation', { id: HERMIT, language: 'en', text: '  ' }, options],
  ['internal reference', { id: HERMIT, language: 'en', text: CUPS }, options]
]) {
  test(`${name} cannot reach consumer text through an interpretation reference`, () => {
    assert.throws(() => renderCanonicalSceneReading(envelope([prose, { type: 'interpretation', ...block }]), context), { code: 'invalid_card_fact_reference' });
  });
}

for (const target of ['claude', 'openai', 'modal']) {
  test(`${target} actual prompt suppresses competing covered scenes while preserving exact reader constraints`, () => {
    const question = 'No supongas una partida anterior. Quiero decidir antes del 4 de noviembre sin cambiar el horario de Ana.';
    const built = buildEnhancedClaudePrompt({ spreadInfo: { key: 'threeCard', name: 'Three-Card Story' }, cardsInfo,
      themes: {}, userQuestion: question, deckStyle: 'rws-1909', budgetTarget: target,
      promptBudgetEnv: { GRAPHRAG_ENABLED: 'false' } });
    assert.deepEqual(built.promptMeta.canonicalSceneFacts.providedIds, [CUPS, HERMIT]);
    assert.equal(parseUserContext(built.userPrompt).get('question'), question);
    for (const card of cardsInfo) assert.ok(built.userPrompt.includes(card.card));
    assert.doesNotMatch(built.userPrompt, /Picture Traveler climbs|lantern piercing darkness|focused beam in darkness|The light dims from isolation/);
    assert.match(built.userPrompt, /RWS image \(The Sun\):/);
    assert.match(built.userPrompt, /\*Metaphor:/);
  });
}

test('the real backend renders an image interpretation before returning the consumer reading', async () => {
  const raw = envelope([prose, { type: 'interpretation', id: HERMIT, language: 'en', text: 'You might choose one question for a quiet moment.' }]);
  const result = await generateWithClaudeApi({ GRAPHRAG_ENABLED: 'false' }, {
    cardsInfo: [hermit], analysis: { spreadKey: 'single', themes: {} }, spreadInfo: { key: 'single', name: 'One-Card Insight' },
    deckStyle: 'rws-1909', userQuestion: 'What can reflection offer?'
  }, 'imagery-reference-test', { send: async () => ({ text: raw, model: 'claude-opus-5-5', usage: {} }) });
  assert.equal(result.rawReading, raw);
  assert.match(result.reading, /The Hermit holds a lantern containing a star\. As a symbolic reading: You might choose/);
  assert.doesNotMatch(result.reading, /card-scenes-v1|rws-hermit/);
});

test('the complete local fallback reading distinguishes metaphor without exposing prompt projection labels', async () => {
  const cards = [
    { ...sun, position: 'Past — influences that led here' },
    { ...cups, position: 'Present — where you stand now' },
    { ...hermit, position: 'Future — potential trajectory' }
  ];
  const reading = await buildThreeCardReading({ cardsInfo: cards, threeCardAnalysis: analyzeThreeCard(cards),
    themes: {}, context: 'general', deckStyle: 'rws-1909', userQuestion: 'What could help me reflect on this choice?' });
  assert.doesNotMatch(reading, /RWS image source for|Symbolic image reading for|not a literal observation/);
  assert.match(reading, /As a metaphor,|Symbolically,/);
});

for (const card of [sun, cups]) {
  test(`the existing omit-imagery budget control removes the optional ${card.card} hook without removing meaning`, () => {
    const text = buildPositionCardText(card, 'Present — where you stand now', { deckStyle: 'rws-1909', omitImagery: true });
    assert.ok(text.includes(card.card));
    assert.ok(text.toLowerCase().includes(card.meaning.slice(0, -1).toLowerCase()));
    assert.doesNotMatch(text, /As a metaphor,|In the RWS image,/);
  });
}

test('the system style rule and the user contract both show id and language for interpretation references', () => {
  const built = buildEnhancedClaudePrompt({ spreadInfo: { key: 'threeCard', name: 'Three-Card Story' }, cardsInfo,
    themes: {}, userQuestion: 'What could help me choose?', deckStyle: 'rws-1909',
    promptBudgetEnv: { GRAPHRAG_ENABLED: 'false' } });
  const style = built.systemPrompt.split('\n').find(line => line.startsWith('- OUTPUT STYLE:')) || '';
  assert.match(style, /SCENE OUTPUT CONTRACT/);
  assert.match(style, /id and language/);
  const contract = built.userPrompt.split('\n').find(line => line.startsWith('- SCENE OUTPUT CONTRACT:')) || '';
  assert.ok(contract.includes('{"type":"interpretation","id":"ID","language":"en","text":"..."}'), contract);
  assert.ok(contract.includes('{"type":"fact","id":"ID","language":"en"}'), contract);
});
