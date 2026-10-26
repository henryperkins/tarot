/**
 * Geometry for the journal's card fan ("Cards drawn").
 *
 * The fan keeps its arc and, when space runs out, its intentional overlap.
 * Card size and spacing come from the width the section actually has:
 * - "labels": each card gets a column wide enough to show its position and
 *   full name underneath, so no name is truncated.
 * - "caption": the spread is too wide for columns, so the cards overlap and
 *   the selected card is named in one caption under the fan.
 * Every rotated card, with room for its focus ring, stays inside the section.
 */

export const FAN_CARD_ASPECT = 1.5;
export const FAN_MAX_CARD_WIDTH = 84;
export const FAN_MIN_LABEL_CARD_WIDTH = 52;
export const FAN_MAX_CAPTION_CARD_WIDTH = 72;
export const FAN_MIN_CARD_WIDTH = 44;
/** Label column limits in root ems, so enlarged text widens the columns. */
export const FAN_MIN_COLUMN_EM = 4.5;
export const FAN_MAX_COLUMN_EM = 7;
/** Space kept clear at the section edges for focus rings and shadows. */
export const FAN_EDGE_PADDING = 8;
/** How far the selected card rises above its neighbours when cards overlap. */
export const FAN_ACTIVE_LIFT = 8;

const CARD_GAP = 12;

const toRadians = (degrees) => (Math.abs(degrees) * Math.PI) / 180;

/** Horizontal reach from the pivot of a card rotated about its bottom centre. */
export function rotatedHalfWidth(width, height, degrees) {
  const angle = toRadians(degrees);
  return (width / 2) * Math.cos(angle) + height * Math.sin(angle);
}

function labelArc(count) {
  return count > 1 ? Math.min(6, 2 * (count - 1)) : 0;
}

function captionArc(count) {
  if (count <= 1) return 0;
  if (count <= 5) return 14;
  return count <= 7 ? 18 : 22;
}

function place(count, { mode, cardWidth, arc, step, rise, column = 0, activeLift = 0 }) {
  const cardHeight = Math.round(cardWidth * FAN_CARD_ASPECT);
  const cards = Array.from({ length: count }, (_, index) => {
    const unit = count > 1 ? (2 * index) / (count - 1) - 1 : 0;
    return {
      x: (index - (count - 1) / 2) * step,
      lift: Math.abs(unit) * rise,
      rotation: unit * arc,
      zIndex: 10 + Math.round((1 - Math.abs(unit)) * count)
    };
  });
  // Cards pivot on their bottom centre: the far top corner rises above the
  // card's height and the near bottom corner dips below the baseline.
  const reachUp = Math.max(...cards.map((card) => card.lift
    + cardHeight * Math.cos(toRadians(card.rotation))
    + (cardWidth / 2) * Math.sin(toRadians(card.rotation))));
  const reachDown = Math.max(0, ...cards.map((card) => (cardWidth / 2) * Math.sin(toRadians(card.rotation)) - card.lift));
  const baseline = Math.ceil(reachDown) + FAN_EDGE_PADDING;
  return {
    mode,
    cardWidth,
    cardHeight,
    step,
    arc,
    column,
    cards,
    baseline,
    height: baseline + Math.ceil(reachUp + activeLift) + FAN_EDGE_PADDING
  };
}

/**
 * @param {Object} options
 * @param {number} options.count - Cards in the spread
 * @param {number} options.width - Inner width of the fan, in CSS pixels
 * @param {number} [options.rootFontPx=16] - Root font size, for label columns
 */
export function computeFanLayout({ count, width, rootFontPx = 16 }) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  if (total === 0) {
    return { mode: 'labels', cardWidth: 0, cardHeight: 0, step: 0, arc: 0, column: 0, cards: [], baseline: 0, height: 0 };
  }
  const inner = Math.max(0, (Number(width) || 0) - 2 * FAN_EDGE_PADDING);
  const fontPx = Number(rootFontPx) > 0 ? Number(rootFontPx) : 16;

  // One column per card, each holding the card with its position and name.
  const column = Math.min(FAN_MAX_COLUMN_EM * fontPx, inner / total);
  if (column >= FAN_MIN_COLUMN_EM * fontPx) {
    const arc = labelArc(total);
    const span = ((total - 1) / 2) * column;
    for (let cardWidth = Math.min(FAN_MAX_CARD_WIDTH, Math.floor(column - CARD_GAP)); cardWidth >= FAN_MIN_LABEL_CARD_WIDTH; cardWidth -= 2) {
      if (span + rotatedHalfWidth(cardWidth, cardWidth * FAN_CARD_ASPECT, arc) <= inner / 2) {
        return place(total, { mode: 'labels', cardWidth, arc, step: total > 1 ? column : 0, rise: total > 1 ? 4 : 0, column });
      }
    }
  }

  // Overlapping fan. Every card keeps a visible edge to tap; the full arc is
  // kept while cards can shrink to a readable size, then the arc flattens.
  const rise = total > 7 ? 18 : 14;
  const maxArc = captionArc(total);
  const caption = (cardWidth, arc) => {
    const room = inner / 2 - rotatedHalfWidth(cardWidth, cardWidth * FAN_CARD_ASPECT, arc);
    if (room < 0) return null;
    const step = total > 1 ? Math.min(cardWidth + CARD_GAP, (2 * room) / (total - 1)) : 0;
    if (total > 1 && step < Math.max(12, cardWidth * (total > 5 ? 0.25 : 0.4))) return null;
    return place(total, { mode: 'caption', cardWidth, arc, step, rise: total > 1 ? rise : 0, activeLift: FAN_ACTIVE_LIFT });
  };
  for (let cardWidth = FAN_MAX_CAPTION_CARD_WIDTH; cardWidth >= FAN_MIN_LABEL_CARD_WIDTH; cardWidth -= 2) {
    const layout = caption(cardWidth, maxArc);
    if (layout) return layout;
  }
  for (let arc = maxArc - 2; arc >= 4; arc -= 2) {
    for (let cardWidth = FAN_MAX_CAPTION_CARD_WIDTH; cardWidth >= FAN_MIN_CARD_WIDTH; cardWidth -= 2) {
      const layout = caption(cardWidth, arc);
      if (layout) return layout;
    }
  }

  // Narrowest sections: the smallest cards on a shallow arc, as close as needed.
  const cardWidth = FAN_MIN_CARD_WIDTH;
  const arc = Math.min(4, captionArc(total));
  const room = Math.max(0, inner / 2 - rotatedHalfWidth(cardWidth, cardWidth * FAN_CARD_ASPECT, arc));
  const step = total > 1 ? (2 * room) / (total - 1) : 0;
  return place(total, { mode: 'caption', cardWidth, arc, step, rise: total > 1 ? 8 : 0, activeLift: FAN_ACTIVE_LIFT });
}
