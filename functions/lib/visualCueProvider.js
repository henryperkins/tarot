import { z } from 'zod';
import { visualCueProposalSchema, visualCueResponseSchema } from '../../shared/contracts/visualCueBatches.js';
import { createDeadline } from './requestDeadline.js';

// Request the proposal shape, while retaining independent per-proposal runtime
// validation in the ledger. Model-side schema support is not a trust boundary.
const responseSchema = z.toJSONSchema(z.object({
  proposals: z.array(visualCueProposalSchema).max(240)
}).strict(), { target: 'draft-7' });

/** Validate the independent annotation configuration before creating private job state. */
export function visualCueProviderConfigured(env) {
  return typeof env?.VISUAL_CUE_PROVIDER === 'string'
    && env.VISUAL_CUE_PROVIDER.trim() === 'workers-ai'
    && typeof env?.VISUAL_CUE_MODEL === 'string'
    && env.VISUAL_CUE_MODEL.trim().length > 0
    && typeof env?.AI?.run === 'function';
}

/** Independent, explicitly configured annotation only; never a narrative fallback. */
export async function runVisualCueAnnotation({ env, prompt, signal }) {
  const provider = env?.VISUAL_CUE_PROVIDER?.trim();
  const model = env?.VISUAL_CUE_MODEL?.trim();
  if (!provider || !model) throw new Error('Visual model is not configured.');
  if (provider !== 'workers-ai') throw new Error('Unsupported visual model provider.');
  if (typeof env?.AI?.run !== 'function') throw new Error('Visual model binding is unavailable.');
  const glm = model.startsWith('@cf/zai-org/glm-5.');
  const reasoningEffort = env.VISUAL_CUE_REASONING_EFFORT?.trim() || 'low';
  if (glm && !['low', 'high', 'max'].includes(reasoningEffort)) throw new Error('Invalid visual reasoning effort.');
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
