#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

import { MAJOR_ARCANA } from '../../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../../src/data/minorArcana.js';
import { SPREADS } from '../../src/data/spreads.js';
import { inferContext } from '../../functions/lib/contextDetection.js';
import { performSpreadAnalysis } from '../../functions/lib/spreadAnalysisOrchestrator.js';
import {
  NARRATIVE_BACKENDS,
  getAvailableNarrativeBackends,
  runNarrativeBackend
} from '../../functions/lib/narrativeBackends.js';

const CARD_LOOKUP = new Map([
  ...MAJOR_ARCANA.map((card) => [card.name, card]),
  ...MINOR_ARCANA.map((card) => [card.name, card])
]);

const DEFAULT_OUTPUT = 'data/evaluations/narrative-samples.json';
const DEFAULT_BACKEND = process.env.NARRATIVE_EVAL_BACKEND || 'auto';

const SAMPLE_DEFINITIONS = [
  {
    id: 'single-new-role',
    spreadKey: 'single',
    userQuestion: 'What guiding energy should I bring into this new leadership role?',
    reflectionsText: 'I want to stay curious yet grounded even when the stakes feel high.',
    cards: [
      { name: 'The Fool', orientation: 'Upright' }
    ]
  },
  {
    id: 'three-card-transition',
    spreadKey: 'threeCard',
    userQuestion: 'How can I navigate the transition after leaving my hometown?',
    reflectionsText: 'Part of me is nostalgic while another part is ready for reinvention.',
    cards: [
      { name: 'Six of Cups', orientation: 'Reversed' },
      { name: 'The Tower', orientation: 'Upright' },
      { name: 'The Star', orientation: 'Upright' }
    ]
  },
  {
    id: 'five-card-creative-project',
    spreadKey: 'fiveCard',
    userQuestion: 'What should I know about launching my creative project this quarter?',
    reflectionsText: 'I feel momentum but keep second-guessing the tone and timing.',
    cards: [
      { name: 'Ace of Wands', orientation: 'Upright' },
      { name: 'Seven of Swords', orientation: 'Reversed' },
      { name: 'Queen of Cups', orientation: 'Upright' },
      { name: 'Three of Pentacles', orientation: 'Upright' },
      { name: 'Wheel of Fortune', orientation: 'Reversed' }
    ]
  },
  {
    id: 'relationship-checkin',
    spreadKey: 'relationship',
    userQuestion: 'What should I understand about the energetic exchange between me and Alex?',
    reflectionsText: 'Communication feels uneven lately and I want to ground before reacting.',
    cards: [
      { name: 'Queen of Cups', orientation: 'Reversed' },
      { name: 'Knight of Swords', orientation: 'Upright' },
      { name: 'Two of Cups', orientation: 'Upright' }
    ]
  },
  {
    id: 'celtic-deep-shift',
    spreadKey: 'celtic',
    userQuestion: 'How can I stay centered while everything at home and work restructures at once?',
    reflectionsText: 'It feels like multiple towers at the same time; I want to stay compassionate without losing momentum.',
    cards: [
      { name: 'The Hermit', orientation: 'Upright' },
      { name: 'Five of Wands', orientation: 'Reversed' },
      { name: 'Death', orientation: 'Upright' },
      { name: 'Temperance', orientation: 'Upright' },
      { name: 'The Emperor', orientation: 'Upright' },
      { name: 'The Moon', orientation: 'Reversed' },
      { name: 'Strength', orientation: 'Upright' },
      { name: 'Eight of Pentacles', orientation: 'Upright' },
      { name: 'Nine of Swords', orientation: 'Reversed' },
      { name: 'The Sun', orientation: 'Upright' }
    ]
  },
  {
    id: 'decision-crossroads-long-reflections',
    spreadKey: 'decision',
    userQuestion: 'I am at a decision point about whether to relocate or stay. Which path supports my growth?',
    reflectionsText: 'I keep weighing stability against growth, and my mind loops between the two paths. '.repeat(8).trim(),
    cards: [
      { name: 'The Lovers', orientation: 'Upright' },
      { name: 'Two of Wands', orientation: 'Upright' },
      { name: 'Six of Swords', orientation: 'Reversed' },
      { name: 'Justice', orientation: 'Upright' },
      { name: 'The Fool', orientation: 'Reversed' }
    ]
  },
  {
    id: 'spiritual-thoth-ritual',
    spreadKey: 'threeCard',
    userQuestion: 'What spiritual practice should I commit to this season to deepen my intuition?',
    reflectionsText: 'I want a ritual that feels grounded, not performative.',
    deckStyle: 'thoth-a1',
    cards: [
      { name: 'The Hierophant', orientation: 'Upright' },
      { name: 'The High Priestess', orientation: 'Reversed' },
      { name: 'The Star', orientation: 'Upright' }
    ]
  },
  {
    id: 'wellbeing-marseille-reset',
    spreadKey: 'fiveCard',
    userQuestion: 'I am feeling burnout and restless sleep. What helps me restore my wellbeing?',
    reflectionsText: 'My body feels tired even when my mind is racing.',
    deckStyle: 'marseille-classic',
    cards: [
      { name: 'Four of Swords', orientation: 'Upright' },
      { name: 'Ten of Wands', orientation: 'Reversed' },
      { name: 'Temperance', orientation: 'Upright' },
      { name: 'Six of Pentacles', orientation: 'Upright' },
      { name: 'The Sun', orientation: 'Reversed' }
    ]
  },
  {
    id: 'non-english-spanish',
    spreadKey: 'threeCard',
    userQuestion: 'Como puedo sostener mi energia mientras apoyo a mi familia y mi trabajo?',
    reflectionsText: 'Quiero sentirme presente sin perder mi rumbo.',
    cards: [
      { name: 'The Hermit', orientation: 'Upright' },
      { name: 'Eight of Cups', orientation: 'Upright' },
      { name: 'The Sun', orientation: 'Reversed' }
    ]
  }
];

function usage() {
  console.log(`Usage: node scripts/evaluation/runNarrativeSamples.js [--out ${DEFAULT_OUTPUT}] [--sample sample-id] [--backend auto|local-composer|azure-gpt5|claude-opus45]`);
}

function parseArgs(rawArgs) {
  const options = { output: DEFAULT_OUTPUT, sampleIds: null, backend: DEFAULT_BACKEND };
  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg === '--out') {
      options.output = rawArgs[i + 1] || DEFAULT_OUTPUT;
      i += 1;
    } else if (arg === '--sample') {
      const id = rawArgs[i + 1];
      if (!id) {
        throw new Error('Missing value for --sample');
      }
      options.sampleIds = options.sampleIds || new Set();
      options.sampleIds.add(id);
      i += 1;
    } else if (arg === '--backend') {
      options.backend = rawArgs[i + 1] || DEFAULT_BACKEND;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
  }
  return options;
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

function normalizeBackendId(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized || normalized === 'auto') return 'auto';
  if (normalized === 'local') return 'local-composer';
  return normalized;
}

function resolveBackendId(requestedBackend, env) {
  const normalized = normalizeBackendId(requestedBackend);
  if (normalized === 'auto') {
    const available = getAvailableNarrativeBackends(env);
    return available.length ? available[0].id : 'local-composer';
  }

  if (!NARRATIVE_BACKENDS[normalized]) {
    throw new Error(`Unknown backend "${requestedBackend}"`);
  }

  if (!NARRATIVE_BACKENDS[normalized].isAvailable(env)) {
    throw new Error(`Backend "${normalized}" is not available (missing configuration).`);
  }

  return normalized;
}

async function generateSample(sample, { env, backendId }) {
  const spreadInfo = SPREADS[sample.spreadKey];
  if (!spreadInfo) {
    throw new Error(`Unknown spread key: ${sample.spreadKey}`);
  }

  if (sample.cards.length !== spreadInfo.count) {
    throw new Error(`Sample ${sample.id} cards (${sample.cards.length}) do not match spread count (${spreadInfo.count}).`);
  }

  const cardsInfo = sample.cards.map((cardDef, index) => {
    const position = spreadInfo.positions[index] || `Position ${index + 1}`;
    const orientation = normalizeOrientation(cardDef.orientation);
    const baseCard = getCardByName(cardDef.name);
    return buildCardEntry(baseCard, position, orientation);
  });

  const deckStyle = sample.deckStyle || spreadInfo.deckStyle || 'rws-1909';
  const analysis = await performSpreadAnalysis(
    spreadInfo,
    cardsInfo,
    {
      deckStyle,
      userQuestion: sample.userQuestion,
      subscriptionTier: sample.subscriptionTier || 'pro'
    },
    `eval-${sample.id}`,
    env
  );

  const context = sample.context || inferContext(sample.userQuestion, analysis.spreadKey || sample.spreadKey);
  const narrativePayload = {
    spreadInfo,
    cardsInfo,
    userQuestion: sample.userQuestion,
    reflectionsText: sample.reflectionsText || '',
    analysis,
    context,
    contextDiagnostics: [],
    visionInsights: [],
    deckStyle,
    personalization: sample.personalization || null,
    subscriptionTier: sample.subscriptionTier || 'pro',
    narrativeEnhancements: [],
    graphRAGPayload: analysis.graphRAGPayload || null,
    promptMeta: null,
    variantPromptOverrides: null
  };

  const { reading } = await runNarrativeBackend(backendId, env, narrativePayload, `eval-${sample.id}`);

  if (!reading || !reading.trim()) {
    throw new Error(`Reading generation failed for sample ${sample.id}`);
  }

  return {
    id: sample.id,
    spreadKey: sample.spreadKey,
    spreadName: spreadInfo.name,
    userQuestion: sample.userQuestion,
    reflectionsText: sample.reflectionsText || '',
    context,
    cardsInfo,
    deckStyle,
    reading,
    themesSummary: {
      reversalFramework: analysis.themes?.reversalFramework,
      suitFocus: analysis.themes?.suitFocus || null,
      archetypeDescription: analysis.themes?.archetypeDescription || null
    }
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const env = { ...process.env };
  const backendId = resolveBackendId(options.backend, env);
  const selectedSamples = SAMPLE_DEFINITIONS.filter((sample) => {
    if (!options.sampleIds) return true;
    return options.sampleIds.has(sample.id);
  });

  if (selectedSamples.length === 0) {
    console.error('No samples matched the provided filters.');
    process.exit(1);
  }

  const generated = [];
  for (const sample of selectedSamples) {
    generated.push(await generateSample(sample, { env, backendId }));
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    model: backendId,
    backendLabel: NARRATIVE_BACKENDS[backendId]?.label || backendId,
    sampleCount: generated.length,
    samples: generated
  };

  const outPath = path.resolve(process.cwd(), options.output);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(payload, null, 2));
  console.log(`Narrative samples written to ${path.relative(process.cwd(), outPath)} (${generated.length} samples).`);
}

main().catch((err) => {
  console.error('Failed to generate narrative samples:', err.message);
  process.exit(1);
});
