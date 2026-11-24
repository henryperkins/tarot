import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAJOR_ARCANA } from '../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../src/data/minorArcana.js';
import { ARCHETYPAL_DYADS } from '../src/data/knowledgeGraphData.js';
import { buildReadingRequestCard } from '../shared/contracts/readingRequestCards.js';
import { getDeckAlias } from '../shared/vision/deckAssets.js';
import { resolveReadingCards } from '../functions/lib/readingCardResolution.js';
import { resolveContextSelection } from '../functions/lib/contextDetection.js';
import { buildPositionCardText } from '../functions/lib/narrative/helpers.js';
import { buildEnhancedClaudePrompt, shouldIncludeAstroInsights } from '../functions/lib/narrative/prompts.js';
import { buildGraphContext } from '../functions/lib/graphContext.js';
import { detectArchetypalDyads, getPriorityPatternNarratives } from '../functions/lib/knowledgeGraph.js';
import { collectPassageCandidates, scoreKeywordRelevance } from '../functions/lib/graphRAGCandidates.js';
import { formatPassagesForPrompt, retrievePassagesWithQuality } from '../functions/lib/graphRAG.js';
import { collectGraphRAGAlerts } from '../functions/lib/graphRAGAlerts.js';
import { getPassagesForPattern } from '../functions/lib/knowledgeBase.js';
import { runNarrativeBackend } from '../functions/lib/narrativeBackends.js';
import { detectForecastTimeframe, performSpreadAnalysis } from '../functions/lib/spreadAnalysisOrchestrator.js';

const catalog = [...MAJOR_ARCANA, ...MINOR_ARCANA];
const decks = ['rws-1909', 'thoth-a1', 'marseille-classic'];
const env = { GRAPHRAG_ENABLED: 'true' };
const single = { key: 'single', name: 'Single Card' };
const threeCard = { key: 'threeCard', name: 'Three-Card Story' };

function draw(names, { deckStyle = 'rws-1909', reversals = [], positions = [] } = {}) {
  return resolveReadingCards(names.map((name, index) => buildReadingRequestCard(
    catalog.find(card => card.name === name),
    { deckStyle, position: positions[index] || 'Present', isReversed: Boolean(reversals[index]) }
  )), deckStyle);
}

test('the card line uses the same deck label as the draw for all 78 cards', () => {
  for (const deckStyle of decks) {
    for (const card of catalog) {
      const [resolved] = draw([card.name], { deckStyle, positions: ['Custom position'] });
      const line = buildPositionCardText(resolved, resolved.position, { deckStyle });
      assert.ok(line.startsWith('Custom position: ' + resolved.card + ' Upright.'), deckStyle + ' ' + line);
      assert.doesNotMatch(line, /\(RWS:[^)]*\(RWS:/);
      assert.equal(getDeckAlias(resolved, deckStyle), resolved.card);
      if (deckStyle === 'marseille-classic') {
        assert.equal(getDeckAlias({ ...card, name: resolved.card }, deckStyle), resolved.card);
      }
    }
  }
});

test('the current subject makes recovery and trauma references eligible independently', () => {
  const graphKeys = { completeTriadIds: ['tower-star-moon'], dyadPairs: [{ cards: [15, 6], significance: 'high' }] };
  for (const [question, allowed] of [
    ['Why do I feel so much guilt about wanting more for myself?', []],
    ['Please do not frame this as trauma. What might help with guilt?', []],
    ['How can I support my addiction recovery?', ['addiction']],
    ['How can I reflect on the trauma I experienced?', ['trauma']]
  ]) {
    const { sensitiveContext } = resolveContextSelection({ userQuestion: question });
    const contexts = collectPassageCandidates(graphKeys, { sensitiveContext }).map(row => row.context);
    assert.deepEqual(contexts.filter(context => ['addiction', 'trauma'].includes(context)), allowed, question);
  }
});

test('every dyad offers a symbolic possibility and identifies reversed members', () => {
  for (const dyad of ARCHETYPAL_DYADS) {
    for (const reversals of [[false, false], [false, true], [true, false], [true, true]]) {
      const cardsInfo = draw(dyad.cards.map(number => MAJOR_ARCANA.find(card => card.number === number).name), { reversals });
      const detected = detectArchetypalDyads(cardsInfo)[0];
      assert.doesNotMatch(detected.narrative, /\b(?:you|your|you’re|you've|yourself)\b/i, dyad.theme);
      if (detected.significance === 'medium') continue;
      const [highlight] = getPriorityPatternNarratives({ dyads: [detected] });
      assert.match(highlight.text, /possible shared theme/i);
      assert.equal((highlight.text.match(/\(reversed\)/gi) || []).length, reversals.filter(Boolean).length);
    }
  }
});

test('the provider receives pattern highlights inside a data boundary', () => {
  const cardsInfo = draw(['The Chariot', 'The World', 'Four of Cups'], {
    reversals: [true, true], positions: ['Past', 'Present', 'Future']
  });
  const { userPrompt } = buildEnhancedClaudePrompt({
    spreadInfo: threeCard, cardsInfo, userQuestion: 'Why does my project keep stalling?', promptBudgetEnv: env
  });
  const highlights = userPrompt.match(/<pattern_highlights>\s*([\s\S]*?)\s*<\/pattern_highlights>/)?.[1];
  assert.ok(highlights, 'the highlights must have a closed data boundary');
  assert.match(highlights, /The Chariot \(reversed\) \+ The World \(reversed\)/i);
  assert.doesNotMatch(highlights, /is leading to complete achievement/i);
});

test('individual highlights have no shared theme label and suit highlights use drawn orientations once', () => {
  const { narrativeHighlights: journey } = buildGraphContext(draw(['The Hermit']));
  assert.doesNotMatch(journey[0].text, /shared theme/i);
  const { narrativeHighlights: suit } = buildGraphContext(draw(['Five of Pentacles', 'Six of Pentacles'], { reversals: [true] }));
  const highlight = suit.find(row => row.type === 'emerging-suit-progression').text;
  assert.match(highlight, /Five of Pentacles \(Reversed\):.*support available/i);
  assert.doesNotMatch(highlight, /Material\/spiritual poverty|shared theme: Possible themes/i);
  assert.equal((highlight.match(/Apply the drawn positions and orientations/gi) || []).length, 1);
});

test('astrology and forecast cues require explicit words and a forward-looking timeframe', () => {
  for (const question of [
    'Should I resign from my design job before the weekend?',
    'Should I leave my drafting job before Friday?',
    'I was laid off last month. How can I keep paying rent?',
    'I was laid off this week. How can I keep paying rent?',
    'What could I have done differently this week?',
    'How should I prepare for a busy season at work?'
  ]) {
    assert.equal(shouldIncludeAstroInsights([], {}, question), false, question);
    assert.equal(detectForecastTimeframe(question), null, question);
  }
  assert.equal(shouldIncludeAstroInsights([], {}, 'How might this lunar eclipse inform my reflection?'), true);
  assert.equal(detectForecastTimeframe('What should I consider over the next few days?'), 14);
  assert.equal(detectForecastTimeframe('What should I consider within two weeks?'), 14);
  assert.equal(detectForecastTimeframe('What should I focus on this week?'), 14);
  assert.equal(detectForecastTimeframe('What do the transits suggest for the coming month?'), 30);
  assert.equal(detectForecastTimeframe('How can I prepare for a change in 30 days?'), 30);
  assert.equal(detectForecastTimeframe('How can I prepare for the next few months?'), 90);
  assert.equal(detectForecastTimeframe('What spiritual practice should I commit to this season?'), 90);
});

test('a reversed Major gets its reversed image reading without the upright sensory metaphor', () => {
  const build = reversals => buildEnhancedClaudePrompt({
    spreadInfo: single, cardsInfo: draw(['The Star'], { reversals, positions: ['Theme / Guidance of the Moment'] }),
    userQuestion: 'What might I reflect on?',
    promptBudgetEnv: env
  }).userPrompt;
  assert.match(build([]), /\*Metaphor: Luminous hope/i);
  assert.match(build([true]), /The water hesitates/i);
  assert.doesNotMatch(build([true]), /\*Metaphor: Luminous hope/i);
});

test('complete suit stages and court alliances use the authored reference prose', () => {
  for (const [names, type, patternId] of [
    [['Ace of Wands', 'Two of Wands', 'Three of Wands'], 'suit-progression', 'Wands:beginning'],
    [['Page of Cups', 'Queen of Cups'], 'court-lineage', 'Cups:alliance'],
    [['Page of Cups', 'Knight of Cups', 'Queen of Cups', 'King of Cups'], 'court-lineage', 'Cups:council']
  ]) {
    const graph = buildGraphContext(draw(names));
    const passage = collectPassageCandidates(graph.graphKeys).find(row => row.patternId === patternId);
    assert.ok(passage);
    assert.equal(passage.isPartialPattern, false);
    assert.equal(passage.promptText, getPassagesForPattern(type, patternId).passages[0].text);
  }
});

test('a partial suit reference that repeats a selected highlight uses no passage slot', async () => {
  const graph = buildGraphContext(draw(['Five of Pentacles', 'Six of Pentacles', 'The Star']));
  const passages = await retrievePassagesWithQuality(graph.graphKeys, {
    enableSemanticScoring: false, narrativeHighlights: graph.narrativeHighlights, maxPassages: 5
  });
  assert.ok(passages.some(row => row.type === 'major-arcana'));
  assert.ok(!passages.some(row => row.type === 'suit-progression'));
});

test('generic words cannot qualify references and relevant content survives keyword fallback', async t => {
  assert.equal(scoreKeywordRelevance('Stay open to surprise and lead with patience.', 'Stay in design or become team lead?'), 0);
  const graphKeys = { majorNumbers: [0, 8], totalMajors: 2 };
  const ai = { run: async () => { throw new Error('Embeddings unavailable'); } };
  t.mock.method(console, 'warn', () => {});
  const options = { enableSemanticScoring: true, env: { AI: ai }, maxPassages: 2 };
  const select = userQuery => retrievePassagesWithQuality(graphKeys, { ...options, userQuery });
  assert.deepEqual([...await select('Stay in design or become team lead?')], []);
  const selected = await select('courage boundaries internship portfolio logistics');
  assert.ok(selected.some(row => row.patternId === '8' && !row.belowRelevanceThreshold));
});

test('Thoth card lines omit Golden Dawn path text while RWS keeps it', () => {
  for (const name of ['The Emperor', 'The Star']) {
    const line = deckStyle => buildPositionCardText(
      draw([name], { deckStyle })[0], 'Present — where you stand now', { deckStyle, context: 'general' }
    );
    assert.match(line('rws-1909'), /Path (?:Heh|Tzaddi)/);
    assert.doesNotMatch(line('thoth-a1'), /Path (?:Heh|Tzaddi)/);
  }
});

test('passage display uses its actual source and keeps editorial metadata out of text', () => {
  const [passage] = collectPassageCandidates({ totalMajors: 1, singleMajorNumber: 17 });
  const text = formatPassagesForPrompt([passage], { markdown: true });
  assert.match(text, /Tableu Tarot Canon references/i);
  assert.doesNotMatch(text, /wisdom from tarot tradition|projection version|editorial status/i);
  assert.ok(passage.projectionVersion);
});

test('the Three-Card fallback gives guidance without revealing the position weight', async () => {
  const cardsInfo = draw(['The Chariot', 'The Star', 'The World'], { positions: ['Past', 'Present', 'Future'] });
  const userQuestion = 'What should I consider about my project?';
  const analysis = await performSpreadAnalysis(threeCard, cardsInfo, { userQuestion }, 'prompt-audit', env);
  const { reading } = await runNarrativeBackend('local-composer', env, { spreadInfo: threeCard, cardsInfo, userQuestion, analysis }, 'prompt-audit');
  assert.match(reading, /The Future position offers The World/);
  assert.doesNotMatch(reading, /\bweight (?:of )?\d\.\d+/i);
});

test('an embedding fallback warning requires a scoring attempt', () => {
  const graphRAG = { semanticScoringRequested: true, semanticScoringFallback: true, semanticScoringFallbackReason: 'no-graph-patterns' };
  assert.ok(!collectGraphRAGAlerts({ graphRAG }).some(alert => /fell back/.test(alert)));
  assert.ok(collectGraphRAGAlerts({ graphRAG: { ...graphRAG, semanticScoringAttempted: true,
    semanticScoringFallbackReason: 'embeddings-failed' } }).some(alert => /fell back/.test(alert)));
});
