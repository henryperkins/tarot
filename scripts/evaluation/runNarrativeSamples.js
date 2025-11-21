#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

import { MAJOR_ARCANA } from '../../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../../src/data/minorArcana.js';
import { SPREADS } from '../../src/data/spreads.js';
import {
  analyzeSpreadThemes,
  analyzeCelticCross,
  analyzeThreeCard,
  analyzeFiveCard,
  analyzeRelationship,
  analyzeDecision
} from '../../functions/lib/spreadAnalysis.js';
import {
  buildCelticCrossReading,
  buildThreeCardReading,
  buildFiveCardReading,
  buildRelationshipReading,
  buildDecisionReading,
  buildSingleCardReading
} from '../../functions/lib/narrativeBuilder.js';
import { inferContext } from '../../functions/lib/contextDetection.js';

const CARD_LOOKUP = new Map([
  ...MAJOR_ARCANA.map((card) => [card.name, card]),
  ...MINOR_ARCANA.map((card) => [card.name, card])
]);

const DEFAULT_OUTPUT = 'data/evaluations/narrative-samples.json';

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
  }
];

function usage() {
  console.log(`Usage: node scripts/evaluation/runNarrativeSamples.js [--out ${DEFAULT_OUTPUT}] [--sample sample-id]`);
}

function parseArgs(rawArgs) {
  const options = { output: DEFAULT_OUTPUT, sampleIds: null };
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

async function buildSpreadAnalysis(spreadKey, cardsInfo) {
  switch (spreadKey) {
    case 'celtic':
      return analyzeCelticCross(cardsInfo);
    case 'threeCard':
      return analyzeThreeCard(cardsInfo);
    case 'fiveCard':
      return analyzeFiveCard(cardsInfo);
    case 'relationship':
      return analyzeRelationship(cardsInfo);
    case 'decision':
      return analyzeDecision(cardsInfo);
    default:
      return null;
  }
}

async function buildReadingFromAnalysis(spreadKey, { spreadAnalysis, cardsInfo, userQuestion, reflectionsText, themes, spreadInfo, context }) {
  switch (spreadKey) {
    case 'celtic':
      return buildCelticCrossReading({ cardsInfo, userQuestion, reflectionsText, celticAnalysis: spreadAnalysis, themes, spreadInfo, context });
    case 'threeCard':
      return buildThreeCardReading({ cardsInfo, userQuestion, reflectionsText, threeCardAnalysis: spreadAnalysis, themes, spreadInfo, context });
    case 'fiveCard':
      return buildFiveCardReading({ cardsInfo, userQuestion, reflectionsText, fiveCardAnalysis: spreadAnalysis, themes, spreadInfo, context });
    case 'relationship':
      return buildRelationshipReading({ cardsInfo, userQuestion, reflectionsText, themes, spreadInfo, context });
    case 'decision':
      return buildDecisionReading({ cardsInfo, userQuestion, reflectionsText, decisionAnalysis: spreadAnalysis, themes, spreadInfo, context });
    case 'single':
    default:
      return buildSingleCardReading({ cardsInfo, userQuestion, reflectionsText, themes, spreadInfo, context });
  }
}

async function generateSample(sample) {
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

  const themes = await analyzeSpreadThemes(cardsInfo);
  const spreadAnalysis = await buildSpreadAnalysis(sample.spreadKey, cardsInfo);
  const context = sample.context || inferContext(sample.userQuestion, sample.spreadKey);
  const reading = await buildReadingFromAnalysis(sample.spreadKey, {
    spreadAnalysis,
    cardsInfo,
    userQuestion: sample.userQuestion,
    reflectionsText: sample.reflectionsText || '',
    themes,
    spreadInfo,
    context
  });

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
    reading,
    themesSummary: {
      reversalFramework: themes.reversalFramework,
      suitFocus: themes.suitFocus || null,
      archetypeDescription: themes.archetypeDescription || null
    }
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
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
    generated.push(await generateSample(sample));
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    model: 'local-composer',
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
