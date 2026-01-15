#!/usr/bin/env node
import { MAJOR_ARCANA } from '../../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../../src/data/minorArcana.js';
import { SPREADS } from '../../src/data/spreads.js';
import {
  analyzeSpreadThemes,
  analyzeThreeCard
} from '../../functions/lib/spreadAnalysis.js';
import { buildEnhancedClaudePrompt } from '../../functions/lib/narrativeBuilder.js';

const CARD_LOOKUP = new Map([
  ...MAJOR_ARCANA.map((card) => [card.name, card]),
  ...MINOR_ARCANA.map((card) => [card.name, card])
]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeOrientation(value) {
  return String(value || 'Upright').toLowerCase() === 'reversed' ? 'Reversed' : 'Upright';
}

function getCardByName(name) {
  const card = CARD_LOOKUP.get(name);
  if (!card) {
    throw new Error(`Unknown card name: ${name}`);
  }
  return card;
}

function buildCardEntry(baseCard, position, orientation) {
  const isReversed = orientation === 'Reversed';
  return {
    position,
    card: baseCard.name,
    orientation,
    meaning: isReversed ? baseCard.reversed : baseCard.upright,
    number: typeof baseCard.number === 'number' ? baseCard.number : undefined,
    suit: baseCard.suit || null,
    rank: baseCard.rank || null,
    rankValue: typeof baseCard.rankValue === 'number' ? baseCard.rankValue : null
  };
}

async function buildPromptSample({ promptBudgetEnv = null } = {}) {
  const sample = {
    spreadKey: 'threeCard',
    userQuestion: 'How can I honor the tension between nostalgia and reinvention?',
    reflectionsText: 'I feel pulled between my roots and the unknown ahead.',
    cards: [
      { name: 'Six of Cups', orientation: 'Reversed' },
      { name: 'The Tower', orientation: 'Upright' },
      { name: 'The Star', orientation: 'Upright' }
    ]
  };

  const spreadInfo = SPREADS[sample.spreadKey];
  const cardsInfo = sample.cards.map((cardDef, index) => {
    const position = spreadInfo.positions[index] || `Position ${index + 1}`;
    const orientation = normalizeOrientation(cardDef.orientation);
    const baseCard = getCardByName(cardDef.name);
    return buildCardEntry(baseCard, position, orientation);
  });

  const themes = await analyzeSpreadThemes(cardsInfo, {
    userQuestion: sample.userQuestion,
    deckStyle: 'rws-1909',
    enableKnowledgeGraph: false
  });
  themes.knowledgeGraph = { graphKeys: { stub: true }, narrativeHighlights: [] };

  const spreadAnalysis = await analyzeThreeCard(cardsInfo);
  const graphRAGPayload = {
    passages: [
      {
        title: 'Memory and Renewal',
        text: 'Six of Cups speaks to the sweetness of memory while The Star invites renewal after upheaval.',
        source: 'Test Source'
      },
      {
        title: 'Hope After Upheaval',
        text: 'The Tower clears what no longer holds so the querent can rebuild with clarity.',
        source: 'Test Source'
      }
    ],
    retrievalSummary: { graphKeysProvided: true },
    maxPassages: 2,
    initialPassageCount: 2
  };

  const personalization = {
    displayName: 'Ava',
    focusAreas: ['career clarity', 'self-trust']
  };

  return buildEnhancedClaudePrompt({
    spreadInfo,
    cardsInfo,
    userQuestion: sample.userQuestion,
    reflectionsText: sample.reflectionsText,
    themes,
    spreadAnalysis,
    context: 'general',
    deckStyle: 'rws-1909',
    graphRAGPayload,
    personalization,
    promptBudgetEnv
  });
}

async function main() {
  const { systemPrompt, userPrompt, promptMeta } = await buildPromptSample();

  assert(
    systemPrompt.includes('TRADITIONAL WISDOM (GraphRAG)'),
    'GraphRAG block should be injected into system prompt'
  );
  assert(
    promptMeta?.graphRAG?.includedInPrompt === true,
    'promptMeta.graphRAG should mark includedInPrompt when passages exist'
  );
  assert(
    (promptMeta?.graphRAG?.passagesUsedInPrompt || 0) > 0,
    'promptMeta.graphRAG should report passages used in prompt'
  );
  assert(
    userPrompt.includes('Remember, Ava,'),
    'User prompt should include personalized name usage guidance'
  );
  assert(
    userPrompt.includes('Focus areas (from onboarding)'),
    'User prompt should include focus area guidance when provided'
  );

  const { promptMeta: slimMeta } = await buildPromptSample({
    promptBudgetEnv: {
      ENABLE_PROMPT_SLIMMING: 'true',
      PROMPT_BUDGET_CLAUDE: '200'
    }
  });

  assert(slimMeta?.slimmingEnabled === true, 'Slimming should be enabled when env flag is true');
  assert(
    Array.isArray(slimMeta?.slimmingSteps) && slimMeta.slimmingSteps.length > 0,
    'Slimming should record at least one slimming step when over budget'
  );

  console.log('Narrative prompt assembly checks passed.');
}

main().catch((err) => {
  console.error('Narrative prompt assembly checks failed:', err.message);
  process.exit(1);
});
