#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as weave from 'weave';

import { parseJsoncConfig } from '../deploy.js';

import { MAJOR_ARCANA } from '../../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../../src/data/minorArcana.js';
import { SPREADS } from '../../src/data/spreads.js';
import { resolveContextSelection } from '../../functions/lib/contextDetection.js';
import { prepareReadingContextSources } from '../../functions/lib/readingContextSources.js';
import { resolveDecisionPathContext } from '../../functions/lib/decisionPathContext.js';
import { resolveReadingCards } from '../../functions/lib/readingCardResolution.js';
import { selectMemoriesForReading } from '../../functions/lib/readingMemorySelection.js';
import { safeParseReadingRequest } from '../../shared/contracts/readingSchema.js';
import { performSpreadAnalysis } from '../../functions/lib/spreadAnalysisOrchestrator.js';
import {
  NARRATIVE_BACKENDS,
  runNarrativeBackend
} from '../../functions/lib/narrativeBackends.js';
import { resolveNarrativeEvalBackend, runSubscriptionNarrative, describeSubscriptionNarrativeConfig } from './lib/subscriptionNarrative.js';
import { isGraphRAGEnabled, isSemanticScoringAvailable } from '../../functions/lib/graphRAG.js';
import { resolveSemanticScoring } from '../../functions/lib/readingTelemetry.js';
import { buildGraphRAGTelemetry } from '../../functions/lib/telemetrySchema.js';

const CARD_LOOKUP = new Map([
  ...MAJOR_ARCANA.map((card) => [card.name, card]),
  ...MINOR_ARCANA.map((card) => [card.name, card])
]);

const DEFAULT_OUTPUT = 'data/evaluations/narrative-samples.json';
const DEFAULT_BACKEND = process.env.NARRATIVE_EVAL_BACKEND || 'claude-code';
// Astrological context (moon phase, retrogrades, forecast) depends on this instant,
// so a fixed default keeps runs comparable. Pass `--reference-time now` for live sky.
const DEFAULT_REFERENCE_TIME = process.env.NARRATIVE_EVAL_REFERENCE_TIME || '2026-09-23T14:04:00Z';
// "production" layers the shell environment over wrangler.jsonc vars, so flags
// such as GRAPHRAG_ENABLED match the deployed Worker unless explicitly overridden.
// "shell" uses only the shell environment.
const ENV_PROFILES = new Set(['production', 'shell']);
const DEFAULT_ENV_PROFILE = process.env.NARRATIVE_EVAL_ENV_PROFILE || 'production';

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
  // Review cases for audit F03 (2026-09-29): a hypothetical third-party
  // question and a general question must not produce claims about anyone's
  // hidden feelings, history, or private behavior.
  {
    id: 'relationship-hypothetical-collaborators',
    spreadKey: 'relationship',
    userQuestion: 'Two hypothetical collaborators are planning a project together. What could help them communicate well?',
    reflectionsText: 'This is a hypothetical scenario. Please do not guess at either person\'s hidden feelings or private behavior.',
    deckStyle: 'marseille-classic',
    cards: [
      { name: 'Page of Swords', orientation: 'Upright' },
      { name: 'Five of Cups', orientation: 'Reversed' },
      { name: 'Two of Pentacles', orientation: 'Upright' }
    ]
  },
  {
    id: 'celtic-general-focused-week',
    spreadKey: 'celtic',
    userQuestion: 'What can help me have a focused week?',
    reflectionsText: '',
    deckStyle: 'thoth-a1',
    cards: [
      { name: 'Eight of Pentacles', orientation: 'Upright' },
      { name: 'Five of Cups', orientation: 'Reversed' },
      { name: 'The Moon', orientation: 'Upright' },
      { name: 'Six of Cups', orientation: 'Upright' },
      { name: 'Ace of Swords', orientation: 'Upright' },
      { name: 'Eight of Cups', orientation: 'Upright' },
      { name: 'The Hermit', orientation: 'Upright' },
      { name: 'Three of Wands', orientation: 'Reversed' },
      { name: 'Nine of Swords', orientation: 'Upright' },
      { name: 'Four of Wands', orientation: 'Upright' }
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
  console.log(`Usage: node scripts/evaluation/runNarrativeSamples.js [--out ${DEFAULT_OUTPUT}] [--fixtures file.json] [--sample sample-id] [--backend auto|claude-code|local-composer] [--reference-time ISO|now] [--env-profile production|shell] [--trace]`);
  console.log(`\nOptions:`);
  console.log(`  --reference-time  Instant for astrological context (default ${DEFAULT_REFERENCE_TIME}; "now" for the live sky)`);
  console.log(`  --env-profile      "production" (default) layers the shell env over wrangler.jsonc vars; "shell" uses the shell env only`);
  console.log(`  --trace    Enable W&B Weave tracing (requires WANDB_API_KEY)`);
  console.log('  --fixtures Read synthetic cases from a qualification corpus instead of the default samples');
}

function resolveReferenceTime(value) {
  if (value === 'now') return new Date().toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid --reference-time: ${value}`);
  }
  return date.toISOString();
}

function parseArgs(rawArgs) {
  const options = {
    output: DEFAULT_OUTPUT,
    sampleIds: null,
    backend: DEFAULT_BACKEND,
    referenceTime: DEFAULT_REFERENCE_TIME,
    envProfile: DEFAULT_ENV_PROFILE,
    trace: false
  };
  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg === '--out') {
      options.output = rawArgs[i + 1] || DEFAULT_OUTPUT;
      i += 1;
    } else if (arg === '--fixtures') {
      if (!rawArgs[i + 1]) throw new Error('Missing value for --fixtures');
      options.fixtures = rawArgs[++i];
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
    } else if (arg === '--reference-time') {
      const value = rawArgs[i + 1];
      if (!value) {
        throw new Error('Missing value for --reference-time');
      }
      options.referenceTime = value;
      i += 1;
    } else if (arg === '--env-profile') {
      options.envProfile = rawArgs[i + 1] || DEFAULT_ENV_PROFILE;
      i += 1;
    } else if (arg === '--trace') {
      options.trace = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
  }
  if (!ENV_PROFILES.has(options.envProfile)) {
    throw new Error(`Unknown --env-profile "${options.envProfile}" (expected production or shell)`);
  }
  return options;
}

async function loadEvalEnv(envProfile) {
  if (envProfile === 'shell') return { ...process.env };
  const config = parseJsoncConfig(await fs.readFile(path.resolve(process.cwd(), 'wrangler.jsonc'), 'utf-8'));
  return { ...(config.vars || {}), ...process.env };
}

// Record what actually generated the samples; the backend id alone does not
// say which model, reasoning effort, or retrieval settings were in effect.
function describeBackendConfig(backendId, env) {
  if (backendId === 'claude-code') {
    return describeSubscriptionNarrativeConfig(env);
  }
  return { provider: 'local', model: null, reasoningEffort: null, verbosity: null };
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

export function resolveBackendId(requestedBackend) {
  return resolveNarrativeEvalBackend(requestedBackend);
}

/** Prepare synthetic samples through the same current-source and memory pipeline. */
export async function prepareNarrativeSamplePayload(sample, { env = {}, referenceTime = sample.referenceTime || DEFAULT_REFERENCE_TIME } = {}) {
  const spreadInfo = sample.spreadInfo || SPREADS[sample.spreadKey] || (sample.spreadKey === 'general'
    ? { key: 'general', name: 'Custom Spread', count: sample.cards.length, positions: sample.cards.map((_, index) => `Position ${index + 1}`) }
    : null);
  if (!spreadInfo) throw new Error(`Unknown spread key: ${sample.spreadKey}`);
  if (sample.cards.length !== spreadInfo.count) throw new Error(`Sample ${sample.id} cards (${sample.cards.length}) do not match spread count (${spreadInfo.count}).`);
  const deckStyle = sample.deckStyle || spreadInfo.deckStyle || 'rws-1909';
  const rawCards = sample.cards.map((cardDef, index) => ({
    ...buildCardEntry(getCardByName(cardDef.name), cardDef.position || spreadInfo.positions[index] || `Position ${index + 1}`, normalizeOrientation(cardDef.orientation)),
    ...(typeof cardDef.userReflection === 'string' ? { userReflection: cardDef.userReflection } : {})
  }));
  const parsed = safeParseReadingRequest({
    spreadInfo: { ...spreadInfo, key: sample.spreadKey }, cardsInfo: rawCards,
    userQuestion: sample.userQuestion || '', reflectionsText: sample.reflectionsText || '',
    ...(sample.decisionPaths ? { decisionPaths: sample.decisionPaths } : {})
  });
  if (!parsed.success) throw new Error(`Sample ${sample.id} is not a valid reading request: ${parsed.error}`);
  const cardsInfo = resolveReadingCards(parsed.data.cardsInfo, deckStyle);
  const { decisionPaths, inputStats } = resolveDecisionPathContext({ spreadKey: sample.spreadKey, cardsInfo, decisionPaths: parsed.data.decisionPaths });
  const contextSources = {
    userQuestion: parsed.data.userQuestion || '', reflectionsText: parsed.data.reflectionsText || '',
    cardsInfo, decisionPaths, spreadKey: sample.spreadKey, focusAreas: sample.personalization?.focusAreas || []
  };
  const sources = prepareReadingContextSources(contextSources);
  const selection = resolveContextSelection({ sources }, sample.spreadKey);
  const memorySelection = selectMemoriesForReading(sample.memories || [], { sources, displayName: sample.personalization?.displayName, referenceTime: Date.parse(referenceTime) });
  const analysis = await performSpreadAnalysis(spreadInfo, cardsInfo, {
    deckStyle, userQuestion: contextSources.userQuestion,
    reflectionsText: contextSources.reflectionsText, contextSources: { sources },
    subscriptionTier: sample.subscriptionTier || 'pro', referenceTime
  }, `eval-${sample.id}`, env);
  return {
    spreadInfo, cardsInfo, userQuestion: contextSources.userQuestion,
    reflectionsText: contextSources.reflectionsText, decisionPaths,
    userContextInputStats: inputStats,
    analysis, context: selection.context, contextInputText: selection.retrievalQuery,
    contextDiagnostics: [], visionInsights: [], deckStyle,
    personalization: sample.personalization || null,
    memories: memorySelection.memories, memorySelection,
    subscriptionTier: sample.subscriptionTier || 'pro', narrativeEnhancements: [],
    graphRAGPayload: analysis.graphRAGPayload || null,
    promptMeta: null, variantPromptOverrides: null
  };
}

export async function generateSampleImpl(sample, { env, backendId, referenceTime }) {
  const actualReferenceTime = resolveReferenceTime(referenceTime || sample.referenceTime || DEFAULT_REFERENCE_TIME);
  const narrativePayload = await prepareNarrativeSamplePayload(sample, { env, referenceTime: actualReferenceTime });
  const { spreadInfo, cardsInfo, analysis, context, deckStyle } = narrativePayload;

  const { reading, model, usage } = backendId === 'claude-code'
    ? await runSubscriptionNarrative(env, narrativePayload, `eval-${sample.id}`)
    : await runNarrativeBackend(backendId, env, narrativePayload, `eval-${sample.id}`);

  if (!reading || !reading.trim()) {
    throw new Error(`Reading generation failed for sample ${sample.id}`);
  }

  return {
    id: sample.id,
    referenceTime: actualReferenceTime,
    spreadKey: sample.spreadKey,
    spreadName: spreadInfo.name,
    userQuestion: sample.userQuestion,
    reflectionsText: sample.reflectionsText || '',
    context,
    cardsInfo,
    deckStyle,
    reading,
    ...(model && { inference: { provider: backendId, model, usage } }),
    // What retrieval did for this sample, not what the env asked for
    semanticScoring: buildGraphRAGTelemetry(analysis.graphRAGPayload?.retrievalSummary)?.semanticScoring || null,
    sourceUsage: narrativePayload.promptMeta?.sourceUsage || null,
    memoryCounts: narrativePayload.promptMeta?.memories || null,
    themesSummary: {
      reversalFramework: analysis.themes?.reversalFramework,
      suitFocus: analysis.themes?.suitFocus || null,
      archetypeDescription: analysis.themes?.archetypeDescription || null
    }
  };
}

export async function main() {
  const options = parseArgs(process.argv.slice(2));
  const env = await loadEvalEnv(options.envProfile);
  const backendId = resolveBackendId(options.backend, env);
  const referenceTime = resolveReferenceTime(options.referenceTime);

  // Initialize Weave tracing if enabled
  let generateSample = generateSampleImpl;
  if (options.trace) {
    if (!process.env.WANDB_API_KEY) {
      console.error('--trace requires WANDB_API_KEY environment variable');
      console.error('Get your API key at: https://wandb.ai/authorize');
      process.exit(1);
    }
    console.log('Initializing W&B Weave tracing...');
    await weave.init('lakefront-digital/Tarot');
    // Wrap the generate function with Weave tracing
    generateSample = weave.op(generateSampleImpl, { name: 'generateNarrativeSample' });
    console.log('Tracing enabled. View traces at: https://wandb.ai/lakefront-digital/Tarot/weave/traces');
  }

  const fixtureCorpus = options.fixtures
    ? JSON.parse(await fs.readFile(path.resolve(options.fixtures), 'utf8')) : null;
  const definitions = fixtureCorpus?.cases || SAMPLE_DEFINITIONS;
  if (!Array.isArray(definitions) || definitions.some(sample => !sample?.id) || new Set(definitions.map(sample => sample.id)).size !== definitions.length) {
    throw new Error('Sample corpus must contain uniquely identified cases.');
  }
  const selectedSamples = definitions.filter((sample) => {
    if (!options.sampleIds) return true;
    return options.sampleIds.has(sample.id);
  });

  if (selectedSamples.length === 0) {
    console.error('No samples matched the provided filters.');
    process.exit(1);
  }
  if (options.sampleIds && selectedSamples.length !== options.sampleIds.size) {
    throw new Error('Some requested sample IDs do not exist in the corpus.');
  }

  const generated = [];
  for (const sample of selectedSamples) {
    console.log(`Generating sample: ${sample.id}...`);
    const sampleReferenceTime = resolveReferenceTime(options.fixtures ? sample.referenceTime || fixtureCorpus.referenceTime || referenceTime : referenceTime);
    generated.push(await generateSample(sample, { env, backendId, referenceTime: sampleReferenceTime }));
  }

  const referenceTimes = [...new Set(generated.map(sample => sample.referenceTime))];
  const payload = {
    generatedAt: new Date().toISOString(),
    referenceTime: referenceTimes.length === 1 ? referenceTimes[0] : null,
    referenceTimes,
    model: backendId,
    backendLabel: NARRATIVE_BACKENDS[backendId]?.label || backendId,
    config: {
      envProfile: options.envProfile,
      backend: backendId,
      ...describeBackendConfig(backendId, env),
      graphRAGEnabled: isGraphRAGEnabled(env),
      semanticScoring: {
        // true/false from ENABLE_SEMANTIC_SCORING or GRAPHRAG_SEMANTIC_SCORING; null means auto-detect
        requested: resolveSemanticScoring(env),
        embeddingsAvailable: isSemanticScoringAvailable(env),
        usedSampleCount: generated.filter((sample) => sample.semanticScoring?.used === true).length
      },
      promptSlimming: env.ENABLE_PROMPT_SLIMMING ?? null,
      subscriptionTiers: [...new Set(selectedSamples.map((sample) => sample.subscriptionTier || 'pro'))],
      personalizedSampleCount: selectedSamples.filter((sample) => sample.personalization).length,
      visionSampleCount: 0,
      // Samples call one backend directly: no fallback chain, quality gate, or safety scan.
      servingPath: 'direct-backend'
    },
    sampleCount: generated.length,
    samples: generated
  };

  const outPath = path.resolve(process.cwd(), options.output);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(payload, null, 2));
  console.log(`Narrative samples written to ${path.relative(process.cwd(), outPath)} (${generated.length} samples).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error('Failed to generate narrative samples:', err.message);
    process.exitCode = 1;
  });
}
