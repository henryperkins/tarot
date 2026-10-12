/**
 * Motion helpers for the reading's card gestures, kept free of React and the
 * DOM's layout so they can be tested in Node.
 *
 * - lensFor: where a card's artwork leans in to show described details.
 * - createTraceEngine: paces described details into one gesture at a time.
 * - createHold: keeps one value lit for a while.
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

// Each described detail has its turn, in reading order, for at least this
// long before the next one (the same 1.8 s turn as the reading's other cues).
export const TRACE_TURN_MS = 1800;
// With nothing new to show, the card settles back to the whole picture.
export const TRACE_HOLD_MS = 3200;
// Details of one card reached together ("pours water into the pool") are
// shown together, framed in one view, up to this many.
export const TRACE_TOGETHER_MS = 450;
const TRACE_TOGETHER_MAX = 2;

function sameTrace(a, b) {
  if (a?.occurrenceKey && b?.occurrenceKey) return a.occurrenceKey === b.occurrenceKey;
  return Boolean(a && b && a.card === b.card && a.points.join('+') === b.points.join('+'));
}

function fragments(entry) {
  return entry?.elements || (entry?.element ? [entry.element] : []);
}

function markTracing(entry, value) {
  for (const item of [entry, ...(entry?.extra || [])]) {
    for (const element of fragments(item)) {
      if (!element?.isConnected) continue;
      if (value && element.getAttribute?.('data-tracing') !== 'true') element.setAttribute('data-tracing', 'true');
      else if (!value && element.hasAttribute?.('data-tracing')) element.removeAttribute('data-tracing');
    }
  }
}

function markTraced(entry) {
  for (const item of [entry, ...(entry?.extra || [])]) {
    for (const element of fragments(item)) element.setAttribute?.('data-traced', 'true');
  }
}

// A detail the reader chose stays pressed while it is held.
function markPressed(entry, value) {
  const element = entry?.element;
  if (element?.getAttribute?.('role') === 'button') element.setAttribute('aria-pressed', value ? 'true' : 'false');
}

function isDetail({ card, points } = {}) {
  return Number.isInteger(card) && Array.isArray(points) && points.length > 0;
}

/**
 * Paces described details into one gesture at a time.
 *
 * - Details the reader reaches take turns in reading order. One that has left
 *   the screen by its turn is skipped: nothing plays for text the reader has
 *   moved past, and nothing piles up behind the reader.
 * - Pointing at a detail (hover, keyboard focus) shows it while it lasts.
 * - Choosing one (tap, click, Enter) holds it until the reader lets it go:
 *   choosing it again, Escape, or scrolling it out of view.
 *
 * `publish` receives the trace to show, or null to let the card rest.
 * `isVisible(element)` says whether a detail's words are on screen.
 */
export function createTraceEngine(publish, { now = () => Date.now(), isVisible = () => true } = {}) {
  let current = null;
  let since = 0;
  let queue = [];
  let timer = 0;
  let serial = 0;
  const played = new Set();
  let suspended = false;
  let paused = null;
  let pausedElapsed = 0;

  const occurrenceVisible = item => {
    const elements = fragments(item);
    return !elements.length || elements.every(element => element.isConnected !== false && isVisible(element));
  };
  const visible = entry => [entry, ...(entry?.extra || [])].every(occurrenceVisible);
  const emit = () => {
    publish(current ? {
      key: `${serial}:${current.card}:${current.points.join('+')}`,
      card: current.card,
      points: current.points,
      pinned: Boolean(current.pinned),
      held: Boolean(current.held),
      place: current.place || null
    } : null);
  };
  const wait = (ms) => {
    clearTimeout(timer);
    timer = setTimeout(advance, ms);
  };
  const show = (entry, elapsed = 0) => {
    clearTimeout(timer);
    markTracing(current, false);
    if (current?.held) markPressed(current, false);
    current = entry;
    since = now() - elapsed;
    if (entry) {
      serial += 1;
      markTracing(entry, true);
      markTraced(entry);
      if (!entry.pinned) {
        for (const item of [entry, ...(entry.extra || [])]) {
          if (item.occurrenceKey) played.add(item.occurrenceKey);
        }
      }
      if (entry.held) markPressed(entry, true);
      // Attention the reader asked for stays until they let it go; otherwise
      // the next detail follows once this one has had its turn.
      if (!entry.pinned) wait(Math.max(0, (queue.length ? TRACE_TURN_MS : TRACE_HOLD_MS) - elapsed));
    }
    emit();
  };
  const pauseAutomatic = () => {
    if (current && !current.pinned) {
      paused = current;
      pausedElapsed = Math.max(0, now() - since);
    }
  };
  const resumeAutomatic = () => {
    queue = queue.filter(visible);
    const members = paused ? [paused, ...(paused.extra || [])].filter(occurrenceVisible) : [];
    const resume = members.length ? {
      ...members[0],
      points: Array.from(new Set(members.flatMap(member => member.ownPoints || member.points))),
      extra: members.slice(1)
    } : null;
    const elapsed = pausedElapsed;
    paused = null;
    pausedElapsed = 0;
    if (resume && visible(resume)) show(resume, elapsed);
    else advance();
  };
  function advance() {
    if (suspended) return;
    while (queue.length && !visible(queue[0])) queue.shift();
    const next = queue.shift() || null;
    // Nothing left to show: a detail that had its turn early still gets its
    // full moment before the card rests.
    if (!next && current && !current.pinned) {
      const left = TRACE_HOLD_MS - (now() - since);
      if (left > 0) {
        wait(left);
        return;
      }
    }
    show(next);
  }

  return {
    /**
     * The reader reached a described detail. Plays now if the card is
     * resting, otherwise in its turn.
     */
    reach({ key = null, card, points, element = null, elements = element ? [element] : [] } = {}) {
      if (!isDetail({ card, points })) return;
      const entry = { occurrenceKey: key, card, points, ownPoints: points, element, elements };
      // Rebind rendered nodes without replaying an occurrence after a delta.
      const activeOccurrences = [current, ...(current?.extra || [])];
      const existing = [...activeOccurrences, paused, ...(paused?.extra || []), ...queue].find(item => key && item?.occurrenceKey === key);
      if (existing) {
        // Connected fragments coexist (e.g. words split by <strong>); only
        // disconnected nodes are replacements. Treat the whole phrase as one.
        existing.elements = Array.from(new Set([
          ...fragments(existing).filter(node => node.isConnected === true), ...elements
        ]));
        existing.element = element;
        if (played.has(key)) markTraced(entry);
        if (activeOccurrences.includes(existing)) markTracing(existing, true);
        return;
      }
      if (key && played.has(key)) { markTraced(entry); return; }
      if (!visible(entry)) return;
      if (sameTrace(current, entry)) {
        // The same detail again (re-entering the line): keep it in view.
        markTracing(entry, true);
        if (!current.pinned && !queue.length) wait(TRACE_HOLD_MS);
        return;
      }
      if (queue.some((queued) => sameTrace(queued, entry))) return;
      if (
        !suspended && !queue.length && current && !current.pinned && current.card === card
        && now() - since < TRACE_TOGETHER_MS
        && current.points.length < TRACE_TOGETHER_MAX
        && !points.some(point => current.points.includes(point))
      ) {
        current = {
          ...current,
          points: Array.from(new Set([...current.points, ...points])).slice(0, TRACE_TOGETHER_MAX),
          extra: [...(current.extra || []), entry]
        };
        markTracing(current, true);
        markTraced(entry);
        if (key) played.add(key);
        since = now(); // The last member also receives a full turn.
        if (!queue.length) wait(TRACE_HOLD_MS);
        emit();
        return;
      }
      queue.push(entry);
      if (suspended) return;
      if (!current) {
        advance();
      } else if (!current.pinned) {
        wait(Math.max(0, TRACE_TURN_MS - (now() - since)));
      }
    },
    /** Hover or keyboard focus shows one detail while it lasts. */
    inspect({ card, points, element = null, elements = element ? [element] : [] } = {}) {
      if (suspended || !isDetail({ card, points }) || current?.held) return;
      pauseAutomatic();
      show({ card, points, element, elements, pinned: true });
    },
    /** Pointing moved away: details still waiting resume their turns. */
    release() {
      if (!current?.pinned || current.held) return;
      resumeAutomatic();
    },
    /**
     * The reader chose a detail (tap, click, Enter). It stays until they let
     * it go; choosing the held detail again lets it go. Returns whether the
     * detail is now held.
     */
    hold({ card, points, element = null, place = null } = {}) {
      if (suspended || !isDetail({ card, points })) return false;
      if (current?.held && sameTrace(current, { card, points })) {
        resumeAutomatic();
        return false;
      }
      pauseAutomatic();
      show({ card, points, element, place, pinned: true, held: true });
      return true;
    },
    /** Let go of the held detail (Escape, a tap elsewhere). */
    unhold() {
      if (current?.held) resumeAutomatic();
    },
    /** After scrolling: attention on words that left the screen ends. */
    check() {
      queue = queue.filter(visible);
      if (current?.pinned && !visible(current)) resumeAutomatic();
    },
    setSuspended(value) {
      if (suspended === Boolean(value)) return;
      suspended = Boolean(value);
      if (suspended) {
        pauseAutomatic();
        show(null);
      } else {
        resumeAutomatic();
      }
    },
    clear() {
      queue = [];
      played.clear();
      paused = null;
      pausedElapsed = 0;
      show(null);
    },
    dispose() {
      clearTimeout(timer);
      queue = [];
      played.clear();
      paused = null;
      pausedElapsed = 0;
      markTracing(current, false);
      if (current?.held) markPressed(current, false);
      current = null;
    }
  };
}

/**
 * Holds one value for a while, then lets it go: the querent's own words stay
 * lit beside their card for a few seconds after the reading echoes them.
 */
export function createHold(publish, holdMs) {
  let timer = 0;
  return {
    show(value) {
      clearTimeout(timer);
      publish(value);
      timer = setTimeout(() => publish(null), holdMs);
    },
    clear() {
      clearTimeout(timer);
      publish(null);
    },
    dispose() {
      clearTimeout(timer);
    }
  };
}
