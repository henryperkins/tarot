/**
 * Select the appropriate stats map for the Card Gallery.
 * - If analytics is disabled, return an empty map.
 * - If unauthenticated, never surface remote stats (avoid cross-account leakage).
 * - Otherwise prefer remote stats when present, falling back to local.
 *
 * @param {Object} params
 * @param {boolean} params.isAuthenticated
 * @param {boolean} params.analyticsDisabled
 * @param {Object|null} params.remoteStats
 * @param {Object|null} params.localStats
 * @returns {Object}
 */
export function pickStats({ isAuthenticated, analyticsDisabled, remoteStats, localStats }) {
  if (analyticsDisabled) return {};
  const safeLocal = localStats || {};
  if (!isAuthenticated) return safeLocal;

  const hasRemote = remoteStats && Object.keys(remoteStats).length > 0;
  return hasRemote ? remoteStats : safeLocal;
}

/**
 * Compute loading state for the Card Gallery.
 * - If analytics is disabled, never show loading.
 * - If unauthenticated, only depend on journal loading.
 * - If authenticated and remote stats already exist, loading mirrors remote fetch.
 * - Otherwise, wait on either remote fetch or journal load (for local fallback).
 *
 * @param {Object} params
 * @param {boolean} params.isAuthenticated
 * @param {boolean} params.analyticsDisabled
 * @param {Object|null} params.remoteStats
 * @param {boolean} params.remoteLoading
 * @param {boolean} params.journalLoading
 * @returns {boolean}
 */
export function computeGalleryLoading({
  isAuthenticated,
  analyticsDisabled,
  remoteStats,
  remoteLoading,
  journalLoading
}) {
  if (analyticsDisabled) return false;
  if (!isAuthenticated) return journalLoading;

  const hasRemote = remoteStats && Object.keys(remoteStats).length > 0;
  if (hasRemote) return remoteLoading;

  return remoteLoading || journalLoading;
}
