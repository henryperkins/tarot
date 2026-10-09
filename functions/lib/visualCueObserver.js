/**
 * Visual Cue Observer
 *
 * Observes accepted outgoing prose after ReadingJob.appendEvent or JSON completion
 * and dispatches immutable snapshots to the separate ReadingVisualJob Durable Object.
 *
 * Global constraints:
 * - Annotation work cannot gate prose delivery, narrative completion, or saving.
 * - Dispatch to the visual job without awaiting model work.
 * - If final fullText replaces already delivered text, the caller passes an incremented
 *   sourceRevision on the visualBinding.
 */

import { initVisualJob } from './readingVisualJobs.js';

export async function observeDeliveredReading({
  env,
  binding,
  init = null,
  raw,
  deliveredEventId,
  complete = false,
  availableAt = Date.now()
}) {
  if (!env?.READING_VISUAL_JOBS || !binding?.readingResultId || typeof raw !== 'string') {
    return { ok: false, ignored: true };
  }

  const stub = env.READING_VISUAL_JOBS.get(
    env.READING_VISUAL_JOBS.idFromName(binding.readingResultId)
  );

  try {
    if (init) {
      const initialized = await initVisualJob({ env, ...init });
      if (!initialized.ok) return initialized;
    }
    const response = await stub.fetch('https://reading-visual-jobs/observe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        binding,
        raw,
        deliveredEventId,
        complete: Boolean(complete),
        availableAt
      })
    });
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, error: 'Visual observation is temporarily unavailable.' };
  }
}
