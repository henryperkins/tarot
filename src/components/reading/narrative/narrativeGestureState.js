const ACTIVE_MS = 1800;
const SETTLING_MS = 1500;

export function getCardPresence({ introduction, visibleEnd = 0, inspected = false, reducedMotion = false }) {
  if (inspected) return 1;
  if (!introduction || visibleEnd < introduction.namedEnd) return 0;
  if (reducedMotion) return 1;
  if (introduction.pending) return .035;
  const { start, namedEnd, descriptionStart, midpoint, end } = introduction;
  if (visibleEnd < descriptionStart) {
    return Math.max(0.0001, 0.035 * ((visibleEnd - start) / Math.max(1, descriptionStart - start)) ** 2);
  }
  if (visibleEnd < midpoint) return 0.035 + 0.515 * ((visibleEnd - descriptionStart) / Math.max(1, midpoint - descriptionStart)) ** 2;
  if (visibleEnd < end) return 0.55 + 0.45 * (1 - (1 - (visibleEnd - midpoint) / Math.max(1, end - midpoint)) ** 2);
  return visibleEnd >= namedEnd ? 1 : 0;
}

function withEligibility(state) {
  const blocked = Object.values(state.inspections).some(Boolean);
  const targetsVisible = state.current?.targets.every(({ occurrenceId }) => state.artworkVisibility[occurrenceId] !== false);
  const passageVisible = state.held || state.passageVisibility[state.current?.id] === true;
  return { ...state, canMove: Boolean(state.current && targetsVisible && passageVisible && !blocked && !state.reducedMotion && !['paused', 'error', 'idle'].includes(state.status) && state.phase !== 'static') };
}

const bindingFields = ['readingResultId', 'sourceRevision', 'spreadHash', 'contextHash', 'artworkEdition', 'catalogVersion'];
function sameBinding(left, right) {
  return Boolean(left && right && bindingFields.every(key => left[key] === right[key]));
}

export function createGestureFocusState({ runId, sourceRevision, binding = null, visualBinding, associations = [], introductions = [], completed = false }) {
  return withEligibility({
    runId, sourceRevision, binding: visualBinding ?? binding, ledgerRevision: 0, associations, introductions,
    current: completed ? associations.at(-1) ?? null : null, held: null, pending: null,
    introduced: completed ? introductions.map(({ occurrenceId }) => occurrenceId) : [],
    visibleEnd: completed ? Math.max(0, ...introductions.map(({ end }) => end), ...associations.map(({ passage }) => passage.end)) : 0,
    completed, hydrated: completed, status: completed ? 'complete' : 'streaming', phase: 'static', activeUntil: 0,
    inspections: {}, artworkVisibility: {}, passageVisibility: {}, reducedMotion: false, consumedCueIds: []
  });
}

function consume(state, ids) {
  return { ...state, consumedCueIds: [...new Set([...state.consumedCueIds, ...ids])] };
}

function introducedAt(state, introductions = state.introductions) {
  return [...new Set([...state.introduced, ...introductions.filter(intro => state.visibleEnd >= intro.namedEnd).map(intro => intro.occurrenceId)])];
}

function adopt(state, association, now) {
  return consume({ ...state, current: association, phase: 'active', activeUntil: now + ACTIVE_MS, pending: null }, [association.id]);
}

// Selection uses the full current visibility set, never source order alone or a
// stored playback queue. Consumed candidates retain their explicit revisit UI.
function reconcile(state, now) {
  const consumed = new Set(state.consumedCueIds);
  const candidates = state.associations.filter(({ id, passage }) => passage.end <= state.visibleEnd
    && state.passageVisibility[id] === true && !consumed.has(id))
    .sort((a, b) => a.passage.end - b.passage.end || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const candidate = candidates.at(-1);
  const next = consume({ ...state, pending: null }, candidates.slice(0, -1).map(({ id }) => id));
  if (!candidate) return next;
  const blocked = state.held || Object.values(state.inspections).some(Boolean);
  if (blocked) return { ...next, pending: state.hydrated || state.reducedMotion ? null : candidate.id };
  if (state.hydrated || state.reducedMotion) {
    return consume({ ...next, current: candidate, phase: 'static', activeUntil: 0 }, [candidate.id]);
  }
  if (!['streaming', 'complete'].includes(state.status)) return { ...next, pending: candidate.id };
  if (state.phase === 'active' && state.passageVisibility[state.current?.id] === true && now < state.activeUntil) {
    return { ...next, pending: candidate.id };
  }
  return adopt(next, candidate, now);
}

function observeVisibility(state, snapshot = {}, passedCueIds = []) {
  // A pending cue leaving view has not necessarily played or been passed.
  // Registration/layout corrections must not consume it before an inspection
  // releases. The renderer identifies passages above the viewport explicitly.
  let next = consume({ ...state, passageVisibility: { ...state.passageVisibility, ...snapshot } }, passedCueIds);
  if (state.current && !state.held && next.passageVisibility[state.current.id] === false) {
    next = { ...next, phase: 'static', activeUntil: 0 };
  }
  return next;
}

function release(state, now) {
  const staticOnly = state.hydrated || state.reducedMotion;
  return reconcile({ ...state, held: null, phase: state.current && !staticOnly ? 'settling' : 'static', activeUntil: staticOnly ? 0 : now + SETTLING_MS }, now);
}

export function reduceGestureFocus(state, event) {
  if (event.type !== 'SOURCE' && (event.runId !== state.runId || event.sourceRevision !== state.sourceRevision)) return state;
  const now = event.now ?? state.lastNow ?? 0;
  let next = state;
  switch (event.type) {
    case 'SOURCE': {
      const { source, associations = [], introductions = [] } = event;
      const sourceBinding = source.visualBinding ?? source.binding;
      if (source.runId !== state.runId || source.sourceRevision !== state.sourceRevision
        || (state.binding && sourceBinding && !sameBinding(state.binding, sourceBinding))
        || (source.kind === 'hydrate' && source.status === 'complete' && !state.hydrated)) {
        next = createGestureFocusState({ ...source, associations, introductions, completed: source.kind === 'hydrate' && source.status === 'complete' });
        next.reducedMotion = state.reducedMotion;
      } else {
        const validOccurrences = new Set(introductions.map(({ occurrenceId }) => occurrenceId));
        next = { ...state, binding: sourceBinding ?? state.binding, associations, introductions, status: source.status, introduced: state.introduced.filter(id => validOccurrences.has(id)) };
        // Legacy registry revisions and application ledger revisions are separate
        // sequences. Acquiring a binding must not discard an existing hold.
        if (!state.binding && sourceBinding) next.ledgerRevision = -1;
        if (state.held?.kind === 'identity' && !validOccurrences.has(state.held.occurrenceId)) {
          next.held = null; next.current = null; next.pending = null; next.phase = 'static';
        }
        if (next.pending && !associations.some(({ id }) => id === next.pending)) next.pending = null;
        if (state.current && state.held?.kind !== 'identity') {
          next.current = associations.find(({ id }) => id === state.current.id) ?? null;
          if (!next.current) { next.held = null; next.pending = null; next.phase = 'static'; }
        }
      }
      break;
    }
    case 'CUES_ARRIVED': {
      if ((event.binding && (event.binding.readingResultId !== state.runId || event.binding.sourceRevision !== state.sourceRevision))
        || (state.binding && !sameBinding(state.binding, event.binding))
        || !Number.isInteger(event.ledgerRevision) || event.ledgerRevision <= state.ledgerRevision) return state;
      const { associations = [], introductions = [] } = event;
      // An explicit hold can refer to the fallback registry that metadata replaced.
      // Keep that exact view until release; the provider retains its rendered span.
      const current = state.held ? state.current : associations.find(({ id }) => id === state.current?.id) ?? null;
      next = { ...state, binding: event.binding ?? null, ledgerRevision: event.ledgerRevision, associations, introductions,
        introduced: introducedAt(state, introductions), current, phase: current ? state.phase : 'static' };
      next = observeVisibility(next, event.visibilitySnapshot, event.passedCueIds);
      next = reconcile(next, now);
      break;
    }
    case 'PROGRESS': {
      next = { ...state, visibleEnd: event.progress.visibleEnd, completed: Boolean(event.progress.complete), lastNow: now };
      next.introduced = introducedAt(next);
      next = reconcile(next, now);
      break;
    }
    case 'HOLD': {
      const selection = event.selection;
      if (JSON.stringify(selection) === JSON.stringify(state.held)) { next = release(state, now); break; }
      let current;
      if (selection.kind === 'association') current = state.associations.find(({ id, passage }) => id === selection.id && passage.end <= state.visibleEnd);
      else if (state.introduced.includes(selection.occurrenceId)) current = { id: `identity-${selection.occurrenceId}`, kind: 'identity', targets: [{ occurrenceId: selection.occurrenceId, detailIds: [] }] };
      if (current) next = consume({ ...state, held: selection, current, phase: 'held' }, [current.id]);
      break;
    }
    case 'RELEASE': next = release(state, now); break;
    case 'VISIBILITY': {
      next = reconcile(observeVisibility(state, event.visibilitySnapshot, event.passedCueIds), now);
      break;
    }
    case 'VISIBLE': {
      if (event.kind === 'artwork') next = { ...state, artworkVisibility: { ...state.artworkVisibility, [event.id]: event.visible } };
      else next = reconcile(observeVisibility(state, { [event.id]: event.visible }), now);
      break;
    }
    case 'INSPECTION': {
      next = reconcile({ ...state, inspections: { ...state.inspections, [event.kind]: event.active } }, now);
      break;
    }
    case 'STATUS': next = reconcile({ ...state, status: event.status }, now); break;
    case 'MOTION': {
      next = { ...state, reducedMotion: event.reducedMotion };
      if (event.reducedMotion && !state.held) next = { ...next, phase: 'static', activeUntil: 0 };
      next = reconcile(next, now);
      break;
    }
    case 'TICK':
      if (!state.held && state.phase === 'active' && now >= state.activeUntil) {
        // Background throttling must not buy an already elapsed cue more motion.
        const settlingUntil = state.activeUntil + SETTLING_MS;
        next = { ...state, phase: now >= settlingUntil ? 'static' : 'settling', activeUntil: settlingUntil };
      } else if (!state.held && state.phase === 'settling' && now >= state.activeUntil) next = { ...state, phase: 'static' };
      next = reconcile(next, now);
      break;
    default: return state;
  }
  return withEligibility({ ...next, lastNow: now });
}
