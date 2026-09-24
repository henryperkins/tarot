#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import * as weave from 'weave';

import { parseJsoncConfig } from '../deploy.js';

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
import { ensureAzureConfig, getReasoningEffort, getTextVerbosity } from '../../functions/lib/azureResponses.js';
import { ensureModalConfig } from '../../functions/lib/modalChatCompletions.js';
import { isGraphRAGEnabled, isSemanticScoringAvailable } from '../../functions/lib/graphRAG.js';
import { resolveSemanticScoring } from '../../functions/lib/readingTelemetry.js';
import { buildGraphRAGTelemetry } from '../../functions/lib/telemetrySchema.js';

const CARD_LOOKUP = new Map([
  ...MAJOR_ARCANA.map((card) => [card.name, card]),
  ...MINOR_ARCANA.map((card) => [card.name, card])
]);

const DEFAULT_OUTPUT = 'data/evaluations/narrative-samples.json';
const DEFAULT_BACKEND = process.env.NARRATIVE_EVAL_BACKEND || 'auto';
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
  console.log(`Usage: node scripts/evaluation/runNarrativeSamples.js [--out ${DEFAULT_OUTPUT}] [--sample sample-id] [--backend auto|local-composer|azure-gpt5|claude-opus45] [--reference-time ISO|now] [--env-profile production|shell] [--trace]`);
  console.log(`\nOptions:`);
  console.log(`  --reference-time  Instant for astrological context (default ${DEFAULT_REFERENCE_TIME}; "now" for the live sky)`);
  console.log(`  --env-profile      "production" (default) layers the shell env over wrangler.jsonc vars; "shell" uses the shell env only`);
  console.log(`  --trace    Enable W&B Weave tracing (requires WANDB_API_KEY)`);
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
  if (backendId === 'azure-gpt5') {
    const { model, provider } = ensureAzureConfig(env);
    return { provider, model, reasoningEffort: getReasoningEffort(env, model), verbosity: getTextVerbosity(env, model) };
  }
  if (backendId === 'modal-qwen') {
    const { model, reasoningEffort } = ensureModalConfig(env);
    return { provider: 'modal', model, reasoningEffort, verbosity: null };
  }
  if (backendId === 'claude-opus45') {
    // null means the backend's built-in default model.
    return { provider: 'azure-anthropic', model: env.AZURE_ANTHROPIC_MODEL || null, reasoningEffort: null, verbosity: null };
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

/**
 * Generate a narrative sample. When tracing is enabled, this function
 * is wrapped with weave.op() to log inputs/outputs to W&B.
 */
async function generateSampleImpl(sample, { env, backendId, referenceTime }) {
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
      subscriptionTier: sample.subscriptionTier || 'pro',
      referenceTime
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
    // What retrieval did for this sample, not what the env asked for
    semanticScoring: buildGraphRAGTelemetry(analysis.graphRAGPayload?.retrievalSummary)?.semanticScoring || null,
    themesSummary: {
      reversalFramework: analysis.themes?.reversalFramework,
      suitFocus: analysis.themes?.suitFocus || null,
      archetypeDescription: analysis.themes?.archetypeDescription || null
    }
  };
}

async function main() {
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
    console.log(`Generating sample: ${sample.id}...`);
    generated.push(await generateSample(sample, { env, backendId, referenceTime }));
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    referenceTime,
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

main().catch((err) => {
  console.error('Failed to generate narrative samples:', err.message);
  process.exit(1);
});
