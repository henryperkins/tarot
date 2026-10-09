const ACTIVE_MS = 1800;

export function getCardPresence({ introduction, visibleEnd = 0, inspected = false, reducedMotion = false }) {
  if (inspected) return 1;
  if (!introduction || visibleEnd < introduction.namedEnd) return 0;
  if (reducedMotion) return 1;
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

export function createGestureFocusState({ runId, sourceRevision, associations = [], introductions = [], completed = false }) {
  return withEligibility({
    runId, sourceRevision, associations, introductions, current: completed ? associations.at(-1) ?? null : null, held: null, pending: null,
    introduced: completed ? introductions.map(({ occurrenceId }) => occurrenceId) : [],
    visibleEnd: completed ? Math.max(0, ...introductions.map(({ end }) => end), ...associations.map(({ passage }) => passage.end)) : 0,
    completed, hydrated: completed, status: completed ? 'complete' : 'streaming', phase: 'static', activeUntil: 0,
    inspections: {}, artworkVisibility: {}, passageVisibility: {}, reducedMotion: false
  });
}

function adopt(state, id, now = 0) {
  const association = state.associations.find((item) => item.id === id);
  return association ? { ...state, current: association, phase: 'active', activeUntil: now + ACTIVE_MS, pending: null } : state;
}

function release(state, now) {
  const next = { ...state, held: null, phase: state.current ? 'settling' : 'static', activeUntil: now + 1500 };
  return next.pending && next.passageVisibility[next.pending] === true ? adopt(next, next.pending, now) : next;
}

export function reduceGestureFocus(state, event) {
  if (event.type !== 'SOURCE' && (event.runId !== state.runId || event.sourceRevision !== state.sourceRevision)) return state;
  const now = event.now ?? state.lastNow ?? 0;
  let next = state;
  switch (event.type) {
    case 'SOURCE': {
      const { source, associations = [], introductions = [] } = event;
      if (source.runId !== state.runId || source.sourceRevision !== state.sourceRevision) {
        next = createGestureFocusState({ ...source, associations, introductions, completed: source.kind === 'hydrate' && source.status === 'complete' });
        next.reducedMotion = state.reducedMotion;
      } else {
        const validOccurrences = new Set(introductions.map(({ occurrenceId }) => occurrenceId));
        next = { ...state, associations, introductions, status: source.status, introduced: state.introduced.filter(id => validOccurrences.has(id)) };
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
    case 'PROGRESS': {
      const visibleEnd = event.progress.visibleEnd;
      const introduced = [...new Set([...state.introduced, ...state.introductions.filter((intro) => visibleEnd >= intro.namedEnd).map((intro) => intro.occurrenceId)])];
      next = { ...state, visibleEnd, introduced, completed: Boolean(event.progress.complete), lastNow: now };
      const available = event.eligibleAssociationIds ?? state.associations.filter(({ passage }) => passage.end <= visibleEnd).map(({ id }) => id);
      const latest = available.at(-1);
      const delivered = state.associations.filter(({ passage }) => passage.end <= visibleEnd).at(-1)?.id;
      if (!state.hydrated && delivered && delivered !== state.current?.id) {
        next = { ...next, pending: delivered };
        if (latest === delivered && next.passageVisibility[delivered] === true && !state.held && !Object.values(state.inspections).some(Boolean) && ['streaming', 'complete'].includes(state.status)) next = adopt(next, delivered, now);
      }
      break;
    }
    case 'HOLD': {
      const selection = event.selection;
      if (JSON.stringify(selection) === JSON.stringify(state.held)) { next = release(state, now); break; }
      let current;
      if (selection.kind === 'association') current = state.associations.find(({ id, passage }) => id === selection.id && passage.end <= state.visibleEnd);
      else if (state.introduced.includes(selection.occurrenceId)) current = { id: `identity-${selection.occurrenceId}`, kind: 'identity', targets: [{ occurrenceId: selection.occurrenceId, detailIds: [] }] };
      if (current) next = { ...state, held: selection, current, phase: 'held' };
      break;
    }
    case 'RELEASE': next = release(state, now); break;
    case 'VISIBLE': {
      const field = event.kind === 'artwork' ? 'artworkVisibility' : 'passageVisibility';
      next = { ...state, [field]: { ...state[field], [event.id]: event.visible } };
      if (event.kind === 'passage') {
        if (!event.visible && state.current?.id === event.id && !state.held) next = { ...next, phase: 'static' };
        if (event.visible && !state.hydrated && ['streaming', 'complete'].includes(state.status) && !state.held && !Object.values(state.inspections).some(Boolean) && state.pending === event.id && state.current?.id !== event.id) next = adopt(next, event.id, now);
      }
      break;
    }
    case 'INSPECTION': {
      next = { ...state, inspections: { ...state.inspections, [event.kind]: event.active } };
      if (!event.active && !state.held && !Object.values(next.inspections).some(Boolean) && state.pending && next.passageVisibility[state.pending] === true) next = adopt(next, state.pending, now);
      break;
    }
    case 'STATUS': next = { ...state, status: event.status }; break;
    case 'MOTION': next = { ...state, reducedMotion: event.reducedMotion }; break;
    case 'TICK':
      if (!state.held && state.phase === 'active' && now >= state.activeUntil) next = { ...state, phase: 'settling', activeUntil: now + 1500 };
      else if (!state.held && state.phase === 'settling' && now >= state.activeUntil) next = { ...state, phase: 'static' };
      break;
    default: return state;
  }
  return withEligibility(next);
}
