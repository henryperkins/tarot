import assert from 'node:assert/strict';
import { test } from 'node:test';
import { performSpreadAnalysis } from '../functions/lib/spreadAnalysisOrchestrator.js';
import { buildOpenAIResponsesPrompts } from '../functions/lib/narrativeBackends.js';
import { buildQualityRetrievalSummary, retrievePassagesWithQuality } from '../functions/lib/graphRAG.js';
import { collectGraphRAGAlerts } from '../functions/lib/graphRAGAlerts.js';
import { MAJOR_ARCANA_PASSAGES } from '../functions/lib/knowledgeBase.js';
import { resolveReadingCards } from '../functions/lib/readingCardResolution.js';
import { formatUsageSummary } from '../src/components/reading/complete/sourceUsageSummary.js';

const QUESTION = 'How can I stay open with someone I care about?';
const RELATIONSHIP = { key: 'relationship', name: 'Relationship Snapshot' };
const SINGLE = { key: 'single', name: 'One-Card Insight' };
const ENABLED = { GRAPHRAG_ENABLED: 'true' };
const draw = cards => resolveReadingCards(cards.map(([card, position, orientation = 'Upright']) => ({ card, position, orientation })), 'rws-1909');
// No triad, dyad, suit progression or court lineage.
const NO_PATTERN_CARDS = draw([['Nine of Cups', 'You'], ['Two of Cups', 'Them'], ['Knight of Swords', 'Connection', 'Reversed']]);

function quiet(t) {
  for (const method of ['log', 'warn', 'error']) t.mock.method(console, method, () => {});
}

const buildPrompts = (env, spreadInfo, cardsInfo, analysis) => buildOpenAIResponsesPrompts({ ...env }, { spreadInfo, cardsInfo, analysis, userQuestion: QUESTION }, 'orchestrator-test');

for (const [label, env] of [['keyword', ENABLED], ['semantic', { ...ENABLED, ENABLE_SEMANTIC_SCORING: 'true' }]]) {
  test(`a spread without patterns reports no_patterns_detected without retrieving (${label})`, async t => {
    quiet(t);
    const analysis = await performSpreadAnalysis(RELATIONSHIP, NO_PATTERN_CARDS, { userQuestion: QUESTION }, 'no-patterns', { ...env });
    const summary = analysis.graphRAGPayload.retrievalSummary;
    assert.equal(summary.reason, 'missing-graph-keys');
    assert.equal(summary.skippedReason, 'no_patterns_detected');
    assert.equal(Object.hasOwn(summary, 'candidatesDiscovered'), false, 'retrieval did not run');
    assert.equal(summary.semanticScoringFallbackReason, label === 'semantic' ? 'no-graph-patterns' : null);
    const graphKeys = analysis.themes.knowledgeGraph.graphKeys;
    assert.ok(graphKeys, 'the empty graph facts are kept');

    // Real retrieval over the same keys, as before this gate, for comparison.
    const passages = await retrievePassagesWithQuality(graphKeys, { userQuery: QUESTION, maxPassages: 3 });
    assert.equal(passages.length, 0);
    const retrieved = structuredClone(analysis);
    retrieved.graphRAGPayload = { passages, retrievalSummary: buildQualityRetrievalSummary(graphKeys, passages), maxPassages: 3, initialPassageCount: 0 };
    retrieved.themes.knowledgeGraph.graphRAGPayload = retrieved.graphRAGPayload;

    const built = buildPrompts(env, RELATIONSHIP, NO_PATTERN_CARDS, analysis);
    const control = buildPrompts(env, RELATIONSHIP, NO_PATTERN_CARDS, retrieved);
    assert.equal(built.systemPrompt, control.systemPrompt);
    assert.equal(built.userPrompt, control.userPrompt);

    const usage = built.promptMeta.sourceUsage.graphRAG;
    assert.deepEqual([usage.requested, usage.used, usage.skippedReason], [true, false, 'no_patterns_detected']);
    const alerts = collectGraphRAGAlerts(built.promptMeta);
    assert.ok(alerts.includes('GraphRAG: no patterns detected'), alerts.join(' | '));
    assert.ok(!alerts.some(alert => /retrieval|available/.test(alert)), alerts.join(' | '));
    const panel = formatUsageSummary(built.promptMeta.sourceUsage);
    assert.ok(!panel.rows.some(row => row.label === 'Traditional wisdom'));
    assert.equal(panel.summary.attention, 0);
  });
}

test('a failed knowledge-graph step reports retrieval_error instead of no patterns', async t => {
  quiet(t);
  // A registry read that throws stands in for any defect inside retrieval.
  const entry = MAJOR_ARCANA_PASSAGES[19];
  const descriptor = Object.getOwnPropertyDescriptor(entry, 'passages');
  Object.defineProperty(entry, 'passages', { configurable: true, get() { throw new Error('Synthetic registry failure'); } });
  t.after(() => Object.defineProperty(entry, 'passages', descriptor));

  const cardsInfo = draw([['The Sun', 'Theme']]);
  const analysis = await performSpreadAnalysis(SINGLE, cardsInfo, { userQuestion: QUESTION }, 'graph-failure', { ...ENABLED });
  assert.equal(analysis.themes.knowledgeGraph.graphKeys, null);
  const summary = analysis.graphRAGPayload.retrievalSummary;
  assert.deepEqual([summary.reason, summary.skippedReason], ['retrieval-error', 'retrieval_error']);

  const built = buildPrompts(ENABLED, SINGLE, cardsInfo, analysis);
  assert.deepEqual([built.promptMeta.sourceUsage.graphRAG.used, built.promptMeta.sourceUsage.graphRAG.skippedReason], [false, 'retrieval_error']);
  const alerts = collectGraphRAGAlerts(built.promptMeta);
  assert.ok(alerts.includes('GraphRAG: retrieval error'), alerts.join(' | '));
  assert.ok(!alerts.includes('GraphRAG: no patterns detected'));
  const row = formatUsageSummary(built.promptMeta.sourceUsage).rows.find(entry => entry.label === 'Traditional wisdom');
  assert.deepEqual([row.state, row.detail], ['omitted', 'Reference passages could not be loaded for this reading.']);
});

test('a failed theme analysis reports retrieval_error unless GraphRAG is disabled', async t => {
  quiet(t);
  const [resolved] = draw([['The Sun', 'Theme']]);
  const card = { ...resolved };
  Object.defineProperty(card, 'orientation', { enumerable: true, get() { throw new Error('Synthetic card failure'); } });
  for (const [env, expected] of [[ENABLED, 'retrieval_error'], [{ GRAPHRAG_ENABLED: 'false' }, 'disabled_by_env']]) {
    const analysis = await performSpreadAnalysis(SINGLE, [card], { userQuestion: QUESTION }, 'theme-failure', { ...env });
    assert.equal(analysis.graphRAGPayload.retrievalSummary.skippedReason, expected, env.GRAPHRAG_ENABLED);
  }
});
