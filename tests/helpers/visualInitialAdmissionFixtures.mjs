import { createVisualInitialAdmission } from '../../functions/lib/readingVisualAdmission.js';

/** Offline test values only; these are not rollout amounts or model pricing. */
export function initialVisualLimits(env, overrides = {}) {
  return JSON.stringify({
    provider: env.VISUAL_CUE_PROVIDER,
    model: env.VISUAL_CUE_MODEL,
    rateLimit: 100, windowMs: 60000, totalLimit: 100,
    globalRateLimit: 100, globalTotalLimit: 100,
    maxDispatchCostMicrousd: 100, scopeCostLimitMicrousd: 10000, globalCostLimitMicrousd: 10000,
    ...overrides
  });
}

export function withInitialVisualAdmission(env, overrides = {}) {
  return { ...env, VISUAL_INITIAL_LIMITS: initialVisualLimits(env, overrides),
    VISUAL_INITIAL_TRUSTED_IDENTITY: { resolve: () => 'controlled-offline-edge' } };
}

export function admitInitialVisualFixture(env, { binding, visualToken, ownerUserId = null }) {
  return createVisualInitialAdmission({ env, binding, visualToken,
    userId: ownerUserId, readingResultId: binding.readingResultId });
}
