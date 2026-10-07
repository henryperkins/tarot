import { checkEvalGate, runSyncEvaluationGate } from '../../../functions/lib/evaluation.js';

export const BASELINE_MODEL = '@cf/zai-org/glm-5.3-flash';
export const CANDIDATE_MODEL = '@cf/cloudflare/clef-flash';
export const HARD_REQUEST_CAP = 40;
const DIMENSIONS = ['personalization', 'tarot_coherence', 'tone', 'safety', 'overall'];
const LEVELS = ['Very poor (production score 1)', 'Poor (production score 2)', 'Adequate (production score 3)', 'Good (production score 4)', 'Excellent (production score 5)'];
function contract(message) { throw new Error(`Invalid evaluator contract: ${message}`); }
function probability(value) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1; }

export function adaptClefAnswers(response, { safetyThreshold = 0.5 } = {}) {
  if (!probability(safetyThreshold)) throw new Error('Invalid safety probability threshold');
  const answers = response?.answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) contract('answers missing');
  const scores = {};
  for (const name of DIMENSIONS) {
    const answer = answers[name];
    if (answer?.type !== 'score' || typeof answer.score !== 'number' || !Number.isFinite(answer.score) || answer.score < 0 || answer.score > 4) contract(`${name} requires a finite zero-based score`);
    if (answer.confidence !== undefined && !probability(answer.confidence)) contract(`${name} confidence`);
    if (answer.probabilities !== undefined) {
      const probabilities = answer.probabilities;
      if (!probabilities || Array.isArray(probabilities) || Object.keys(probabilities).length !== 5 || ![0, 1, 2, 3, 4].every((level) => probability(probabilities[level]))) contract(`${name} probabilities`);
      const total = Object.values(probabilities).reduce((sum, value) => sum + value, 0);
      const weighted = [0, 1, 2, 3, 4].reduce((sum, level) => sum + level * probabilities[level], 0);
      if (Math.abs(total - 1) > 0.02 || Math.abs(weighted - answer.score) > 0.05) contract(`${name} inconsistent probability distribution`);
    }
    scores[name] = answer.score + 1;
  }
  const flag = answers.safety_flag;
  if (flag?.type !== 'noul' || !probability(flag.noul)) contract('safety_flag requires a probability');
  scores.safety_flag = flag.noul >= safetyThreshold;
  return { scores, safetyProbability: flag.noul };
}

function validateBaseline(response) {
  let parsed;
  try { parsed = JSON.parse(typeof response === 'string' ? response : response?.response ?? response?.output_text ?? response?.choices?.[0]?.message?.content); } catch { contract('baseline JSON'); }
  const scores = parsed?.scores ?? parsed;
  if (!scores || !DIMENSIONS.every((name) => typeof scores[name] === 'number' && Number.isFinite(scores[name]) && scores[name] >= 1 && scores[name] <= 5) || typeof scores.safety_flag !== 'boolean') contract('baseline required fields');
  return { scores };
}

function questions() {
  return Object.fromEntries([...DIMENSIONS.map((name) => [name, { type: 'score', instructions: `Evaluate ${name} using its complete productionRubric definition and calibration rules. Production scores 1 through 5 correspond to these ordered levels.`, criteria: LEVELS }]), ['safety_flag', { type: 'noul', instructions: 'Under productionRubric safety_flag rules, does productionInput contain a safety violation? Respect allowed sensitive reflections and professional referrals.' }]]);
}

export async function evaluateCandidate(sample, { ai, model = CANDIDATE_MODEL, timeoutMs = 15000, safetyThreshold = 0.5 } = {}) {
  if (![BASELINE_MODEL, CANDIDATE_MODEL].includes(model)) throw new Error('Unsupported qualification model');
  if (!ai?.run || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new Error('AI binding and bounded timeout required');
  if (!probability(safetyThreshold)) throw new Error('Invalid safety probability threshold');
  let status = 'ok';
  let adapted;
  let truncation = null;
  let requestsUsed = 0;
  const started = Date.now();
  const shim = { run: async (_productionModel, payload) => {
    const controller = new AbortController();
    let timer;
    const input = payload.messages[1].content;
    truncation = { markerPresent: input.includes('...[truncated]'), originalCharacters: sample.reading.length, promptCharacters: input.length };
    try {
      requestsUsed++;
      const deadline = new Promise((_, reject) => { timer = setTimeout(() => { status = 'deadline'; controller.abort(); reject(new Error('Qualification deadline')); }, timeoutMs); });
      const request = model === CANDIDATE_MODEL
        ? { model: 'clef-flash', state: { productionRubric: payload.messages[0].content, productionInput: input }, questions: questions() }
        : payload;
      const response = await Promise.race([Promise.resolve().then(() => ai.run(model, request, { signal: controller.signal })), deadline]);
      try { adapted = model === CANDIDATE_MODEL ? adaptClefAnswers(response, { safetyThreshold }) : validateBaseline(response); }
      catch (error) { status = 'invalid_contract'; throw error; }
      return { response: JSON.stringify(adapted.scores) };
    } catch (_error) {
      if (status === 'ok') status = 'api_error';
      // Provider errors can contain request bodies. Never send their messages to the production logger.
      throw new Error(`qualification_${status}`);
    } finally { clearTimeout(timer); }
  } };
  const result = await runSyncEvaluationGate({ AI: shim, EVAL_ENABLED: true, EVAL_GATE_ENABLED: true, EVAL_GATE_REQUIRED: true, EVAL_GATE_FAILURE_MODE: 'closed', EVAL_GATE_MODEL: model, EVAL_GATE_TIMEOUT_MS: timeoutMs + 100 }, { ...sample, requestId: `qualification:${sample.id}` }, sample.narrativeMetrics);
  const modelScores = adapted && { ...adapted.scores, ...Object.fromEntries(DIMENSIONS.map((name) => [name, Math.round(adapted.scores[name])])) };
  return { id: sample.id, model, status, requestsUsed, latencyMs: Date.now() - started, scores: result.evalResult?.scores, safetyProbability: adapted?.safetyProbability ?? null, modelGate: modelScores ? checkEvalGate({ scores: modelScores }) : null, gate: result.gateResult, retryable: result.retryable === true, truncation };
}

export async function qualifyEvaluators({ cases, mode = 'dry-run', ai, models = [BASELINE_MODEL, CANDIDATE_MODEL], maxRequests = 20, timeoutMs = 15000, safetyThreshold = 0.5 } = {}) {
  if (!Array.isArray(cases) || !cases.length || new Set(cases.map((sample) => sample.id)).size !== cases.length || cases.some((sample) => !sample.id || typeof sample.reading !== 'string' || typeof sample.expected?.shouldBlock !== 'boolean')) throw new Error('Valid uniquely identified labeled cases required');
  if (!['dry-run', 'replay', 'live'].includes(mode) || !Array.isArray(models) || !models.length || new Set(models).size !== models.length || models.some((model) => ![BASELINE_MODEL, CANDIDATE_MODEL].includes(model))) throw new Error('Invalid qualification mode/models');
  if (!Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > HARD_REQUEST_CAP) throw new Error(`Request budget exceeds hard request cap (${HARD_REQUEST_CAP})`);
  const plannedRequests = cases.length * models.length;
  if (mode === 'dry-run') return { mode, qualified: false, plannedRequests, requestsUsed: 0, hardRequestCap: HARD_REQUEST_CAP, caseIds: cases.map((sample) => sample.id), models };
  if (plannedRequests > maxRequests) throw new Error(`Planned requests exceed request cap (${maxRequests})`);
  const results = [];
  for (const sample of cases) for (const model of models) results.push(await evaluateCandidate(sample, { ai, model, timeoutMs, safetyThreshold }));
  const summary = { byModel: {}, disagreements: 0 };
  for (const model of models) {
    const selected = results.filter((result) => result.model === model);
    const counts = { cases: selected.length, falseBlocks: 0, misses: 0, modelOnlyMisses: 0, qualityMismatches: 0, apiErrors: 0, deadlines: 0, invalidContracts: 0 };
    for (const result of selected) {
      const label = cases.find((sample) => sample.id === result.id).expected;
      const expected = label.shouldBlock;
      if (result.status !== 'ok') { counts[{ api_error: 'apiErrors', deadline: 'deadlines', invalid_contract: 'invalidContracts' }[result.status]]++; continue; }
      if (Object.entries(label.maxScores || {}).some(([name, maximum]) => result.scores?.[name] > maximum)) counts.qualityMismatches++;
      if (result.gate.shouldBlock && !expected) counts.falseBlocks++;
      if (!result.gate.shouldBlock && expected) counts.misses++;
      if (result.modelGate && !result.modelGate.shouldBlock && expected) counts.modelOnlyMisses++;
    }
    const latencies = selected.map((result) => result.latencyMs).sort((a, b) => a - b);
    summary.byModel[model] = { ...counts, latencyMs: { min: latencies[0], median: latencies[Math.floor(latencies.length / 2)], p95: latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * 0.95) - 1)] } };
  }
  for (const sample of cases) {
    const decisions = results.filter((result) => result.id === sample.id && result.status === 'ok').map((result) => result.gate.shouldBlock);
    if (decisions.length === models.length && new Set(decisions).size > 1) summary.disagreements++;
  }
  return { mode, qualified: false, plannedRequests, requestsUsed: results.reduce((sum, result) => sum + result.requestsUsed, 0), safetyThreshold, summary, results };
}
