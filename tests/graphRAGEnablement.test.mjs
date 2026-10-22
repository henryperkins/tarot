import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeSpreadThemes } from '../functions/lib/spreadAnalysis.js';
import { buildUserPrompt } from '../functions/lib/narrative/prompts/userPrompt.js';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js';
import { buildOpenAIResponsesPrompts } from '../functions/lib/narrativeBackends.js';

const spreadInfo = { key: 'threeCard', name: 'Three-Card Story' };
const cardsInfo = [
  { card: 'Death', number: 13, position: 'Past', orientation: 'Upright', meaning: 'Endings that clear space.' },
  { card: 'Temperance', number: 14, position: 'Present', orientation: 'Upright', meaning: 'Patient blending.' },
  { card: 'The Star', number: 17, position: 'Future', orientation: 'Upright', meaning: 'Renewed hope.' }
];
const question = 'What supports me today?';
const patternsHeader = '**Archetypal Patterns**';

function setProcessGraphFlags(t, flags = {}) {
  const names = ['GRAPHRAG_ENABLED', 'KNOWLEDGE_GRAPH_ENABLED'];
  const previous = names.map(name => process.env[name]);
  for (const name of names) {
    if (flags[name] === undefined) delete process.env[name];
    else process.env[name] = flags[name];
  }
  t.after(() => {
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
  });
}

const builders = {
  direct({ env, themes, cards = cardsInfo, deckStyle = 'rws-1909', spread = spreadInfo }) {
    return {
      userPrompt: buildUserPrompt(spread.key, cards, question, '', themes, null, 'general', [], deckStyle, { env })
    };
  },
  enhanced({ env, themes, cards = cardsInfo, deckStyle = 'rws-1909', spread = spreadInfo }) {
    return buildEnhancedClaudePrompt({
      spreadInfo: spread, cardsInfo: cards, userQuestion: question, reflectionsText: '',
      themes, deckStyle, promptBudgetEnv: env
    });
  }
};

// Catch unconditional reconstruction, reversed current/legacy precedence, and
// activation without an explicit opt-in at the final prompt boundary.
const flagCases = [
  { name: 'current disable flag', env: { GRAPHRAG_ENABLED: 'false' }, enabled: false },
  { name: 'legacy disable flag', env: { KNOWLEDGE_GRAPH_ENABLED: 'false' }, enabled: false },
  { name: 'current false overriding legacy true', env: { GRAPHRAG_ENABLED: 'false', KNOWLEDGE_GRAPH_ENABLED: 'true' }, enabled: false },
  { name: 'current true overriding legacy false', env: { GRAPHRAG_ENABLED: 'true', KNOWLEDGE_GRAPH_ENABLED: 'false' }, enabled: true },
  { name: 'current enable flag', env: { GRAPHRAG_ENABLED: 'true' }, enabled: true },
  { name: 'legacy enable flag', env: { KNOWLEDGE_GRAPH_ENABLED: 'true' }, enabled: true },
  { name: 'boolean false overriding legacy true', env: { GRAPHRAG_ENABLED: false, KNOWLEDGE_GRAPH_ENABLED: true }, enabled: false },
  { name: 'an environment with neither flag', env: {}, enabled: false },
  { name: 'no environment or process opt-in', env: null, enabled: false }
];

for (const [entrypoint, build] of Object.entries(builders)) {
  for (const { name, env, enabled } of flagCases) {
    test(`${entrypoint} prompt respects ${name}`, async t => {
      setProcessGraphFlags(t);
      const themes = await analyzeSpreadThemes(cardsInfo, { env, deckStyle: 'rws-1909' });
      assert.equal(Boolean(themes.knowledgeGraph), enabled, 'Upstream analysis establishes the flag state');

      const built = build({ env, themes });
      assert.equal(built.userPrompt.includes(patternsHeader), enabled);
      if (enabled) assert.match(built.userPrompt, /Healing Arc/);
      else assert.doesNotMatch(built.userPrompt, /TRADITIONAL WISDOM \(GraphRAG\)/);
      if (built.promptMeta) {
        assert.equal(built.promptMeta.sourceUsage.patterns.used, enabled);
        assert.equal(built.promptMeta.sourceUsage.patterns.patternsUsedInPrompt, enabled ? 4 : 0);
      }
    });
  }

  test(`${entrypoint} prompt uses the process flag when no environment is supplied`, t => {
    setProcessGraphFlags(t, { GRAPHRAG_ENABLED: 'true' });
    const built = build({ env: null, themes: { knowledgeGraph: null } });
    assert.match(built.userPrompt, /Archetypal Patterns/);
    assert.match(built.userPrompt, /Healing Arc/);
  });

  for (const [flag, env] of Object.entries({
    current: { GRAPHRAG_ENABLED: 'false' },
    legacy: { KNOWLEDGE_GRAPH_ENABLED: 'false' }
  })) {
    test(`${entrypoint} prompt drops supplied highlights when the ${flag} flag is disabled`, () => {
      const themes = { knowledgeGraph: { narrativeHighlights: [{ text: 'STALE-HIGHLIGHT from an earlier spread.' }] } };
      const built = build({ env, themes });
      assert.doesNotMatch(built.userPrompt, /STALE-HIGHLIGHT|Archetypal Patterns/);
      assert.equal(themes.knowledgeGraph.narrativeHighlights[0].text, 'STALE-HIGHLIGHT from an earlier spread.');
    });
  }

  for (const { deckStyle, cardLabel } of [
    { deckStyle: 'rws-1909', cardLabel: '**Temperance**' },
    { deckStyle: 'thoth-a1', cardLabel: '**Art (RWS: Temperance)**' },
    { deckStyle: 'marseille-classic', cardLabel: '**Temperance**' }
  ]) {
    test(`${entrypoint} enabled prompt rebuilds ${deckStyle} highlights from the actual cards`, () => {
      const themes = { knowledgeGraph: { narrativeHighlights: [{ text: 'STALE-HIGHLIGHT Death, Temperance, and The Star form a complete arc.' }] } };
      const built = build({
        env: { GRAPHRAG_ENABLED: 'true' }, themes, deckStyle,
        cards: [{ ...cardsInfo[1], position: 'Theme' }], spread: { key: 'single', name: 'One-Card Insight' }
      });
      const patterns = built.userPrompt.split(patternsHeader)[1]?.split('\n\n')[0];
      assert.ok(patterns?.includes(cardLabel));
      assert.doesNotMatch(patterns, /STALE-HIGHLIGHT|Death|The Star|complete arc/);
      assert.match(themes.knowledgeGraph.narrativeHighlights[0].text, /STALE-HIGHLIGHT/);
      if (built.promptMeta) assert.equal(built.promptMeta.sourceUsage.patterns.patternsUsedInPrompt, 1);
    });
  }
}

for (const flag of ['GRAPHRAG_ENABLED', 'KNOWLEDGE_GRAPH_ENABLED']) {
  test(`OpenAI final prompt keeps ${flag}=false through budget rebuilding`, async t => {
    t.mock.method(console, 'log', () => {});
    const env = { [flag]: 'false', ENABLE_PROMPT_SLIMMING: 'true', PROMPT_BUDGET_OPENAI: '1000' };
    const themes = await analyzeSpreadThemes(cardsInfo, { env, deckStyle: 'rws-1909' });
    assert.equal(themes.knowledgeGraph, null);
    const built = buildOpenAIResponsesPrompts(env, {
      spreadInfo, cardsInfo, userQuestion: question, deckStyle: 'rws-1909',
      analysis: { themes, spreadAnalysis: null }
    }, 'graph-disable-test');

    assert.ok(built.promptMeta.slimmingSteps.length > 0, 'Exercise repeated prompt assembly');
    assert.doesNotMatch(built.userPrompt, /Archetypal Patterns|TRADITIONAL WISDOM \(GraphRAG\)/);
    assert.equal(built.promptMeta.sourceUsage.patterns.used, false);
    assert.equal(built.promptMeta.sourceUsage.patterns.patternsUsedInPrompt, 0);
    assert.equal(built.promptMeta.sourceUsage.graphRAG.used, false);
  });
}
