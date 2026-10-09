import { createContext, useContext, useEffect, useMemo, useRef, useState, useReducer, useLayoutEffect } from 'react';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { resolveGestureSidecar } from '../../../lib/narrativeCardLinks.js';
import { createGestureFocusState, reduceGestureFocus } from './narrativeGestureState.js';

/**
 * Which spread cards the reading is speaking about right now.
 *
 * The reading text reports what it reaches (scroll position, live stream or a
 * pointer on a card name); the spread companion and the inline card plates
 * read the result. State and API live in separate contexts so the Markdown
 * body, which only reports, never re-renders when the focus moves.
 */
const FocusStateContext = createContext(null);
const FocusApiContext = createContext(null);

// A paragraph that names several cards sweeps across them in order, the way a
// reader's hand passes over the spread while summarizing it.
const SWEEP_STEP_MS = 420;
const EMPTY_INSPECTIONS = [];

function sameFocus(a, b) {
  return (a?.key ?? null) === (b?.key ?? null);
}

export function NarrativeCardFocusProvider({
  cards = [],
  onSelectCard,
  stable = false,
  gestureStudyEnabled = false,
  gestureSidecar = null,
  gestureSource = null,
  personalContext = null,
  manualInspectionStatus = EMPTY_INSPECTIONS,
  children
}) {
  const prefersReducedMotion = useReducedMotion();
  const calm = Boolean(prefersReducedMotion || stable);
  const [scrollFocus, setScrollFocus] = useState(null);
  const [pointerFocus, setPointerFocus] = useState(null);
  const [sweep, setSweep] = useState({ key: null, step: 0 });
  const containerRef = useRef(null);
  const onSelectCardRef = useRef(onSelectCard);
  const resolved = useMemo(() => gestureStudyEnabled && gestureSidecar && gestureSource
    ? resolveGestureSidecar({ sidecar: gestureSidecar, source: { ...gestureSource, ...personalContext }, cards, artworkEdition: cards[0]?.artworkEdition })
    : { associations: [], introductions: [], invalid: [] }, [gestureStudyEnabled, gestureSidecar, gestureSource, personalContext, cards]);
  const [gestureState, dispatch] = useReducer(reduceGestureFocus, null, () => createGestureFocusState({
    runId: gestureSource?.runId, sourceRevision: gestureSource?.sourceRevision,
    ...resolved, completed: gestureSource?.kind === 'hydrate' && gestureSource?.status === 'complete'
  }));
  const gestureRef = useRef({ source: gestureSource, state: gestureState, resolved });
  const studyEnabled = Boolean(gestureStudyEnabled && gestureSource && gestureSidecar && !resolved.invalid?.some((item) => item.reason === 'source-or-edition-mismatch'));
  useLayoutEffect(() => {
    gestureRef.current = { source: gestureSource, state: gestureState, resolved, enabled: studyEnabled };
  }, [gestureSource, gestureState, resolved, studyEnabled]);

  useEffect(() => {
    if (!gestureSource || !gestureStudyEnabled) return;
    dispatch({ type: 'SOURCE', source: { ...gestureSource, status: document.hidden ? 'paused' : gestureSource.status }, ...resolved });
  }, [gestureSource, gestureStudyEnabled, resolved]);
  useEffect(() => {
    if (!studyEnabled) return undefined;
    const event = (type, values = {}) => dispatch({ type, runId: gestureSource.runId, sourceRevision: gestureSource.sourceRevision, ...values });
    event('MOTION', { reducedMotion: calm });
    const visibility = () => event('STATUS', { status: document.hidden ? 'paused' : gestureSource.status });
    visibility();
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [studyEnabled, calm, gestureSource]);
  useEffect(() => {
    if (!studyEnabled) return;
    for (const kind of ['modal', 'card-detail']) {
      const intent = (Array.isArray(manualInspectionStatus) ? manualInspectionStatus : EMPTY_INSPECTIONS).find((record) => record.kind === kind);
      dispatch({ type: 'INSPECTION', runId: gestureSource.runId, sourceRevision: gestureSource.sourceRevision,
        kind, active: Boolean(intent?.active), occurrenceId: intent?.occurrenceId });
    }
  }, [studyEnabled, manualInspectionStatus, gestureSource]);
  useEffect(() => {
    if (!studyEnabled || !['active', 'settling'].includes(gestureState.phase) || gestureState.held) return undefined;
    const timeout = window.setTimeout(() => dispatch({ type: 'TICK', runId: gestureSource.runId, sourceRevision: gestureSource.sourceRevision, now: performance.now() }), Math.max(0, gestureState.activeUntil - performance.now()));
    return () => window.clearTimeout(timeout);
  }, [studyEnabled, gestureState.phase, gestureState.activeUntil, gestureState.held, gestureSource?.runId, gestureSource?.sourceRevision]);

  useEffect(() => {
    onSelectCardRef.current = onSelectCard;
  }, [onSelectCard]);

  const focus = pointerFocus || scrollFocus;

  useEffect(() => {
    if (!focus || focus.mode !== 'sweep' || calm) return undefined;
    const timers = focus.cards.map((_, step) => window.setTimeout(() => {
      setSweep({ key: focus.key, step: step + 1 });
    }, SWEEP_STEP_MS * (step + 1)));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [focus, calm]);

  const api = useMemo(() => ({
    get studyEnabled() { return gestureRef.current.enabled; },
    holdAssociation(id) {
      const { source } = gestureRef.current;
      if (source) dispatch({ type: 'HOLD', runId: source.runId, sourceRevision: source.sourceRevision, selection: { kind: 'association', id }, now: performance.now() });
    },
    holdCard(occurrenceId) {
      const { source } = gestureRef.current;
      if (source) dispatch({ type: 'HOLD', runId: source.runId, sourceRevision: source.sourceRevision, selection: { kind: 'identity', occurrenceId }, now: performance.now() });
    },
    releaseAssociation() {
      const { source } = gestureRef.current;
      if (source) dispatch({ type: 'RELEASE', runId: source.runId, sourceRevision: source.sourceRevision, now: performance.now() });
    },
    reportProgress(progress) {
      const { source, state, resolved: registry } = gestureRef.current;
      if (!source || progress.runId !== source.runId || progress.sourceRevision !== source.sourceRevision) return;
      const ids = registry.associations.filter((item) => item.passage.end <= progress.visibleEnd && state.passageVisibility[item.id] === true).map(({ id }) => id);
      dispatch({ type: 'SOURCE', source: { ...source, status: document.hidden ? 'paused' : source.status }, ...registry });
      dispatch({ type: 'PROGRESS', ...progress, progress, eligibleAssociationIds: ids, now: performance.now() });
    },
    reportVisibility({ kind, id, visible }) {
      const { source } = gestureRef.current;
      if (source) dispatch({ type: 'VISIBLE', runId: source.runId, sourceRevision: source.sourceRevision, kind, id, visible });
    },
    reportInspection({ kind, active, occurrenceId }) {
      const { source } = gestureRef.current;
      if (source) dispatch({ type: 'INSPECTION', runId: source.runId, sourceRevision: source.sourceRevision, kind, active, occurrenceId });
    },
    setScrollFocus(next) {
      setScrollFocus((previous) => (sameFocus(previous, next) ? previous : next));
    },
    setPointerFocus(next) {
      setPointerFocus((previous) => (sameFocus(previous, next) ? previous : next));
    },
    clearPointerFocus() {
      setPointerFocus(null);
    },
    registerContainer(element) {
      containerRef.current = element;
    },
    // Hovering a card in the spread marks where the text speaks about it.
    setSpreadHover(index) {
      const container = containerRef.current;
      if (!container) return;
      if (Number.isInteger(index)) container.dataset.spreadHover = String(index);
      else delete container.dataset.spreadHover;
    },
    selectCard(index) {
      onSelectCardRef.current?.(index);
    }
  }), []);

  const cardStates = useMemo(() => {
    if (!focus) return null;
    const step = focus.mode === 'sweep' && !calm
      ? (sweep.key === focus.key ? sweep.step : 0)
      : Infinity;
    const touched = focus.mode === 'sweep'
      ? (step < focus.cards.length ? focus.cards[step] : null)
      : focus.primary;
    const states = new Map();
    for (const card of focus.cards) {
      states.set(card, {
        state: card === touched ? 'touched' : 'warm',
        touches: focus.touches?.[card] || []
      });
    }
    return { states, touched, key: `${focus.key}|${touched ?? 'all'}` };
  }, [focus, sweep, calm]);

  const state = useMemo(() => ({ cards, cardStates, calm, studyEnabled, studyRequested: gestureStudyEnabled, gestureState, associations: resolved.associations,
    introductions: resolved.introductions, gestureSource }), [cards, cardStates, calm, studyEnabled, gestureStudyEnabled, gestureState, resolved, gestureSource]);

  return (
    <FocusApiContext.Provider value={api}>
      <FocusStateContext.Provider value={state}>
        {children}
      </FocusStateContext.Provider>
    </FocusApiContext.Provider>
  );
}

/** Current focus for components that show the cards. */
// eslint-disable-next-line react-refresh/only-export-components -- Context + hook pattern is intentional
export function useNarrativeCardFocus() {
  return useContext(FocusStateContext);
}

/** Stable reporting API; null outside a provider. */
// eslint-disable-next-line react-refresh/only-export-components -- Context + hook pattern is intentional
export function useNarrativeCardFocusApi() {
  return useContext(FocusApiContext);
}
