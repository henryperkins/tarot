import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveReadingSensitiveContext, isPassageEligibleForSensitiveContext } from '../functions/lib/readingSensitiveContext.js';
import { prepareReadingContextSources } from '../functions/lib/readingContextSources.js';
import { resolveContextSelection } from '../functions/lib/contextDetection.js';
import { collectPassageCandidates } from '../functions/lib/graphRAGCandidates.js';
import { retrievePassages, retrievePassagesWithQuality, formatPassagesForPrompt } from '../functions/lib/graphRAG.js';
import { clearEmbeddingCache } from '../functions/lib/embeddings.js';
import { buildGraphContext } from '../functions/lib/graphContext.js';
import { runNarrativeBackend } from '../functions/lib/narrativeBackends.js';
import { resolveReadingCards } from '../functions/lib/readingCardResolution.js';
import { performSpreadAnalysis } from '../functions/lib/spreadAnalysisOrchestrator.js';
import { claudeSseResponse, CLAUDE_API_URL_PREFIX } from './helpers/claudeSse.mjs';
import { modelReadingForRequest } from './helpers/canonicalScenes.mjs';

const keys = { dyadPairs: [{ cards: [15, 6], significance: 'high' }], completeTriadIds: ['devil-tower-sun'] };
const birthday = 'How can I seek support for my guilt about missing a birthday?';
const recovery = 'How can I seek support for my addiction recovery?';

function resolve(userQuestion, other = {}) {
  const sources = prepareReadingContextSources({ userQuestion, ...other });
  const contextSelection = resolveContextSelection({ sources }, 'threeCard');
  return resolveReadingSensitiveContext({ sources, contextSelection });
}

test('only an explicit current first-person addiction or sobriety subject admits either specialized variant', () => {
  for (const question of [recovery, 'How can I seek support for my addiction?', 'I’m in recovery from alcohol addiction.',
    'What helps with my recovery from addiction?', 'How can I support my sobriety?', 'I have a substance use disorder.',
    'I have no support for my addiction.', 'How can I avoid relapsing into my addiction?',
    'I’m in recovery from alcohol addiction. How can I find support for this?',
    'I struggle with addiction. What should I reflect on?', 'I am recovering from addiction. How can I stay on track in my recovery?']) {
    assert.equal(resolve(question).addiction, 'self', question);
  }
  for (const question of [birthday, 'How can I seek support for my brother who is struggling with addiction?',
    'I am worried this might be an addiction. How can I seek support?', 'What if I have an addiction?',
    'How can I support my recovery after surgery?', 'I do not have an addiction.', 'How can I support my addiction counselor?',
    'How can I support my brother’s recovery?', 'How can I share my addiction research project?',
    'How can I support my addiction recovery group for caregivers?', 'I used to struggle with addiction. How can I help my brother with his sobriety?',
    'My brother says: “I am in recovery from addiction.” What can I say to him?', 'I am addicted to this TV show.',
    'How can I stay sober tonight as the designated driver?',
    'I’m in recovery from alcohol addiction. How can I prepare for my violin audition?',
    'I am recovering from addiction, but my question is about my job interview.',
    'I am in recovery from alcohol addiction. How can I support my recovery after surgery?']) {
    assert.notEqual(resolve(question).addiction, 'self', question);
  }
  for (const question of ['Please do not frame this as addiction.', 'Without addiction framing, how can I proceed?',
    'My brother has an addiction. Please don’t frame this as addiction.',
    'I have an addiction. Please do not use a recovery frame.', 'I have an addiction. No recovery advice please.']) {
    assert.equal(resolve(question).addiction, 'excluded', question);
  }
});

test('only current relevant reader reflections can establish support, including a card note', () => {
  const reflectionsText = 'I’m in recovery from alcohol addiction.';
  assert.equal(resolve('Any guidance?', { reflectionsText }).addiction, 'self');
  assert.equal(resolve('', { cardsInfo: [{ userReflection: reflectionsText }] }).addiction, 'self');
  assert.equal(resolve('How can I stay on track in my recovery?', { reflectionsText }).addiction, 'self');
  for (const question of [birthday, 'How can I support my recovery after surgery?', 'How can I get ready for my violin audition?',
    'How can I support my brother who is in recovery from addiction?', 'Please do not frame this as addiction.']) {
    assert.notEqual(resolve(question, { reflectionsText }).addiction, 'self', question);
  }
  assert.equal(resolve(recovery, { cardsInfo: [{ userReflection: 'Please do not frame this as addiction.' }] }).addiction, 'excluded');
  assert.notEqual(resolve('', { cardsInfo: [{ card: 'The Devil', meaning: reflectionsText }], focusAreas: [reflectionsText] }).addiction, 'self');
  assert.notEqual(resolveReadingSensitiveContext({ sources: [{ id: 'pathA', kind: 'decisionPath', text: reflectionsText }] }).addiction, 'self');
});

test('the applicability gate precedes projection, scoring, quality bypass, and the weak fallback', async t => {
  clearEmbeddingCache();
  t.after(clearEmbeddingCache);
  const denied = resolve(birthday);
  const allowed = resolve(recovery);
  const all = collectPassageCandidates(keys, { sensitiveContext: allowed });
  const specialized = all.filter(row => row.context === 'addiction');
  assert.deepEqual(specialized.map(row => row.type).sort(), ['dyad', 'triad']);
  assert.ok(specialized.every(row => !isPassageEligibleForSensitiveContext(row, undefined)));
  const restricted = collectPassageCandidates(keys, { sensitiveContext: denied });
  assert.equal(restricted.retrievalStats.sensitiveContextRejected, 2);
  assert.ok(!restricted.some(row => row.context === 'addiction'));
  const seen = [];
  const ai = { run: async (_model, { text }) => {
    seen.push(...text);
    return { data: text.map(() => [1, 0]) };
  } };
  for (const config of [{}, { DISABLE_QUALITY_FILTERING: 'true' }]) {
    const options = { env: { ...config, AI: ai }, questionContext: 'shadow', userQuery: birthday, sensitiveContext: denied,
      enableSemanticScoring: true, minRelevanceScore: 1.1 };
    const sync = retrievePassages(keys, options);
    const asyncRows = await retrievePassagesWithQuality(keys, options);
    for (const rows of [sync, asyncRows]) {
      assert.ok(rows.length);
      assert.equal(rows.retrievalStats.sensitiveContextRejected, 2);
      assert.ok(!rows.some(row => row.context === 'addiction'));
    }
  }
  assert.ok(seen.length > 1);
  assert.ok(specialized.every(row => !seen.includes(row.promptText)), 'ineligible rows never enter the embedding request');
});

test('explicit first-person support competes under health and prefetched input is checked again after registry projection', async () => {
  const sensitiveContext = resolve(recovery);
  const options = { questionContext: 'health', userQuery: recovery, sensitiveContext, enableSemanticScoring: false };
  const graph = { dyadPairs: keys.dyadPairs };
  for (const rows of [retrievePassages(graph, options), await retrievePassagesWithQuality(graph, options)]) {
    const passage = rows.find(row => row.context === 'addiction');
    assert.ok(passage);
    assert.match(formatPassagesForPrompt([passage], { sensitiveContext }), /what feels restrictive/u);
    assert.equal(formatPassagesForPrompt([passage]), '');
    assert.equal(formatPassagesForPrompt([{ ...passage, context: 'general' }], { sensitiveContext: resolve(birthday) }), '');
  }
});

test('the independent Devil and Lovers graph highlight invites reflection on a possibility', () => {
  const graph = buildGraphContext([{ card: 'The Devil', number: 15 }, { card: 'The Lovers', number: 6 }]);
  const dyad = graph.narrativeHighlights.find(highlight => highlight.type === 'high-dyad');
  assert.match(dyad.text, /consider whether an attachment/iu);
  assert.doesNotMatch(dyad.text, /your attachment patterns are affecting|addiction/iu);
});

test('all provider requests recheck sensitive passages against the current reader context', async t => {
  const env = {
    GRAPHRAG_ENABLED: 'true', OPENAI_API_KEY: 'offline', OPENAI_BASE_URL: 'https://openai.invalid',
    ANTHROPIC_API_KEY: 'offline', MODAL_PROXY_TOKEN: 'offline', MODAL_ENDPOINT_URL: 'https://modal.invalid',
    MODAL_STREAM: 'false'
  };
  const spreadInfo = { key: 'threeCard', name: 'Three-Card Story' };
  const cardsInfo = resolveReadingCards(['The Devil', 'The Lovers', 'Four of Cups'].map((card, index) => ({
    card, position: ['Past', 'Present', 'Future'][index], orientation: 'Upright'
  })));
  const prepare = async userQuestion => {
    const contextSelection = resolveContextSelection({ userQuestion, cardsInfo }, spreadInfo.key);
    const analysis = await performSpreadAnalysis(spreadInfo, cardsInfo, {
      userQuestion, contextSelection, subscriptionTier: 'plus', enableSemanticScoring: false
    }, 'offline-sensitive-handoff', env);
    return { userQuestion, cardsInfo, spreadInfo, analysis, contextSelection, subscriptionTier: 'plus', deckStyle: 'rws-1909' };
  };

  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
  t.mock.method(globalThis, 'fetch', () => assert.fail('analysis and local composition must remain offline'));
  const affirmative = await prepare(recovery);
  const unrelated = await prepare('Why do I feel so much guilt about wanting more for myself?');
  const recoveryPassage = affirmative.analysis.graphRAGPayload.passages.find(row => row.context === 'addiction');
  assert.ok(recoveryPassage, 'explicit recovery produces the specialized passage');
  assert.ok(!unrelated.analysis.graphRAGPayload.passages.some(row => row.context === 'addiction'));
  const stale = structuredClone(unrelated);
  stale.analysis.graphRAGPayload = affirmative.analysis.graphRAGPayload;
  const cases = [
    { name: 'explicit recovery', payload: affirmative, visible: true },
    { name: 'unrelated guilt', payload: unrelated, visible: false },
    { name: 'stale recovery reference', payload: stale, visible: false }
  ];

  for (const scenario of cases) {
    for (const provider of ['openai-native', 'claude-api', 'modal-qwen']) {
      await t.test(`${scenario.name} / ${provider}`, async subtest => {
        let captured;
        subtest.mock.method(globalThis, 'fetch', async (url, options) => {
          const body = JSON.parse(options.body);
          const reading = modelReadingForRequest(body, 'A synthetic reading.');
          if (provider === 'claude-api') {
            assert.ok(String(url).startsWith(CLAUDE_API_URL_PREFIX));
            captured = { system: body.system, user: body.messages[0].content };
            return claudeSseResponse(reading);
          }
          if (provider === 'openai-native') {
            assert.equal(new URL(url).hostname, 'openai.invalid');
            captured = { system: body.instructions, user: body.input };
            return Response.json({ model: 'offline', output_text: reading });
          }
          assert.equal(new URL(url).hostname, 'modal.invalid');
          captured = {
            system: body.messages.find(message => message.role === 'system').content,
            user: body.messages.find(message => message.role === 'user').content
          };
          return Response.json({ model: 'offline', choices: [{ message: { content: reading }, finish_reason: 'stop' }] });
        });
        const result = await runNarrativeBackend(provider, env, structuredClone(scenario.payload), 'offline-sensitive-handoff');
        assert.ok(captured.user.includes(scenario.payload.userQuestion));
        assert.equal(captured.user.includes(recoveryPassage.promptText), scenario.visible);
        assert.ok(!captured.system.includes(recoveryPassage.promptText));
        if (scenario.payload === stale) {
          assert.equal(result.promptMeta.graphRAG.includedInPrompt, false);
          assert.equal(result.promptMeta.graphRAG.passagesUsedInPrompt, 0);
          assert.equal(result.promptMeta.graphRAG.inapplicablePassageCount, 1);
        }
      });
    }
    const result = await runNarrativeBackend('local-composer', {
      ...env, LOCAL_COMPOSER_APPEND_GRAPHRAG_DEBUG: 'true'
    }, structuredClone(scenario.payload), 'offline-sensitive-handoff');
    assert.equal(result.reading.includes(recoveryPassage.promptText), scenario.visible);
  }
});
