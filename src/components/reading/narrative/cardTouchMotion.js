/**
 * Motion helpers for the reading's card gestures, kept free of React and the
 * DOM's layout so they can be tested in Node.
 *
 * - lensFor: where a card's artwork leans in to show described details.
 * - createTraceEngine: paces described details into one gesture at a time.
 */

// The described detail should fill about this much of the frame, without
// leaning in so far that the card stops reading as the reader's card.
const DETAIL_SHARE = 0.58;
const MIN_ZOOM = 1.3;
const MAX_ZOOM = 1.9;
// The painted scene inside the printed border, numeral and title band: a view
// that leans in stays on the picture rather than the lettering.
const PICTURE = { left: 0.04, right: 0.96, top: 0.05, bottom: 0.905 };

// Height over width of the deck's card frame ("16 / 31" is a Marseille card).
export function frameRatio(frame) {
  const [width, height] = String(frame || '').split('/').map(Number);
  return width > 0 && height > 0 ? height / width : 1.72;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Where the card's artwork should lean in so the traced spots fill the frame,
 * as a CSS scale and a translation in percent of the frame. The picture always
 * covers the frame: near an edge the view stops at the edge.
 */
export function lensFor(spots, ratio = 1.72) {
  if (!spots.length) return null;
  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;
  for (const [x, y, r] of spots) {
    minX = Math.min(minX, x - r);
    maxX = Math.max(maxX, x + r);
    minY = Math.min(minY, y - r / ratio);
    maxY = Math.max(maxY, y + r / ratio);
  }
  const cx = clamp((minX + maxX) / 2, 0, 1);
  const cy = clamp((minY + maxY) / 2, 0, 1);
  const zoom = clamp(Math.min(DETAIL_SHARE / Math.max(maxX - minX, 0.01), DETAIL_SHARE / Math.max(maxY - minY, 0.01)), MIN_ZOOM, MAX_ZOOM);
  // Keep the view's window on the painted scene when it fits there.
  const half = 0.5 / zoom;
  const viewX = PICTURE.right - PICTURE.left >= half * 2 ? clamp(cx, PICTURE.left + half, PICTURE.right - half) : cx;
  const viewY = PICTURE.bottom - PICTURE.top >= half * 2 ? clamp(cy, PICTURE.top + half, PICTURE.bottom - half) : cy;
  const room = (zoom - 1) / 2;
  const tx = clamp((0.5 - viewX) * zoom, -room, room);
  const ty = clamp((0.5 - viewY) * zoom, -room, room);
  return {
    zoom: Number(zoom.toFixed(3)),
    tx: `${(tx * 100).toFixed(2)}%`,
    ty: `${(ty * 100).toFixed(2)}%`
  };
}

// A traced detail stays in view at least this long before the next one.
export const TRACE_MIN_MS = 1500;
// With nothing new to show, the card settles back to the whole picture.
export const TRACE_HOLD_MS = 3200;
// A tapped detail stays in view a little longer.
export const TRACE_PIN_MS = 4200;
// Scrolling quickly shouldn't queue a slideshow: only the latest details wait.
const TRACE_QUEUE_LIMIT = 2;
// Details of one card reached together ("pours water into the pool") are
// shown together, framed in one view, up to this many.
export const TRACE_TOGETHER_MS = 450;
const TRACE_TOGETHER_MAX = 2;

function sameTrace(a, b) {
  return Boolean(a && b && a.card === b.card && a.points.join('+') === b.points.join('+'));
}

function markTracing(entry, value) {
  for (const item of [entry, ...(entry?.extra || [])]) {
    const element = item?.element;
    if (!element?.isConnected) continue;
    if (value) element.setAttribute('data-tracing', 'true');
    else element.removeAttribute('data-tracing');
  }
}

function markTraced(entry) {
  entry?.element?.setAttribute?.('data-traced', 'true');
}

/**
 * Paces described details into one gesture at a time. `publish` receives the
 * trace to show (or null to let the card rest).
 */
export function createTraceEngine(publish, now = () => Date.now()) {
  let current = null;
  let since = 0;
  let queue = [];
  let timer = 0;
  let serial = 0;

  const emit = () => {
    publish(current ? {
      key: `${serial}:${current.card}:${current.points.join('+')}`,
      card: current.card,
      points: current.points,
      pinned: Boolean(current.pinned)
    } : null);
  };
  const wait = (ms) => {
    clearTimeout(timer);
    timer = setTimeout(advance, ms);
  };
  const show = (entry) => {
    clearTimeout(timer);
    markTracing(current, false);
    current = entry;
    since = now();
    if (entry) {
      serial += 1;
      markTracing(entry, true);
      markTraced(entry);
      // Waiting details follow once this one has had its moment.
      wait(entry.pinned ? TRACE_PIN_MS : (queue.length ? TRACE_MIN_MS : TRACE_HOLD_MS));
    }
    emit();
  };
  function advance() {
    show(queue.shift() || null);
  }

  return {
    /**
     * The reader reached a described detail. Plays now if the card is
     * resting, otherwise after the current detail has had its moment.
     */
    reach({ card, points, element = null }) {
      if (!Number.isInteger(card) || !Array.isArray(points) || points.length === 0) return;
      const entry = { card, points, element };
      if (sameTrace(current, entry)) {
        // The same detail again (re-entering the line): keep it in view.
        markTracing(entry, true);
        if (!current.pinned) wait(TRACE_HOLD_MS);
        return;
      }
      if (queue.some((queued) => sameTrace(queued, entry))) return;
      if (
        current && !current.pinned && current.card === card
        && now() - since < TRACE_TOGETHER_MS
        && current.points.length < TRACE_TOGETHER_MAX
      ) {
        current = {
          ...current,
          points: Array.from(new Set([...current.points, ...points])).slice(0, TRACE_TOGETHER_MAX),
          extra: [...(current.extra || []), entry]
        };
        markTracing(current, true);
        markTraced(entry);
        wait(TRACE_HOLD_MS);
        emit();
        return;
      }
      queue.push(entry);
      while (queue.length > TRACE_QUEUE_LIMIT) queue.shift();
      if (!current) {
        advance();
      } else if (!current.pinned) {
        wait(Math.max(0, TRACE_MIN_MS - (now() - since)));
      }
    },
    /** A tap or hover asks for one detail directly; it jumps the queue. */
    inspect({ card, points, element = null }) {
      if (!Number.isInteger(card) || !Array.isArray(points) || points.length === 0) return;
      queue = [];
      show({ card, points, element, pinned: true });
    },
    release() {
      if (!current?.pinned) return;
      queue = [];
      show(null);
    },
    clear() {
      queue = [];
      show(null);
    },
    dispose() {
      clearTimeout(timer);
      queue = [];
      markTracing(current, false);
      current = null;
    }
  };
}
