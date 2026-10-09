import { z } from 'zod';
import { visualCueProposalSchema, visualCueResponseSchema } from '../../shared/contracts/visualCueBatches.js';
import { createDeadline } from './requestDeadline.js';

// Request the proposal shape, while retaining independent per-proposal runtime
// validation in the ledger. Model-side schema support is not a trust boundary.
const responseSchema = z.toJSONSchema(z.object({
  proposals: z.array(visualCueProposalSchema).max(240)
}).strict(), { target: 'draft-7' });

const configString = value => typeof value === 'string' ? value.trim() : '';
const readinessErrors = {
  missing_provider: 'Visual model is not configured.',
  missing_model: 'Visual model is not configured.',
  unsupported_provider: 'Unsupported visual model provider.',
  missing_ai_binding: 'Visual model binding is unavailable.',
  invalid_effort: 'Invalid visual reasoning effort.'
};

/** Configuration only: never probes inference or gates access to saved cues. */
export function getVisualCueReadiness(env) {
  const provider = configString(env?.VISUAL_CUE_PROVIDER);
  const model = configString(env?.VISUAL_CUE_MODEL);
  if (!provider) return { ready: false, reason: 'missing_provider' };
  if (!model) return { ready: false, reason: 'missing_model' };
  if (provider !== 'workers-ai') return { ready: false, reason: 'unsupported_provider' };
  if (typeof env?.AI?.run !== 'function') return { ready: false, reason: 'missing_ai_binding' };
  const effort = env.VISUAL_CUE_REASONING_EFFORT;
  if (model.startsWith('@cf/zai-org/glm-5.') && (
    (effort != null && typeof effort !== 'string') || !['low', 'high', 'max'].includes(configString(effort) || 'low')
  )) return { ready: false, reason: 'invalid_effort' };
  return { ready: true, reason: null };
}

/** Independent, explicitly configured annotation only; never a narrative fallback. */
export async function runVisualCueAnnotation({ env, prompt, signal }) {
  const readiness = getVisualCueReadiness(env);
  if (!readiness.ready) throw new Error(readinessErrors[readiness.reason]);
  const model = configString(env.VISUAL_CUE_MODEL);
  const glm = model.startsWith('@cf/zai-org/glm-5.');
  const reasoningEffort = configString(env.VISUAL_CUE_REASONING_EFFORT) || 'low';
  const configuredTimeout = Number(env.VISUAL_CUE_TIMEOUT_MS);
  const deadline = createDeadline({ signal, timeoutMs: Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? Math.min(configuredTimeout, 60000) : 30000 });
  try {
    const response = await deadline.run(() => env.AI.run(model, {
      messages: [
        { role: 'system', content: prompt.systemPrompt },
        { role: 'user', content: prompt.userPrompt }
      ],
      stream: false,
      ...(glm ? { max_completion_tokens: 8192, reasoning_effort: reasoningEffort } : { max_tokens: 4096 }),
      temperature: 0,
      response_format: { type: 'json_schema', json_schema: glm
        ? { name: 'visual_cues', schema: responseSchema, strict: true } : responseSchema }
    }, { signal: deadline.signal }));
    deadline.signal.throwIfAborted();
    const raw = response?.response ?? response?.choices?.[0]?.message?.content;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    // Exact JSON only. No extraction from prose/fences, no silent truncation.
    return visualCueResponseSchema.parse(parsed);
  } finally { deadline.dispose(); }
}
