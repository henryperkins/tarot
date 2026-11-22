import { READING_CONFIG_FIXTURE } from '../../shared/contracts/aiConfigSample.js';
import { getSpreadInfo } from '../../src/data/spreads.js';
import { executeReading } from '../api/tarot-reading.js';
import { normalizeInferenceIdentifier } from './inferenceAttempts.js';
import { isPersonalTextProviderEnabled } from './personalTextProvider.js';
import { resolveReadingCards } from './readingCardResolution.js';
import { snapshotReadingPolicies } from './readingConfigPolicy.js';

function fixtureRequest(signal) {
  const { question, spreadKey, deckId, cards } = READING_CONFIG_FIXTURE;
  const spread = getSpreadInfo(spreadKey);
  const cardsInfo = resolveReadingCards(cards.map((card, index) => ({
    card, orientation: 'Upright', position: spread.positions[index]
  })), deckId);
  return new Request('https://internal/api/tarot-reading?stream=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      spreadInfo: { key: spreadKey, name: spread.name }, deckStyle: deckId,
      cardsInfo, userQuestion: question, useSavedMemories: false
    })
  });
}

/** Run a validated public reading draft using the web job's delivery path. */
export async function runReadingConfigSample(env, policy, { signal } = {}) {
  if (isPersonalTextProviderEnabled(env)) {
    throw new Error('Public reading samples are unavailable in personal subscription mode.');
  }
  const readingPolicies = await snapshotReadingPolicies(env, { revision: null, policy });
  const steps = [policy.primary, ...policy.fallbacks];
  const attempts = [];
  let lastSlot = -1;
  const sampleRun = {
    // Keep ephemeris inputs stable across runs of this fixture.
    referenceTime: '2026-11-19T12:00:00.000Z',
    record({ provider, state, reason, model, effortSent }) {
      const slot = steps.findIndex(step => step.providerId === provider);
      if (slot < 0) return;
      // A missing binding skips the configured slot, without renumbering a
      // fallback or counting untouched options after the winning attempt.
      for (let i = lastSlot + 1; i < slot; i += 1) {
        attempts.push({ slot: i, providerId: steps[i].providerId, outcome: 'skipped', reason: 'unconfigured' });
      }
      lastSlot = slot;
      const reported = normalizeInferenceIdentifier(model);
      const modelId = reported || steps[slot].modelId;
      attempts.push({
        slot, providerId: provider, outcome: state,
        ...(modelId ? { modelId, modelSource: reported ? 'reported' : 'configured' } : {}),
        ...(effortSent ? { effortSent } : {}),
        ...(reason ? { reason } : {})
      });
    }
  };
  // Only config admission above can read the configuration database. The
  // shared generation pipeline receives no reader storage or analytics sinks.
  const sampleEnv = {
    ...env, DB: undefined, RATELIMIT: undefined, METRICS_DB: undefined, FEEDBACK_KV: undefined,
    EVAL_GATEWAY_ID: '', PERSIST_PROMPTS: 'false', AB_TESTING_ENABLED: 'false'
  };
  const response = await executeReading({ request: fixtureRequest(signal), env: sampleEnv, readingPolicies, sampleRun });
  const delivered = await response.json().catch(() => ({}));
  const receipt = { requestedPrimary: policy.primary, attempts, excerpt: '' };
  if (!response.ok || !delivered.reading) {
    return { ...receipt, outcome: 'failed', reason: delivered.code || attempts.at(-1)?.reason || 'reading_unavailable' };
  }
  receipt.excerpt = delivered.reading.trim().slice(0, 700);
  if (['safe-fallback', 'safety-gate'].includes(delivered.provider)) {
    return { ...receipt, outcome: 'safety_replaced' };
  }
  const outcome = delivered.provider === 'local-composer' ? 'local_fallback'
    : delivered.provider === policy.primary.providerId ? 'primary_accepted' : 'fallback_accepted';
  return { ...receipt, outcome };
}
