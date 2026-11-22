import { generateQuestionWithWorkersAI, craftQuestionFromPrompt } from '../api/generate-question.js';
import { generateLLMSummary } from '../api/journal-summary.js';
import { checkBufferedFollowUp, generateFollowUpText } from '../api/reading-followup.js';
import { computeJournalStats } from '../../shared/journal/stats.js';
import { buildHeuristicJourneySummary } from '../../shared/journal/summary.js';
import { buildFollowUpPrompt } from './followUpPrompt.js';
import { generateClaudeApiFollowUp } from './claudeApiFollowUp.js';
import { callOpenAIResponses } from './openaiResponses.js';
import { isPersonalTextProviderEnabled } from './personalTextProvider.js';
import { extractNextStepsWithAI } from './coachSuggestion.js';
import { finishReadingEvaluation, runEvaluation, runSyncEvaluationGate } from './evaluation.js';
import { inferAttemptReason, normalizeInferenceIdentifier } from './inferenceAttempts.js';
import { withTextPolicy } from './textFeaturePolicy.js';
import { createDeadline, getTaskTimeoutMs } from './requestDeadline.js';

const narrative = 'The Hermit invites some quiet time before you begin your creative project. Set aside ten minutes to sketch one idea, then write down what you would like to try next.';
const reading = {
  narrative, deckStyle: 'rws-1909', spreadKey: 'single',
  question: 'How can I begin my creative practice?',
  cardsInfo: [{ card: 'The Hermit', position: 'Focus', orientation: 'upright' }]
};
const entries = [
  { id: 'example-1', ts: Date.UTC(2026, 0, 4), spread: 'One card', spreadKey: 'single', question: reading.question,
    cards: [{ name: 'The Hermit', orientation: 'upright' }], context: 'creativity', personalReading: narrative },
  { id: 'example-2', ts: Date.UTC(2026, 0, 11), spread: 'One card', spreadKey: 'single', question: 'What helps me keep practicing?',
    cards: [{ name: 'Eight of Pentacles', orientation: 'upright' }], context: 'creativity', personalReading: 'Try a small daily practice and notice one change in your work.' }
];

async function sampleQuestion({ env, requestId, signal, record }) {
  const prompt = 'A creative project needs a first step';
  const metadata = { focus: 'starting a creative project', spreadKey: 'threeCard', seed: 'guided-questions-v1' };
  try {
    const result = await generateQuestionWithWorkersAI(env, prompt, metadata, signal, requestId);
    record({ slot: 0, outcome: 'accepted', reportedModel: result.reportedModel, effortSent: result.effortSent });
    return { excerpt: result.question };
  } catch (error) {
    signal.throwIfAborted();
    record({ slot: 0, outcome: env.AI ? 'failed' : 'skipped', reason: env.AI ? inferAttemptReason(error) : 'unconfigured' });
    record({ slot: 1, providerId: 'local-template', outcome: 'accepted' });
    return { excerpt: craftQuestionFromPrompt(prompt, metadata), outcome: 'local_fallback' };
  }
}

async function sampleSummary({ env, requestId, signal, record }) {
  try {
    const result = await generateLLMSummary(env, entries, signal, requestId, record);
    return { excerpt: result.text };
  } catch {
    signal.throwIfAborted();
    record({ slot: 2, providerId: 'local-heuristic', outcome: 'accepted' });
    return { excerpt: buildHeuristicJourneySummary(entries, computeJournalStats(entries)), outcome: 'local_fallback' };
  }
}

async function sampleFollowUp({ env, policy, requestId, signal, record }) {
  const followUpQuestion = 'What small step could I take this week?';
  const { systemPrompt, userPrompt } = buildFollowUpPrompt({
    originalReading: reading, followUpQuestion, memoryOptions: { includeMemoryTool: false }
  });
  const steps = [policy.primary, ...policy.fallbacks];
  const effort = providerId => steps.find(step => step.providerId === providerId)?.reasoningEffort;
  let generation;
  const result = await generateFollowUpText(env, {
    requestId, signal,
    onAttempt(attempt) {
      const entry = record({ ...attempt, phase: 'generation' });
      if (entry.outcome === 'accepted') generation = entry;
    },
    generateClaudeApi: () => generateClaudeApiFollowUp(env, {
      systemPrompt, userPrompt, enableMemoryTool: false, effort: effort('claude-api'), requestId, signal
    }),
    generatePrimary: () => callOpenAIResponses(env, {
      instructions: systemPrompt, input: userPrompt, maxTokens: 4096, verbosity: 'medium',
      reasoningEffort: effort('openai-native') || 'low', returnFullResponse: true, requestId, signal
    }),
    buildFallbackPrompts: () => ({ systemPrompt, userPrompt })
  });
  const delivered = await checkBufferedFollowUp(env, {
    responseText: result.text, originalReading: reading, provider: result.provider, followUpQuestion, requestId, signal
  });
  // Only the call whose text passes delivery checks is the accepted answer.
  if (delivered.safetyReplaced) generation.outcome = 'rejected';
  else if (delivered.repairAttempt?.outcome === 'accepted') generation.outcome = 'superseded';
  if (delivered.repairAttempt) record({ ...delivered.repairAttempt, slot: generation.slot, phase: 'repair' });
  return { excerpt: delivered.text, ...(delivered.safetyReplaced && { outcome: 'safety_replaced' }) };
}

async function sampleExtraction({ env, requestId, signal, record }) {
  const result = await extractNextStepsWithAI(env, narrative, requestId, signal);
  if (!['ok', 'no_steps'].includes(result.status)) {
    record({ slot: 0, outcome: env.AI ? 'failed' : 'skipped', reason: result.status });
    return { outcome: 'failed', excerpt: 'Could not extract steps from the sample reading.' };
  }
  record({ slot: 0, outcome: 'accepted', reportedModel: result.model });
  return { excerpt: result.steps.join('\n') || 'No next steps found.' };
}

async function sampleGrade({ env, featureId, requestId, signal, record }) {
  const params = {
    reading: narrative, userQuestion: reading.question, cardsInfo: reading.cardsInfo,
    spreadKey: reading.spreadKey, narrativeMetrics: { cardCount: 1 }, requestId, signal
  };
  const gate = featureId === 'quality-gate';
  if (String(env.EVAL_ENABLED).toLowerCase() !== 'true') {
    record({ slot: 0, outcome: 'skipped', reason: 'disabled' });
    return { outcome: 'failed', excerpt: 'Evaluation is disabled in this environment.' };
  }
  // Exercise the delivery gate on the fixture, even in a selective deployment.
  const decision = gate ? await runSyncEvaluationGate({ ...env, EVAL_GATE_ENABLED: 'true' }, params) : null;
  const result = gate ? decision.evalResult : await runEvaluation(env, params);
  const grade = gate ? result : finishReadingEvaluation(env, params, result, params.narrativeMetrics);
  const modelAccepted = gate ? decision.eval_source === 'ai' : grade?.mode !== 'heuristic' && !grade?.error;
  if (modelAccepted && grade?.scores) {
    record({ slot: 0, outcome: 'accepted', reportedModel: grade.modelSource === 'reported' ? grade.model : null, effortSent: grade.effortSent });
    return { excerpt: gate ? (decision.passed ? 'Passed the delivery gate.' : 'The delivery gate blocked the sample reading.')
      : JSON.stringify(grade.scores, null, 2) };
  }
  record({ slot: 0, outcome: env.AI ? 'failed' : 'skipped', reason: env.AI ? 'evaluation_unavailable' : 'unconfigured' });
  if (gate) return { outcome: 'failed', excerpt: decision.passed
    ? 'The configured gate model was unavailable. The deployment policy allowed delivery.'
    : 'The configured gate model was unavailable. The deployment policy blocked delivery.' };
  record({ slot: 1, providerId: 'local-heuristic', outcome: 'accepted' });
  return { outcome: 'local_fallback', excerpt: JSON.stringify(grade.scores, null, 2) };
}

const RUNNERS = {
  'guided-questions': sampleQuestion, 'reading-followups': sampleFollowUp, 'journal-summaries': sampleSummary,
  'coach-action-extraction': sampleExtraction, 'reading-evaluation': sampleGrade, 'quality-gate': sampleGrade
};

// The fixtures use adapter functions directly. They have no reader, memory tools,
// persistence bindings, gateway analytics, journal lookups or feature reservations.
export async function runTextFeatureSample({ env, featureId, policy, signal, requestId }) {
  const run = RUNNERS[featureId];
  if (!run) throw new Error('Unknown text sample feature');
  if (['reading-followups', 'journal-summaries'].includes(featureId) && isPersonalTextProviderEnabled(env)) {
    return { outcome: 'failed', attempts: [], excerpt: 'Public text routing is unavailable in owner subscription mode.' };
  }
  env = withTextPolicy({ ...env, DB: null, METRICS_DB: null, EVAL_GATEWAY_ID: null, OPENAI_RESPONSES_USER: null }, featureId, policy);
  const steps = [policy.primary, ...policy.fallbacks];
  const attempts = [];
  const record = ({ slot, providerId = steps[slot]?.providerId, phase, outcome, reason, reportedModel, effortSent }) => {
    const step = steps[slot];
    const attempt = { slot, providerId, outcome };
    if (phase) attempt.phase = phase;
    if (reason) attempt.reason = reason;
    if (step?.modelId && step.providerId === providerId) {
      const reported = normalizeInferenceIdentifier(reportedModel);
      attempt.modelId = reported || step.modelId;
      attempt.modelSource = reported ? 'reported' : 'configured';
      if (outcome !== 'skipped') {
        // An explicit null means the adapter omitted the effort from its payload.
        attempt.effortSent = effortSent === undefined
          ? step.reasoningEffort || defaultSampleEffort(env, featureId, providerId)
          : effortSent;
      }
    }
    attempts.push(attempt);
    return attempt;
  };
  const deadline = createDeadline({ signal, timeoutMs: getTaskTimeoutMs(env) });
  try {
    const result = await run({ env, featureId, policy, requestId, signal: deadline.signal, record });
    deadline.signal.throwIfAborted();
    const accepted = attempts.find(attempt => attempt.outcome === 'accepted');
    return {
      outcome: result.outcome || (accepted?.slot === 0 ? 'primary_accepted' : 'fallback_accepted'),
      attempts, excerpt: result.excerpt.slice(0, 1500)
    };
  } catch (error) {
    if (!attempts.length) record({ slot: 0, outcome: 'failed', reason: inferAttemptReason(error, deadline.signal) });
    return { outcome: 'failed', attempts, excerpt: 'The draft could not complete this sample.' };
  } finally {
    deadline.dispose();
  }
}

function defaultSampleEffort(env, featureId, providerId) {
  if (providerId === 'modal-qwen') return env.MODAL_REASONING_EFFORT || 'high';
  if (featureId === 'journal-summaries' || providerId === 'claude-api') return 'medium';
  if (featureId === 'guided-questions') return env.QUESTION_REASONING_EFFORT || 'high';
  if (featureId === 'reading-evaluation') return env.EVAL_REASONING_EFFORT || 'low';
  if (featureId === 'quality-gate') return env.EVAL_GATE_REASONING_EFFORT || 'low';
  return 'low';
}
