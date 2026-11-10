/** Provisional Gate 1 budgets. Always solve from natural sizes, including
 * controls currently in flow, so an orientation/text change can restore them. */
export function resolveAppChrome({ visibleHeight, headerHeight, actionsHeight, dockHeight, safeBottom = 0, secondaryHeights = [], prioritizeActions = false }) {
  const limit = visibleHeight * (visibleHeight < 500 ? 0.25 : 0.4);
  const bottomLimit = visibleHeight * 0.25;
  let actionsPinned = actionsHeight > 0;
  let dockPinned = dockHeight > 0;
  let headerPinned = true;
  const secondaryPinned = secondaryHeights.map(height => height > 0);
  const bottom = () => (actionsPinned ? actionsHeight : 0) + (dockPinned ? dockHeight : 0)
    + (actionsPinned || dockPinned ? safeBottom + 1 : 0);
  const total = () => bottom() + (headerPinned ? headerHeight : 0)
    + secondaryHeights.reduce((sum, height, index) => sum + (secondaryPinned[index] ? height : 0), 0);
  // Keeping or discussing a completed reading takes precedence over contents
  // and card rails. The bottom budget still wins when controls cannot fit.
  if (prioritizeActions && bottom() <= bottomLimit) {
    for (let index = 0; index < secondaryPinned.length && total() > limit; index++) secondaryPinned[index] = false;
  }
  if (bottom() > bottomLimit || total() > limit) actionsPinned = false;
  for (let index = 0; index < secondaryPinned.length && total() > limit; index++) secondaryPinned[index] = false;
  if (total() > limit) headerPinned = false;
  if (bottom() > bottomLimit || total() > limit) dockPinned = false;
  return { actionsPinned, dockPinned, headerPinned, secondaryPinned, bottomHeight: bottom() };
}
