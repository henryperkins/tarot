/** The native preview supports prose jobs and saved ledgers. A distributed
 * visual-job runner has not been ported; configuration cannot silently enable
 * model dispatch without its ownership, replay and lifetime guarantees. */
export function applySpacefastFeatureProfile(env) {
  return {
    ...env,
    READING_VISUAL_JOBS: undefined,
    VISUAL_CUE_ALLOWED_TIERS: '[]',
    VISUAL_CUE_PROVIDER: '',
    VISUAL_CUE_MODEL: ''
  };
}
