import { runReadingConfigSample } from '../../functions/lib/readingConfigSample.js';
import { runTextFeatureSample } from '../../functions/lib/aiFeatureSamples.js';
import { resolveProviderEnvironment } from '../../functions/lib/providerConnections.js';
import { getTaskTimeoutMs, runWithSignal } from '../../functions/lib/requestDeadline.js';
import { effectiveWorkersEffort } from '../../functions/lib/workersAiReasoning.js';

const retention = 15 * 60 * 1000;
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const failed = reason => ({ status: 'failed', outcome: 'failed', reason });

// During the retention window a pre-rollout receipt can contain an effort alias.
// Interpret it using the model in the submitted draft, including when the
// service reported a different model identifier. Keep the recorded request.
function sampleReceipt(row) {
  if (!row.attempts || !row.policy) return row;
  const steps = [row.policy.primary, ...row.policy.fallbacks];
  const attempts = row.attempts.map(attempt => {
    const step = steps[attempt.slot];
    if (attempt.providerId !== 'workers-ai' || step?.providerId !== 'workers-ai' || !attempt.effortSent) return attempt;
    const effectiveEffort = effectiveWorkersEffort(step.modelId, attempt.effortSent);
    return effectiveEffort === attempt.effortSent ? attempt : { ...attempt, effectiveEffort };
  });
  return { ...row, attempts };
}

// A single object per environment serializes reservations across features.
// Only admin endpoints can reach this binding. Credentials stay in env.
export class AdminAiSamples {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    state.blockConcurrencyWhile(async () => {
      for (const [key, row] of await state.storage.list()) {
        if (row.status === 'running' && row.expiresAt > Date.now()) {
          await state.storage.put(key, { ...row, ...failed('Sample interrupted. Run again to retry.'), expiresAt: Date.now() + retention });
        }
      }
      await this.alarm();
    });
  }

  async fetch(request) {
    const key = new URL(request.url).pathname;
    if (request.method === 'GET') {
      const stored = await this.state.storage.get(key);
      if (!stored || stored.expiresAt <= Date.now()) return json({ code: 'sample_expired', error: 'Sample expired or unavailable.' }, 404);
      return json(sampleReceipt(stored));
    }
    const { policy, ...metadata } = await request.json();
    const { runId, featureId, policyFingerprint, fixtureVersion } = metadata;
    const reservation = await this.state.storage.transaction(async tx => {
      const previous = await tx.get(key);
      if (previous && previous.expiresAt > Date.now()) {
        return previous.policyFingerprint === policyFingerprint && previous.fixtureVersion === fixtureVersion ? 'existing' : 'conflict';
      }
      const rows = await tx.list();
      if ([...rows.values()].filter(row => row.status === 'running' && row.expiresAt > Date.now()).length >= 2) return 'busy';
      await tx.put(key, { ...metadata, policy, requestedPrimary: policy.primary, status: 'running', expiresAt: Date.now() + retention });
      return 'start';
    });
    if (reservation === 'conflict') return json({ code: 'sample_conflict', error: 'Sample identifier belongs to a different draft.' }, 409);
    if (reservation === 'busy') return json({ code: 'sample_capacity', error: 'Two samples are running. Try again shortly.' }, 429);
    if (reservation === 'start') {
      await this.scheduleCleanup();
      this.state.waitUntil(this.execute(key, metadata, policy, featureId, runId));
    }
    return json({ runId }, 202);
  }

  async execute(key, metadata, policy, featureId, runId) {
    const timeout = getTaskTimeoutMs(this.env, featureId === 'readings' ? 'reading' : undefined);
    const signal = AbortSignal.timeout(timeout);
    let result;
    try {
      result = await runWithSignal(async () => {
        const env = await resolveProviderEnvironment(this.env);
        signal.throwIfAborted();
        return featureId === 'readings'
          ? runReadingConfigSample(env, policy, { signal })
          : runTextFeatureSample({ env, featureId, policy, signal, requestId: runId });
      }, signal);
    } catch {
      result = failed(signal.aborted ? 'Sample timed out.' : 'The sample could not be completed.');
    }
    await this.state.storage.put(key, { ...metadata, policy, requestedPrimary: policy.primary, attempts: [], ...result,
      status: result.outcome === 'failed' ? 'failed' : 'completed', expiresAt: Date.now() + retention });
    await this.scheduleCleanup();
  }

  async scheduleCleanup() {
    const rows = await this.state.storage.list();
    if (rows.size) await this.state.storage.setAlarm(Math.min(...[...rows.values()].map(row => row.expiresAt)));
  }

  async alarm() {
    for (const [key, row] of await this.state.storage.list()) {
      if (row.expiresAt <= Date.now()) await this.state.storage.delete(key);
    }
    await this.scheduleCleanup();
  }
}
