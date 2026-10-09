import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { NarrativePanel } from './NarrativePanel';
import { StreamingNarrative } from './StreamingNarrative';
import { NarrativeCardFocusProvider } from './reading/narrative/NarrativeCardFocus';
import { SpreadCompanion } from './reading/narrative/SpreadCompanion';
import { useReading } from '../contexts/ReadingContext';
import { MAJOR_ARCANA } from '../data/majorArcana';
import { MINOR_ARCANA } from '../data/minorArcana';
import { MAJOR_EXAMPLES } from '../data/cardGestureDetails/majors.js';
import { CUP_PENTACLE_EXAMPLES } from '../data/cardGestureDetails/cupsPentacles.js';
import { WAND_SWORD_EXAMPLES } from '../data/cardGestureDetails/wandsSwords.js';
import { createGestureSource, advanceGestureSource } from '../lib/narrativeGestureSource';
import { formatReading } from '../lib/formatting';
import { buildNarrativePanelModel, buildSpreadCompanionCards } from '../hooks/narrativeReadingModelUtils';
import { buildCardLinkCatalog } from '../lib/narrativeCardLinks';
import star from '../../output/reading-motion/fixtures/three-card-transition.json';
import celtic from '../../output/reading-motion/fixtures/gestures-celtic-deep-shift.json';
import fiveCard from '../../output/reading-motion/fixtures/gestures-five-card-creative-project.json';
import sidecars from '../../output/reading-motion/fixtures/gesture-sidecars.json';
import vectorManifest from '../../output/reading-motion/assets/rws-immanuelle/manifest.json';

const STUDIES = { star, celtic, 'five-card': fiveCard };
const SIDECAR_KEYS = { star: 'star', celtic: 'related', 'five-card': 'fiveCard' };
const ALL_CARDS = [...MAJOR_ARCANA, ...MINOR_ARCANA];
const normalizeCardName = name => name.replace(/^the /i, '').toLowerCase();
const VECTOR_FILES = Object.fromEntries(vectorManifest.cards.flatMap(asset => {
  const card = ALL_CARDS.find(candidate => normalizeCardName(candidate.name) === normalizeCardName(asset.name));
  return card ? [[card.name, asset.filename]] : [];
}));
// Authored literal probes for the earlier eight treatments, not fixture excerpts.
const EARLIER_PROBES = {
  'The Star': ['A figure pours one pitcher into a pool.', 'The other pitcher pours water onto the land.'],
  'The Hermit': ['A lantern is held close and lights the rocky path.'],
  'Five of Wands': ['Five figures hold staffs raised in a tangled scrum.'],
  'Ace of Wands': ['A hand holds a wand with sprouting leaves.', 'A castle stands in the distant hills.'],
  'Seven of Swords': ['A figure carries five swords away from a camp.', 'Two planted swords stand behind the departing figure.'],
  'Queen of Cups': ['The seated figure holds an ornate, covered cup.'],
  'Three of Pentacles': ['A craftsman stands in a cathedral beside a monk and noble.'],
  'Wheel of Fortune': ['A great wheel appears below a sphinx, with a snake and Anubis beside it.']
};
const DECK_PROBES = [...MAJOR_EXAMPLES, ...CUP_PENTACLE_EXAMPLES, ...WAND_SWORD_EXAMPLES];
function deckFixture(card, orientation) {
  const descriptions = EARLIER_PROBES[card.name] || DECK_PROBES.filter(probe => probe.card === card.name).map(probe =>
    probe.text.startsWith(`${card.name}. `) ? probe.text.slice(card.name.length + 2) : probe.text);
  return {
    userQuestion: '', cards: [{ card: card.name, orientation, position: 'Artwork' }],
    reading: `## ${card.name}\n\n${descriptions.join('\n\n')}`
  };
}
const noop = () => {};
const POSITION_LABELS = { star: ['Past', 'Present', 'Future'], celtic: ['Present', 'Challenge'], 'five-card': ['Core', 'Challenge', 'Hidden', 'Support', 'Direction'] };
const EMPTY_INSPECTIONS = [];

export function ReadingGesturesFixture() {
  const [params, setParams] = useSearchParams();
  const studyKey = params.get('study') === 'deck' ? 'deck' : STUDIES[params.get('study')] ? params.get('study') : 'star';
  const isDeck = studyKey === 'deck';
  const deckCard = ALL_CARDS.find(card => card.name === params.get('card')) || ALL_CARDS[0];
  const orientation = params.get('orientation') === 'reversed' ? 'Reversed' : 'Upright';
  const arrival = ['gentle', 'burst', 'complete'].includes(params.get('arrival')) ? params.get('arrival') : 'gentle';
  const sourceMode = !isDeck && params.get('sourceMode') === 'job-sse' ? 'job-sse' : 'recorded';
  const associationMode = isDeck || params.get('associations') === 'dynamic' ? 'dynamic' : 'authored';
  const reflection = !isDeck && params.get('reflection') !== 'off';
  const fixture = useMemo(() => isDeck ? deckFixture(deckCard, orientation) : STUDIES[studyKey], [deckCard, isDeck, orientation, studyKey]);
  const originalSidecar = sidecars[SIDECAR_KEYS[studyKey]];
  const sidecar = useMemo(() => !originalSidecar ? null : reflection ? originalSidecar : { ...originalSidecar, recordedContext: null }, [originalSidecar, reflection]);
  const raw = isDeck ? fixture.reading : sidecar.expectedRaw;
  const context = useReading();
  const [restart, setRestart] = useState(0);
  const [recordedSource, setRecordedSource] = useState(() => createGestureSource({ runId: crypto.randomUUID() }));
  const [seeded, setSeeded] = useState(null);
  const [selectionCalls, setSelectionCalls] = useState(0);
  const recordSelection = useCallback(() => setSelectionCalls(count => count + 1), []);
  const cards = useMemo(() => fixture.cards.map(card => ({
    ...ALL_CARDS.find(candidate => candidate.name === card.card),
    name: card.card,
    isReversed: card.orientation === 'Reversed'
  })), [fixture]);
  const key = `${studyKey}:${arrival}:${sourceMode}:${isDeck ? `${deckCard.name}:${orientation}` : ''}:${restart}`;
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
  }).map(card => ({ ...card, shortLabel: isDeck ? 'Artwork' : POSITION_LABELS[studyKey][card.index], frame: '3 / 5', image: `/output/reading-motion/assets/rws-immanuelle/${VECTOR_FILES[card.canonicalName || card.name]}` })), [cards, fixture, isDeck, source.runId, studyKey]);
  const panelModel = buildNarrativePanelModel({
    personalReading: { ...personalReading, hasMarkdown: true }, narrativeText: personalReading?.isError ? personalReading.raw : source.raw,
    isPersonalReadingError: Boolean(personalReading?.isError), isReadingStreaming: source.status === 'streaming',
    narrativePhase: source.status === 'complete' ? 'complete' : 'streaming',
    userQuestion: fixture.userQuestion, isHandset: window.innerWidth < 640,
    shouldStreamNarrative: false, narrativeHighlightPhrases: [], ttsState: { status: 'idle' },
    gestureSource: source, gestureStudyEnabled: true, gestureSidecar: associationMode === 'dynamic' ? null : sidecar,
    spreadCards, manualInspectionStatus: EMPTY_INSPECTIONS,
    cardLinkCatalog: buildCardLinkCatalog({ cards: spreadCards, deckStyle: 'rws-1909' })
  });
  panelModel.sectionHeading = isDeck || studyKey === 'five-card' ? null : { heading: fixture.heading || fixture.section, position: fixture.positionLabel };
  const change = (name, value) => setParams(previous => { const next = new URLSearchParams(previous); next.set(name, value); return next; });
  return (
    <main className="min-h-screen px-3 py-4" data-testid="reading-gestures-fixture">
      <fieldset className="gesture-lab mb-6 flex flex-wrap items-center gap-3 border border-secondary/30 p-3" aria-label="Gesture fixture lab">
        <legend>{isDeck ? 'Deck detail study lab' : 'Recorded reading gesture lab'}</legend>
        <label>Study <select value={studyKey} onChange={event => change('study', event.target.value)}><option value="star">Star</option><option value="celtic">Celtic</option><option value="five-card">Five-card</option><option value="deck">Deck detail study</option></select></label>
        {isDeck && <>
          <label>Card <select value={deckCard.name} onChange={event => change('card', event.target.value)}>{ALL_CARDS.map(card => <option key={card.name} value={card.name}>{card.name}</option>)}</select></label>
          <label>Orientation <select value={orientation.toLowerCase()} onChange={event => change('orientation', event.target.value)}><option value="upright">Upright</option><option value="reversed">Reversed</option></select></label>
        </>}
        <label>Arrival <select value={arrival} onChange={event => change('arrival', event.target.value)}><option>gentle</option><option>burst</option><option>complete</option></select></label>
        {!isDeck && <>
          <label>Source mode <select value={sourceMode} onChange={event => change('sourceMode', event.target.value)}><option>recorded</option><option>job-sse</option></select></label>
          <label>Associations <select value={associationMode} onChange={event => change('associations', event.target.value)}><option>authored</option><option>dynamic</option></select></label>
          <label>Reflection <select value={reflection ? 'on' : 'off'} onChange={event => change('reflection', event.target.value)}><option>on</option><option>off</option></select></label>
        </>}
        <button type="button" onClick={() => setRestart(previous => previous + 1)}>Restart study</button>
        <output data-testid="gesture-source-diagnostics" data-association-mode={associationMode} data-run-id={source.runId} data-source-revision={source.sourceRevision} data-source-status={source.status} data-raw-length={source.raw.length} data-selection-calls={selectionCalls}>{isDeck ? 'authored probe' : sourceMode}: {source.raw.length} characters</output>
      </fieldset>
      {reflection && <aside className="mx-auto mb-4 max-w-5xl text-sm text-muted" data-testid="recorded-reflection"><p>Recorded general reflection: {fixture.reflectionsText}</p></aside>}
      {isDeck ? <DeckVisualProbe panelModel={panelModel} onSelectCard={recordSelection} /> : <NarrativePanel panelModel={panelModel} callbacks={{ onNarrativeComplete: noop, onHighlightPhrase: noop, onSectionEnter: noop, onSelectCard: recordSelection }} />}
    </main>
  );
}

// Reuse the actual association provider, artwork companion and Markdown renderer
// without labelling synthetic visual probes as a personalized reading.
function DeckVisualProbe({ panelModel, onSelectCard }) {
  const { gestureSource, spreadCards, cardLinkCatalog, panelClassName } = panelModel;
  return <NarrativeCardFocusProvider key={`${gestureSource.runId}:${gestureSource.sourceRevision}`}
    cards={spreadCards} onSelectCard={onSelectCard} gestureStudyEnabled gestureSource={gestureSource}>
    <section className={panelClassName} aria-labelledby="deck-probe-heading">
      <div className="narrative-panel__layout narrative-panel__layout--with-spread">
        <SpreadCompanion variant="rail" />
        <div className="narrative-panel__column mx-auto max-w-prose min-w-0 space-y-5 sm:space-y-6">
          <h1 id="deck-probe-heading" className="font-serif text-2xl text-main">Authored visual probe</h1>
          <p className="text-sm leading-relaxed text-muted">Synthetic descriptions of painted details; this is not a recorded or personalized reading.</p>
          <StreamingNarrative text={gestureSource.raw} useMarkdown headingBaseLevel={2}
            isStreamingEnabled={false} isReadingStreaming={gestureSource.status === 'streaming'}
            cardLinks={cardLinkCatalog} gestureSource={gestureSource} onDone={noop} />
        </div>
      </div>
    </section>
  </NarrativeCardFocusProvider>;
}

export default ReadingGesturesFixture;
