/**
 * Determine whether handset UI should switch to reduced-effects stable mode.
 *
 * @param {Object} options
 * @param {boolean} options.isHandset
 * @param {boolean} options.prefersReducedMotion
 * @param {Navigator|Object|null} [options.navigator]
 * @returns {boolean}
 */
export function shouldUseMobileStableMode({
  isHandset = false,
  prefersReducedMotion = false,
  navigator: navigatorLike = typeof navigator !== 'undefined' ? navigator : null
} = {}) {
  if (!isHandset) return false;
  if (prefersReducedMotion) return true;
  if (!navigatorLike) return false;

  const saveDataEnabled = navigatorLike.connection?.saveData === true;
  const lowMemoryDevice = typeof navigatorLike.deviceMemory === 'number' && navigatorLike.deviceMemory <= 4;
  const lowConcurrencyDevice = typeof navigatorLike.hardwareConcurrency === 'number' && navigatorLike.hardwareConcurrency <= 4;

  return saveDataEnabled || lowMemoryDevice || lowConcurrencyDevice;
}

export default shouldUseMobileStableMode;
