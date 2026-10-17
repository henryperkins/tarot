import { getVisualCueReadiness } from './visualCueProvider.js';

/** Replay allowances are explicit operator configuration, never tier guesses. */
export function getVisualReplayLimits(env) {
  let limits;
  try { limits = JSON.parse(env?.VISUAL_REPLAY_LIMITS); } catch { return null; }
  return limits && ['rateLimit', 'windowMs', 'totalLimit'].every(key => Number.isSafeInteger(limits[key]) && limits[key] > 0)
    ? limits : null;
}

/** Configuration only: reading saved cues never probes or reserves inference. */
export function getVisualReplayReadiness(env) {
  return !!(env?.DB && env.READING_VISUAL_JOBS && getVisualReplayLimits(env) && getVisualCueReadiness(env).ready);
}

/** Stronger work states and cached snapshots survive configuration changes. */
export function projectVisualReplayReadiness(state, env) {
  // Existing pending work needs only its observation transport, not new-call
  // provider or allowance configuration. Keep its durable work state intact.
  if (state && !env?.READING_VISUAL_JOBS && (state.retryStatus === 'pending'
    || (state.retryStatus === 'unavailable' && state.attachmentStatus === 'pending'))) {
    return { ...state, reason: 'configuration-unavailable' };
  }
  if (!state || !['available', 'unavailable'].includes(state.retryStatus)
    || !['missing', 'failed', 'expired'].includes(state.attachmentStatus) || getVisualReplayReadiness(env)) return state;
  return { ...state, retryStatus: 'unavailable', reason: 'configuration-unavailable' };
}
