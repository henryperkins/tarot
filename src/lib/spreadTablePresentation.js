const SPREAD_TABLE_BASE_CLASS = 'spread-table relative w-full';

const SPREAD_TABLE_PANEL_BACKGROUND = `
  radial-gradient(circle at 0% 18%, var(--glow-gold), transparent 40%),
  radial-gradient(circle at 100% 0%, var(--glow-blue), transparent 38%),
  radial-gradient(circle at 52% 115%, var(--glow-pink), transparent 46%),
  linear-gradient(135deg, var(--panel-dark-1), var(--panel-dark-2) 55%, var(--panel-dark-3))
`;

const SPREAD_TABLE_PANEL_BOX_SHADOW = '0 24px 64px -40px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.03)';

/**
 * Resolve spread table container presentation.
 *
 * @param {Object} options
 * @param {boolean} options.cardsOnly
 * @param {boolean} options.compact
 * @param {string} options.aspectRatio
 * @returns {{ className: string, style: Object }}
 */
export function getSpreadTableContainerPresentation({
  cardsOnly = false,
  compact = false,
  aspectRatio = '3/2'
} = {}) {
  if (cardsOnly) {
    return {
      className: SPREAD_TABLE_BASE_CLASS,
      style: { aspectRatio }
    };
  }

  return {
    className: `${SPREAD_TABLE_BASE_CLASS} panel-mystic rounded-2xl sm:rounded-3xl border overflow-hidden ${compact ? 'p-3' : 'p-4 sm:p-6'}`,
    style: {
      aspectRatio,
      background: SPREAD_TABLE_PANEL_BACKGROUND,
      borderColor: 'var(--border-warm)',
      boxShadow: SPREAD_TABLE_PANEL_BOX_SHADOW
    }
  };
}

export default getSpreadTableContainerPresentation;
