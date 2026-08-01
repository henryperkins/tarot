export const CARD_ASPECT = 2 / 3;

export const SPREAD_LAYOUTS = {
  single: {
    positions: [
      { x: 50, y: 50, scale: 1.2 }
    ]
  },
  threeCard: {
    positions: [
      { x: 20, y: 50, label: 'Past' },
      { x: 50, y: 50, label: 'Present' },
      { x: 80, y: 50, label: 'Future' }
    ]
  },
  fiveCard: {
    positions: [
      { x: 50, y: 20, label: 'Core' },
      { x: 20, y: 50, label: 'Challenge' },
      { x: 50, y: 50, label: 'Hidden' },
      { x: 80, y: 50, label: 'Support' },
      { x: 50, y: 80, label: 'Direction' }
    ]
  },
  decision: {
    positions: [
      { x: 50, y: 22, label: 'Heart' },
      { x: 20, y: 50, label: 'Path A' },
      { x: 80, y: 50, label: 'Path B' },
      { x: 40, y: 78, label: 'Clarity' },
      { x: 60, y: 78, label: 'Free Will' }
    ]
  },
  relationship: {
    positions: [
      { x: 30, y: 50, label: 'You' },
      { x: 70, y: 50, label: 'Them' },
      { x: 50, y: 75, label: 'Connection' },
      { x: 25, y: 22, label: 'Dynamics' },
      { x: 75, y: 22, label: 'Outcome' }
    ]
  },
  celtic: {
    positions: [
      { x: 35, y: 50, label: 'Present' },
      { x: 35, y: 50, label: 'Challenge', rotate: 90, offsetX: 3 },
      { x: 12, y: 50, label: 'Past' },
      { x: 58, y: 50, label: 'Near Future' },
      { x: 35, y: 12, label: 'Conscious' },
      { x: 35, y: 88, label: 'Subconscious' },
      { x: 82, y: 88, label: 'Self/Advice' },
      { x: 82, y: 62.67, label: 'External' },
      { x: 82, y: 37.33, label: 'Hopes/Fears' },
      { x: 82, y: 12, label: 'Outcome' }
    ],
    allowOverlap: [[0, 1]]
  }
};

/**
 * Handset substitutions for spreads the desktop geometry cannot fit legibly on a
 * narrow board. Position order and labels mirror `SPREAD_LAYOUTS` exactly so the
 * numbering, roles and narrative contracts are unchanged.
 */
export const COMPACT_SPREAD_LAYOUTS = {
  celtic: {
    // Cross as a compact plus over a single horizontal staff row. Four card rows
    // spaced a quarter of the square board apart, so the board height rather
    // than the crossing card sets the card size.
    positions: [
      { x: 50, y: 37.5, label: 'Present' },
      { x: 50, y: 37.5, label: 'Challenge', rotate: 90 },
      { x: 22, y: 37.5, label: 'Past' },
      { x: 78, y: 37.5, label: 'Near Future' },
      { x: 50, y: 12.5, label: 'Conscious' },
      { x: 50, y: 62.5, label: 'Subconscious' },
      { x: 12.5, y: 87.5, label: 'Self/Advice' },
      { x: 37.5, y: 87.5, label: 'External' },
      { x: 62.5, y: 87.5, label: 'Hopes/Fears' },
      { x: 87.5, y: 87.5, label: 'Outcome' }
    ],
    allowOverlap: [[0, 1]]
  }
};

export function getSpreadLayout(spreadKey, { isHandset = false } = {}) {
  if (isHandset && COMPACT_SPREAD_LAYOUTS[spreadKey]) {
    return COMPACT_SPREAD_LAYOUTS[spreadKey];
  }
  return SPREAD_LAYOUTS[spreadKey] || SPREAD_LAYOUTS.single;
}

const toFiniteNumber = (value, fallback) => (
  Number.isFinite(value) ? value : fallback
);

const getPositionGeometry = (position, bounds) => {
  const scale = Number.isFinite(position?.scale) && position.scale > 0
    ? position.scale
    : 1;
  const rotation = toFiniteNumber(position?.rotate, 0) * (Math.PI / 180);
  const cos = Math.abs(Math.cos(rotation));
  const sin = Math.abs(Math.sin(rotation));
  const xPercent = toFiniteNumber(position?.x, 50) + toFiniteNumber(position?.offsetX, 0);
  const yPercent = toFiniteNumber(position?.y, 50) + toFiniteNumber(position?.offsetY, 0);

  return {
    x: (xPercent / 100) * bounds.width,
    y: (yPercent / 100) * bounds.height,
    // Width is relative to card width; height is relative to card height.
    effectiveWidth: scale * (cos + (sin / CARD_ASPECT)),
    effectiveHeight: scale * (cos + (sin * CARD_ASPECT))
  };
};

const hasAllowedOverlap = (allowOverlap, leftIndex, rightIndex) => (
  allowOverlap.some((pair) => (
    Array.isArray(pair) &&
    ((pair[0] === leftIndex && pair[1] === rightIndex) ||
      (pair[0] === rightIndex && pair[1] === leftIndex))
  ))
);

export function getMaxCardWidth(layout, bounds, allowOverlap = []) {
  const width = bounds?.width;
  const height = bounds?.height;
  if (!Array.isArray(layout) || layout.length === 0) return null;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;

  const positions = layout.map((position) => getPositionGeometry(position, { width, height }));
  let maxWidth = Infinity;

  positions.forEach((position) => {
    const xEdge = Math.max(0, Math.min(position.x, width - position.x));
    const yEdge = Math.max(0, Math.min(position.y, height - position.y));
    const horizontalLimit = (2 * xEdge) / position.effectiveWidth;
    const verticalLimit = ((2 * yEdge) / position.effectiveHeight) * CARD_ASPECT;
    maxWidth = Math.min(maxWidth, horizontalLimit, verticalLimit);
  });

  for (let leftIndex = 0; leftIndex < positions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < positions.length; rightIndex += 1) {
      if (hasAllowedOverlap(allowOverlap, leftIndex, rightIndex)) continue;

      const left = positions[leftIndex];
      const right = positions[rightIndex];
      const separationX = Math.abs(left.x - right.x);
      const separationY = Math.abs(left.y - right.y);
      const horizontalLimit = (2 * separationX) / (left.effectiveWidth + right.effectiveWidth);
      const verticalLimit = (
        (2 * separationY) / (left.effectiveHeight + right.effectiveHeight)
      ) * CARD_ASPECT;
      maxWidth = Math.min(maxWidth, Math.max(horizontalLimit, verticalLimit));
    }
  }

  return Number.isFinite(maxWidth) ? Math.max(0, maxWidth) : null;
}
