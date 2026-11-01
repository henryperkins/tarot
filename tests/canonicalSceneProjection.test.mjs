import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPositionCardText, getKeySymbols } from '../functions/lib/narrative/helpers.js';
import { buildEnhancedClaudePrompt, buildThreeCardReading } from '../functions/lib/narrativeBuilder.js';
import { analyzeThreeCard } from '../functions/lib/spreadAnalysis.js';
import { generateWithClaudeApi, generateWithModalQwen, generateWithOpenAIResponses } from '../functions/lib/narrativeBackends.js';
import { truncateUserPromptSafely } from '../functions/lib/narrative/prompts/truncation.js';
import { parseUserContext } from '../functions/lib/narrative/prompts/userContext.js';

const hierophant = { card: 'The Hierophant', number: 5, orientation: 'Upright', meaning: 'Tradition and learning.' };

test('the reviewed Hierophant symbol projection keeps keys at the feet', () => {
  const keys = getKeySymbols(hierophant, 'rws-1909').symbols.find(symbol => symbol.object === 'crossed keys');
  assert.equal(keys.position, 'at feet');
});

test('a custom role for another card keeps its existing prose instead of acquiring unrelated symbol context', () => {
  const text = buildPositionCardText({ card: 'The Sun', number: 19, orientation: 'Upright', meaning: 'Clarity.' }, 'Custom focus', { includeSymbols: true, deckStyle: 'rws-1909' });
  assert.match(text, /Custom focus: The Sun Upright/);
  assert.doesNotMatch(text, /Archetype:|Key symbols:/);
});

for (const position of ['Present', 'Bond', 'Other — Future Ltd.']) {
  test(`the enabled symbol context retains the keys relation in ${position}`, () => {
    const text = buildPositionCardText({ ...hierophant, position }, position, { includeSymbols: true, deckStyle: 'rws-1909' });
    assert.match(text, /crossed keys[^\n]*at feet/);
    assert.ok(text.includes(position));
  });
}

test('the production Claude request renders validated facts before returning its reading', async () => {
  const raw = JSON.stringify({ format: 'card-scenes-v1', blocks: [
    { type: 'prose', text: '### The Hierophant\n\nA practice can support learning.' },
    { type: 'fact', id: 'rws-hierophant-keys-at-feet', language: 'en' }
  ] });
  const payload = { cardsInfo: [{ ...hierophant, position: 'Focus' }],
    analysis: { spreadKey: 'single', themes: {} }, spreadInfo: { key: 'single', name: 'One-Card Insight' },
    deckStyle: 'rws-1909', userQuestion: 'What can a practice offer?' };
  const result = await generateWithClaudeApi({ GRAPHRAG_ENABLED: 'false' }, payload, 'fact-contract-test', {
    send: async () => ({ text: raw, model: 'claude-opus-5-5', usage: { input_tokens: 10, output_tokens: 10 } })
  });
  assert.equal(result.rawReading, raw);
  assert.match(result.reading, /the crossed keys are at the Hierophant's feet/);
  assert.doesNotMatch(result.reading, /card-scenes-v1|"blocks"|rws-hierophant-keys/);
});

test('rendering uses the actual resolved deck when it is supplied through spread metadata', async () => {
  const raw = JSON.stringify({ format: 'card-scenes-v1', blocks: [
    { type: 'prose', text: '### Art\n\nIntegration can be considered symbolically.' },
    { type: 'fact', id: 'thoth-art-motif-on-cauldron', language: 'en' }
  ] });
  const result = await generateWithClaudeApi({ GRAPHRAG_ENABLED: 'false' }, {
    cardsInfo: [{ card: 'Art', number: 14, position: 'Focus', orientation: 'Upright', meaning: 'Integration.' }],
    analysis: { spreadKey: 'single', themes: {} }, spreadInfo: { key: 'single', name: 'One-Card Insight', deckStyle: 'thoth-a1' },
    userQuestion: 'What can integration offer?'
  }, 'resolved-deck-test', { send: async () => ({ text: raw, model: 'claude-opus-5-5', usage: {} }) });
  assert.equal(result.promptMeta.deckStyle, 'thoth-a1');
  assert.match(result.reading, /motif is depicted on the cauldron/);
});

test('an embellished fact fails in the actual backend before a reading is returned', async () => {
  const payload = { cardsInfo: [{ ...hierophant, position: 'Focus' }],
    analysis: { spreadKey: 'single', themes: {} }, spreadInfo: { key: 'single', name: 'One-Card Insight' },
    deckStyle: 'rws-1909', userQuestion: 'What can a practice offer?' };
  await assert.rejects(generateWithClaudeApi({ GRAPHRAG_ENABLED: 'false' }, payload, 'invalid-fact-contract-test', {
    send: async () => ({ text: JSON.stringify({ format: 'card-scenes-v1', blocks: [
      { type: 'prose', text: '### The Hierophant\n\nA practice can support learning.' },
      { type: 'fact', id: 'rws-hierophant-keys-at-feet', language: 'en', text: 'He holds crossed keys.' }
    ] }), model: 'claude-opus-5-5', usage: {} })
  }), { code: 'invalid_card_fact_reference' });
});

test('a supplied Future card offers a prospective lens without inferring a current course', () => {
  const cardsInfo = ['Death', 'Art', 'The Star'].map((card, index) => ({
    card, number: [13, 14, 17][index], position: ['Past', 'Present', 'Future'][index], orientation: 'Upright',
    meaning: ['Transformation.', 'Integration.', 'Hope.'][index]
  }));
  const built = buildEnhancedClaudePrompt({ spreadInfo: { key: 'threeCard', name: 'Three-Card Story' },
    cardsInfo, spreadAnalysis: analyzeThreeCard(cardsInfo), themes: {},
    userQuestion: 'How does alchemical integration transform an ending into renewal?',
    deckStyle: 'thoth-a1', promptBudgetEnv: { GRAPHRAG_ENABLED: 'false' }
  });
  assert.match(built.userPrompt, /prospective symbolic lens/);
  assert.doesNotMatch(built.userPrompt, /If things continue as they are|most likely trajectory|trajectory if nothing shifts|likely trajectory for/);
  assert.ok(built.userPrompt.includes('Future'));
  assert.match(buildPositionCardText(cardsInfo[2], 'Future', { deckStyle: 'thoth-a1' }), /prospective symbolic lens/);
});

for (const position of ['Future', 'Near Future — what lies before (Card 4)', 'Outcome — likely path if unchanged (Card 10)', 'Likely direction on current path']) {
  test(`${position} keeps its supplied label without stating a personal forecast`, () => {
    const text = buildPositionCardText({ card: 'The Star', number: 17, orientation: 'Upright', meaning: 'Hope.' }, position, { deckStyle: 'rws-1909' });
    assert.ok(text.startsWith(position + ': '));
    const interpretation = text.slice(position.length + 2);
    assert.match(interpretation, /prospective symbolic lens/);
    assert.doesNotMatch(interpretation, /maintain your current course|forecast of trajectory|probable trajectory|where things may be heading|outcome this momentum is building|If things continue as they are/);
  });
}

test('the complete local three-card reading retains a prospective Future without current-momentum claims', async () => {
  const cardsInfo = ['Death', 'Art', 'The Star'].map((card, index) => ({ card, number: [13, 14, 17][index],
    position: ['Past', 'Present', 'Future'][index], orientation: 'Upright', meaning: ['Transformation.', 'Integration.', 'Hope.'][index] }));
  const reading = await buildThreeCardReading({ cardsInfo, threeCardAnalysis: analyzeThreeCard(cardsInfo), themes: {},
    context: 'general', deckStyle: 'thoth-a1', userQuestion: 'How does alchemical integration transform an ending into renewal?' });
  assert.match(reading, /Future/);
  assert.doesNotMatch(reading, /trajectory of current momentum|maintain your current course|forecast of trajectory/);
});

for (const [name, generate, env] of [
  ['Modal', generateWithModalQwen, { MODAL_PROXY_TOKEN: 'unit-test', MODAL_ENDPOINT_URL: 'https://example.modal.direct', MODAL_MODEL: 'Qwen/Qwen3.8-Max-VL-Thinking' }],
  ['OpenAI', generateWithOpenAIResponses, { OPENAI_API_KEY: 'unit-test', OPENAI_MODEL: 'gpt-5.1' }]
]) {
  test(`${name} returns the same validated caption surface as Claude`, async t => {
    const raw = JSON.stringify({ format: 'card-scenes-v1', blocks: [
      { type: 'prose', text: '### The Hierophant\n\nUne pratique peut soutenir l’apprentissage.' },
      { type: 'fact', id: 'rws-hierophant-keys-at-feet', language: 'fr' }
    ] });
    t.mock.method(globalThis, 'fetch', async () => Response.json(name === 'Modal' ? {
      id: 'chatcmpl-unit', object: 'chat.completion', model: env.MODAL_MODEL,
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: raw } }],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
    } : {
      id: 'resp_unit', object: 'response', status: 'completed', model: env.OPENAI_MODEL,
      output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: raw, annotations: [] }] }],
      usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 }
    }));
    const result = await generate({ ...env, GRAPHRAG_ENABLED: 'false' }, {
      cardsInfo: [{ ...hierophant, position: 'Focus' }], analysis: { spreadKey: 'single', themes: {} },
      spreadInfo: { key: 'single', name: 'One-Card Insight' }, deckStyle: 'rws-1909',
      userQuestion: 'Que peut apporter une pratique ?'
    }, `scene-${name}`);
    assert.equal(result.rawReading, raw);
    assert.match(result.reading, /les clés croisées sont aux pieds du Hiérophante/);
    assert.doesNotMatch(result.reading, /"blocks"|card-scenes-v1|rws-hierophant/);
  });
}

for (const budgetTarget of ['claude', 'openai', 'modal']) {
  test(`a fitted ${budgetTarget} prompt keeps the entire scene and reader contract or refuses it`, () => {
    const question = 'I am not quitting my job. For the 2027-02-12 joint project, how can I nurture creative art at home?';
    const cardsInfo = [
      { card: 'The Empress', number: 3, position: 'Self', orientation: 'Upright', meaning: 'Nurture.' },
      { card: 'The Emperor', number: 4, position: 'Other — Future Ltd.', orientation: 'Reversed', meaning: 'Reconsider structure.' },
      { ...hierophant, position: 'Bond' }
    ];
    const built = buildEnhancedClaudePrompt({ spreadInfo: { key: 'threeCard', name: 'Three-Card Reading' },
      cardsInfo, spreadAnalysis: analyzeThreeCard(cardsInfo), themes: {}, userQuestion: question,
      reflectionsText: 'I am still employed. '.repeat(100), deckStyle: 'rws-1909', budgetTarget,
      promptBudgetEnv: { GRAPHRAG_ENABLED: 'false' }
    });
    const protectedLines = built.userPrompt.split('\n').filter(line => /^- (?:SCENE OUTPUT CONTRACT:|SCENE FACTS)/.test(line));
    assert.equal(protectedLines.length, 2);
    let successful = 0;
    for (const budget of [500, 900, 1400, 2000]) {
      try {
        const fitted = truncateUserPromptSafely(built.userPrompt, budget, { spreadKey: 'threeCard' });
        assert.equal(parseUserContext(fitted.text).get('question'), question);
        for (const line of protectedLines) assert.ok(fitted.text.split('\n').includes(line));
        assert.match(fitted.text, /The Empress.*The Emperor.*The Hierophant/);
        successful += 1;
      } catch (error) {
        assert.equal(error.code, 'PROMPT_BUILD_BUDGET_EXCEEDED');
      }
    }
    assert.ok(successful > 0, 'The ordinary capped path must remain usable');
  });
}

test('a rejected completion stays recoverable without putting raw content in enumerable error data', async () => {
  const raw = '{"format":"card-scenes-v1","blocks":[';
  try {
    await generateWithClaudeApi({ GRAPHRAG_ENABLED: 'false' }, {
      cardsInfo: [{ ...hierophant, position: 'Focus' }], analysis: { spreadKey: 'single', themes: {} },
      spreadInfo: { key: 'single', name: 'One-Card Insight' }, deckStyle: 'rws-1909', userQuestion: 'What supports learning?'
    }, 'recover-scene', { send: async () => ({ text: raw, model: 'claude-opus-5-5', usage: {} }) });
    assert.fail('Invalid transport must fail closed');
  } catch (error) {
    assert.equal(error.code, 'invalid_card_fact_reference');
    assert.equal(error.unrenderedNarrative.rawReading, raw);
    assert.equal(Object.keys(error).includes('unrenderedNarrative'), false);
    assert.doesNotMatch(JSON.stringify(error), /card-scenes-v1|"blocks"/);
  }
});

for (const positions of [['Past', 'Present', 'Future'], ['Self', 'Other', 'Bond']]) {
  test(`the actual provider prompt exposes reviewed facts for ${positions.join('/')}`, () => {
    const cardsInfo = [
      { card: 'The Empress', number: 3, orientation: 'Upright', meaning: 'Nurture.' },
      { card: 'The Emperor', number: 4, orientation: 'Upright', meaning: 'Structure.' },
      hierophant
    ].map((card, index) => ({ ...card, position: positions[index] }));
    const built = buildEnhancedClaudePrompt({
      spreadInfo: { key: 'threeCard', name: 'Three-Card Story' }, cardsInfo,
      spreadAnalysis: analyzeThreeCard(cardsInfo), themes: {},
      userQuestion: 'I am not quitting my job. How can I nurture creative art at home?',
      deckStyle: 'rws-1909', promptBudgetEnv: { GRAPHRAG_ENABLED: 'false' }
    });
    assert.match(built.userPrompt, /crossed keys[^\n]*at feet/);
    assert.deepEqual(built.promptMeta.canonicalSceneFacts.providedIds, ['rws-hierophant-keys-at-feet']);
  });
}
