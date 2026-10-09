import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { NarrativePanel } from './NarrativePanel';
import { useReading } from '../contexts/ReadingContext';
import { MAJOR_ARCANA } from '../data/majorArcana';
import { MINOR_ARCANA } from '../data/minorArcana';
import { createGestureSource, advanceGestureSource } from '../lib/narrativeGestureSource';
import { formatReading } from '../lib/formatting';
import { buildNarrativePanelModel, buildSpreadCompanionCards } from '../hooks/narrativeReadingModelUtils';
import { buildCardLinkCatalog } from '../lib/narrativeCardLinks';
import star from '../../output/reading-motion/fixtures/three-card-transition.json';
import celtic from '../../output/reading-motion/fixtures/gestures-celtic-deep-shift.json';
import fiveCard from '../../output/reading-motion/fixtures/gestures-five-card-creative-project.json';
import sidecars from '../../output/reading-motion/fixtures/gesture-sidecars.json';

const STUDIES = { star, celtic, 'five-card': fiveCard };
const SIDECAR_KEYS = { star: 'star', celtic: 'related', 'five-card': 'fiveCard' };
const VECTOR_FILES = {
  'Six of Cups': 'cups-06.svg', 'The Tower': 'major-16-tower.svg', 'The Star': 'major-17-star.svg',
  'The Hermit': 'major-09-hermit.svg', 'Five of Wands': 'wands-05.svg', 'Ace of Wands': 'wands-01.svg',
  'Seven of Swords': 'swords-07.svg', 'Queen of Cups': 'cups-13.svg', 'Three of Pentacles': 'pentacles-03.svg',
  'Wheel of Fortune': 'major-10-wheel-of-fortune.svg'
};
const noop = () => {};
const POSITION_LABELS = { star: ['Past', 'Present', 'Future'], celtic: ['Present', 'Challenge'], 'five-card': ['Core', 'Challenge', 'Hidden', 'Support', 'Direction'] };
const EMPTY_INSPECTIONS = [];

export function ReadingGesturesFixture() {
  const [params, setParams] = useSearchParams();
  const studyKey = STUDIES[params.get('study')] ? params.get('study') : 'star';
  const arrival = ['gentle', 'burst', 'complete'].includes(params.get('arrival')) ? params.get('arrival') : 'gentle';
  const sourceMode = params.get('sourceMode') === 'job-sse' ? 'job-sse' : 'recorded';
  const reflection = params.get('reflection') !== 'off';
  const fixture = STUDIES[studyKey];
  const originalSidecar = sidecars[SIDECAR_KEYS[studyKey]];
  const sidecar = useMemo(() => reflection ? originalSidecar : { ...originalSidecar, recordedContext: null }, [originalSidecar, reflection]);
  const raw = sidecar.expectedRaw;
  const context = useReading();
  const [restart, setRestart] = useState(0);
  const [recordedSource, setRecordedSource] = useState(() => createGestureSource({ runId: crypto.randomUUID() }));
  const [seeded, setSeeded] = useState(null);
  const cards = useMemo(() => fixture.cards.map(card => ({
    ...[...MAJOR_ARCANA, ...MINOR_ARCANA].find(candidate => candidate.name === card.card),
    name: card.card,
    isReversed: card.orientation === 'Reversed'
  })), [fixture]);
  const key = `${studyKey}:${arrival}:${sourceMode}:${restart}`;
  const { setSelectedSpread, setReading, setUserQuestion, setRevealedCards, generatePersonalReading } = context;

  useEffect(() => {
    if (sourceMode !== 'recorded') return undefined;
    const runId = crypto.randomUUID();
    const initial = createGestureSource({ runId, raw: arrival === 'complete' ? raw : '', status: arrival === 'complete' ? 'complete' : 'streaming' });
    // This fixture deliberately models an external recorded delivery clock.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecordedSource(initial);
    if (arrival === 'complete') return undefined;
    const words = [...raw.matchAll(/\S+\s*/g)];
    let delivered = 0;
    const timer = setInterval(() => {
      delivered = Math.min(words.length, delivered + (arrival === 'burst' ? 24 : 1));
      const end = delivered === words.length ? raw.length : words[delivered - 1].index + words[delivered - 1][0].length;
      setRecordedSource(previous => advanceGestureSource(previous, {
        raw: raw.slice(0, end), kind: delivered === words.length ? 'complete' : 'append',
        status: delivered === words.length ? 'complete' : 'streaming'
      }));
      if (delivered === words.length) clearInterval(timer);
    }, arrival === 'burst' ? 180 : 90);
    return () => clearInterval(timer);
  }, [arrival, raw, key, sourceMode]);

  useEffect(() => {
    if (sourceMode !== 'job-sse') return;
    setSelectedSpread(fixture.spreadKey || 'celtic');
    setReading(cards);
    setUserQuestion(fixture.userQuestion);
    setRevealedCards(new Set(cards.map((_, index) => index)));
    // Seed through the same public context operations used by setup.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeeded(key);
  }, [cards, fixture, key, sourceMode, setSelectedSpread, setReading, setUserQuestion, setRevealedCards]);

  useEffect(() => {
    if (sourceMode !== 'job-sse' || seeded !== key || context.reading !== cards || context.isGenerating) return;
    // A separate task waits for context to publish the seeded spread before start.
    const timer = setTimeout(() => {
      setSeeded(null);
      generatePersonalReading();
    }, 0);
    return () => clearTimeout(timer);
  }, [cards, context.reading, context.isGenerating, generatePersonalReading, key, seeded, sourceMode]);

  const source = sourceMode === 'job-sse' ? context.gestureSource || recordedSource : recordedSource;
  const personalReading = sourceMode === 'job-sse' ? context.personalReading : {
    ...formatReading(source.raw), isStreaming: source.status === 'streaming', isServerStreamed: true
  };
  const spreadCards = useMemo(() => buildSpreadCompanionCards({
    reading: cards, visibleCount: cards.length, spreadPositions: fixture.cards.map(card => card.position),
    deckStyleId: 'rws-1909', revealedCards: new Set(cards.map((_, index) => index)), runId: source.runId, artworkEdition: 'rws-immanuelle-vector'
  }).map(card => ({ ...card, shortLabel: POSITION_LABELS[studyKey][card.index], frame: '3 / 5', image: `/output/reading-motion/assets/rws-immanuelle/${VECTOR_FILES[card.canonicalName || card.name]}` })), [cards, fixture, source.runId, studyKey]);
  const panelModel = buildNarrativePanelModel({
    personalReading: { ...personalReading, hasMarkdown: true }, narrativeText: personalReading?.isError ? personalReading.raw : source.raw,
    isPersonalReadingError: Boolean(personalReading?.isError), isReadingStreaming: source.status === 'streaming',
    narrativePhase: source.status === 'complete' ? 'complete' : 'streaming',
    userQuestion: fixture.userQuestion, isHandset: window.innerWidth < 640,
    shouldStreamNarrative: false, narrativeHighlightPhrases: [], ttsState: { status: 'idle' },
    gestureSource: source, gestureStudyEnabled: true, gestureSidecar: sidecar,
    spreadCards, manualInspectionStatus: EMPTY_INSPECTIONS,
    cardLinkCatalog: buildCardLinkCatalog({ cards: spreadCards, deckStyle: 'rws-1909' })
  });
  panelModel.sectionHeading = studyKey === 'five-card' ? null : { heading: fixture.heading || fixture.section, position: fixture.positionLabel };
  const change = (name, value) => setParams(previous => { const next = new URLSearchParams(previous); next.set(name, value); return next; });
  return (
    <main className="min-h-screen px-3 py-4" data-testid="reading-gestures-fixture">
      <fieldset className="gesture-lab mb-6 flex flex-wrap items-center gap-3 border border-secondary/30 p-3" aria-label="Gesture fixture lab">
        <legend>Recorded reading gesture lab</legend>
        <label>Study <select value={studyKey} onChange={event => change('study', event.target.value)}><option value="star">Star</option><option value="celtic">Celtic</option><option value="five-card">Five-card</option></select></label>
        <label>Arrival <select value={arrival} onChange={event => change('arrival', event.target.value)}><option>gentle</option><option>burst</option><option>complete</option></select></label>
        <label>Source mode <select value={sourceMode} onChange={event => change('sourceMode', event.target.value)}><option>recorded</option><option>job-sse</option></select></label>
        <label>Reflection <select value={reflection ? 'on' : 'off'} onChange={event => change('reflection', event.target.value)}><option>on</option><option>off</option></select></label>
        <button type="button" onClick={() => setRestart(previous => previous + 1)}>Restart study</button>
        <output data-testid="gesture-source-diagnostics" data-run-id={source.runId} data-source-revision={source.sourceRevision} data-source-status={source.status} data-raw-length={source.raw.length}>{sourceMode}: {source.raw.length} characters</output>
      </fieldset>
      {reflection && <aside className="mx-auto mb-4 max-w-5xl text-sm text-muted" data-testid="recorded-reflection"><p>Recorded general reflection: {fixture.reflectionsText}</p></aside>}
      <NarrativePanel panelModel={panelModel} callbacks={{ onNarrativeComplete: noop, onHighlightPhrase: noop, onSectionEnter: noop }} />
    </main>
  );
}

export default ReadingGesturesFixture;
