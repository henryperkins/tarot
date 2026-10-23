import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { validatePassageAssociationsPayload } from '../shared/contracts/readingPassageAssociations.js';
import { collectPassageCandidates } from '../functions/lib/graphRAGCandidates.js';
import { buildGraphContext } from '../functions/lib/graphContext.js';
import { retrievePassages } from '../functions/lib/graphRAG.js';

import {
  buildNarrativePanelModel,
  buildNarrativeSurfaceModel,
  buildNarrativeText,
  buildSpreadCompanionCards,
  buildStoryArtCards,
  deriveNarrativeVisibility,
  getTraditionalPassages,
  getTraditionalPassagePreview,
  selectCinematicCard
} from '../src/hooks/narrativeReadingModelUtils.js';

test('secondary content is present only when a studio, insights or safety notice can render', () => {
  const completed = { personalReading: { raw: 'A completed reading.' } };
  assert.equal(buildNarrativeSurfaceModel(completed).hasSecondaryContent, false);
  assert.equal(buildNarrativeSurfaceModel({ isGenerating: true }).hasSecondaryContent, false);
  for (const flag of ['shouldShowVisualCompanion', 'shouldShowSpreadInsights']) {
    assert.equal(buildNarrativeSurfaceModel({ ...completed, [flag]: true }).hasSecondaryContent, true);
  }
  const beforeReading = buildNarrativeSurfaceModel({ isGenerating: false });
  assert.equal(beforeReading.shouldShowSafetyNotice, true);
  assert.equal(beforeReading.hasSecondaryContent, true);
});

describe('traditional passage display', () => {
  const passages = Object.freeze([
    Object.freeze({ id: 'complete', text: 'A complete arc.', isPartialPattern: false, metadata: { isComplete: true } }),
    Object.freeze({ id: 'partial', text: 'An arc mentioning an undrawn card.', isPartialPattern: true }),
    Object.freeze({ id: 'legacy-partial', text: 'An older incomplete arc.', metadata: { isComplete: false } }),
    Object.freeze({ id: 'ordinary', text: 'A reference without pattern metadata.' })
  ]);

  for (const location of ['graphRAGPayload', 'retrievedPassages']) {
    test(`omits partial quotations from ${location} without changing the stored references`, () => {
      const knowledgeGraph = location === 'graphRAGPayload' ? { graphRAGPayload: { passages } } : { retrievedPassages: passages };
      assert.deepEqual(getTraditionalPassages({ knowledgeGraph }), []);
      assert.deepEqual(getTraditionalPassagePreview({ knowledgeGraph }).map(passage => passage.id), ['complete', 'ordinary']);
      assert.equal(passages.length, 4);
      assert.equal(passages[1].text, 'An arc mentioning an undrawn card.');
    });
  }

  test('hides the real partial Healing Arc quotation that names absent Temperance', () => {
    // Death and The Star match two cards; Temperance is not drawn.
    const partialKeys = buildGraphContext([{ card: 'Death', number: 13 }, { card: 'The Star', number: 17 }]).graphKeys;
    const retrieved = collectPassageCandidates(partialKeys).filter(passage => passage.type === 'triad' && passage.isPartialPattern);
    assert.equal(retrieved.length, 1);
    assert.match(retrieved[0].authoredDisplayText, /Temperance/);
    assert.doesNotMatch(retrieved[0].promptText, /Temperance/);
    assert.deepEqual(getTraditionalPassages({ knowledgeGraph: { graphRAGPayload: { passages: retrieved } } }), []);

    const complete = retrievePassages({ triadIds: ['death-temperance-star'], completeTriadIds: ['death-temperance-star'] });
    assert.equal(getTraditionalPassagePreview({ knowledgeGraph: { graphRAGPayload: { passages: complete } } }).length, 1);
  });

  test('partial-only references do not create an empty panel or focus toggle', () => {
    const state = deriveNarrativeVisibility({
      themes: { knowledgeGraph: { graphRAGPayload: { passages: [passages[1]] } } },
      visibleCount: 2,
      revealedCardsSize: 2,
      canShowVisionPanel: false
    });
    assert.deepEqual(state.traditionalPassages, []);
    assert.equal(state.hasTraditionalInsights, false);
    assert.equal(state.shouldShowSpreadInsights, false);
    assert.equal(state.focusToggleAvailable, false);
  });

  test('keeps detected partial-pattern summaries when their quotations are hidden', () => {
    const state = deriveNarrativeVisibility({
      themes: { knowledgeGraph: {
        narrativeHighlights: [{ type: 'partial-triad', text: 'Death and The Star: an ending and renewed hope (partial).' }],
        graphRAGPayload: { passages: [passages[1]] }
      } },
      visibleCount: 2,
      revealedCardsSize: 2
    });
    assert.equal(state.hasTraditionalInsights, false);
    assert.equal(state.shouldShowSpreadInsights, true);
    assert.equal(state.hasPatternHighlights, true);
  });

  test('empty or malformed references cannot create a traditional wisdom section', () => {
    for (const value of [undefined, null, {}, [null, {}, { text: ' ' }]]) {
      assert.deepEqual(getTraditionalPassages({ knowledgeGraph: { graphRAGPayload: { passages: value } } }), []);
    }
    assert.deepEqual(getTraditionalPassages({ knowledgeGraph: {
      graphRAGPayload: { passages: [] }, retrievedPassages: [passages[0]]
    } }), [], 'An explicitly empty current payload must not revive older references');
  });
});

describe('narration controls for server voices', () => {
  for (const ttsProvider of ['elevenlabs', 'deepgram']) {
    for (const status of ['playing', 'paused']) {
      test(`${ttsProvider} offers progress and stop while ${status}`, () => {
        const model = buildNarrativePanelModel({
          personalReading: { raw: 'Finished reading.' },
          fullReadingText: 'Finished reading.',
          ttsProvider,
          ttsState: { status },
          narrativePhase: 'complete'
        });
        assert.equal(model.statusModel.showNarrationProgress, true);
        assert.equal(model.controlsModel.showNarrationStop, true);
      });
    }
  }

  test('loading and completed narration have no progress control', () => {
    for (const status of ['loading', 'completed']) {
      const model = buildNarrativePanelModel({
        personalReading: { raw: 'Finished reading.' },
        fullReadingText: 'Finished reading.',
        ttsProvider: 'elevenlabs',
        ttsState: { status }
      });
      assert.equal(model.statusModel.showNarrationProgress, false);
    }
  });
});

describe('buildNarrativeText', () => {
  test('prefers markdown/raw text when available', () => {
    const text = buildNarrativeText({
      hasMarkdown: true,
      raw: '## Reading',
      normalized: 'Reading'
    });

    assert.equal(text, '## Reading');
  });

  test('falls back to paragraph joins for streamed readings', () => {
    const text = buildNarrativeText({
      raw: '',
      normalized: '',
      paragraphs: ['First section', 'Second section']
    });

    assert.equal(text, 'First section\n\nSecond section');
  });

  test('preserves original setext headings and whitespace when legacy metadata says plain text', () => {
    const raw = '\n\nOpening\n=======\n\nA beginning.\n\nClosing\n=======\n\nAn end.';
    const text = buildNarrativeText({ hasMarkdown: false, raw, normalized: raw.trim(), paragraphs: [raw.trim()] });
    assert.equal(text, raw);
  });
});

describe('selectCinematicCard', () => {
  test('prefers present/core/outcome positions before midpoint fallback', () => {
    const selection = selectCinematicCard({
      reading: [{ name: 'One' }, { name: 'Two' }, { name: 'Three' }],
      visibleCount: 3,
      spreadPositions: ['Past', 'Present', 'Outcome']
    });

    assert.equal(selection.cinematicCard?.name, 'Two');
    assert.equal(selection.cinematicPosition, 'Present');
  });
});

describe('buildStoryArtCards', () => {
  test('maps visible cards into illustration-ready records', () => {
    const cards = buildStoryArtCards({
      reading: [
        { name: 'The Fool', isReversed: false },
        { name: 'The Magician', isReversed: true }
      ],
      visibleCount: 2,
      spreadPositions: ['Past', 'Present']
    });

    assert.equal(cards.length, 2);
    assert.equal(cards[0].position, 'Past');
    assert.equal(cards[1].reversed, true);
  });
});

describe('buildSpreadCompanionCards', () => {
  const reading = [
    { name: 'Six of Cups', isReversed: true },
    { name: 'The Tower', isReversed: false },
    { name: 'Justice', isReversed: false }
  ];
  const spreadPositions = ['Past — what shaped you', 'Present — where you stand', 'Future — where this leads'];

  test('keeps deck names and art beside canonical identity', () => {
    const cards = buildSpreadCompanionCards({ reading, visibleCount: 3, spreadPositions, deckStyleId: 'thoth-a1' });
    assert.deepEqual(cards.map((card) => [card.index, card.name, card.canonicalName, card.isReversed]), [
      [0, 'Pleasure (Six of Cups)', 'Six of Cups', true],
      [1, 'The Tower', 'The Tower', false],
      [2, 'Adjustment', 'Justice', false]
    ]);
    assert.ok(cards.every((card) => card.image.includes('/thoth/')));
    assert.ok(cards.every((card) => card.frame === '3 / 5'));
    assert.deepEqual(cards.map((card) => card.shortLabel), ['Past', 'Present', 'Future']);
  });

  test('frames each deck at its card shape', () => {
    const frameFor = (deckStyleId) => buildSpreadCompanionCards({ reading, visibleCount: 1, deckStyleId })[0].frame;
    assert.equal(frameFor('rws-1909'), '100 / 172');
    assert.equal(frameFor('marseille-classic'), '16 / 31');
    assert.equal(frameFor('unknown-deck'), '100 / 172');
  });

  test('shows only revealed cards', () => {
    const cards = buildSpreadCompanionCards({ reading, visibleCount: 3, deckStyleId: 'rws-1909', revealedCards: new Set([1]) });
    assert.deepEqual(cards.map((card) => card.index), [1]);
    assert.equal(cards[0].shortLabel, 'Position 2');
    assert.deepEqual(buildSpreadCompanionCards({ reading, visibleCount: 0, deckStyleId: 'rws-1909' }), []);
  });

  test('explicit vector edition uses its matching WebP artwork and frame', () => {
    const cards = buildSpreadCompanionCards({ reading, visibleCount: 3, deckStyleId: 'rws-1909', artworkEdition: 'rws-immanuelle-vector' });
    assert.ok(cards.every(card => card.image.startsWith('/images/cards/rws-vector/') && card.image.endsWith('.webp')));
    assert.ok(cards.every(card => card.frame === '3 / 5'));
    assert.ok(cards.every(card => card.artworkEdition === 'rws-immanuelle-vector'));
  });

  test('a mismatched or unsupported edition never replaces the selected deck with RWS artwork', () => {
    const thoth = buildSpreadCompanionCards({ reading, visibleCount: 3, deckStyleId: 'thoth-a1', artworkEdition: 'rws-immanuelle-vector' });
    assert.ok(thoth.every(card => card.image.includes('/thoth/') && card.artworkEdition !== 'rws-immanuelle-vector'));
    const unsupported = buildSpreadCompanionCards({ reading, visibleCount: 1, deckStyleId: 'rws-1909', artworkEdition: 'future-edition' });
    assert.equal(unsupported[0].artworkEdition, 'future-edition');
    assert.ok(!unsupported[0].image.includes('/rws-vector/'));
  });

  test('inspection availability includes only revealed occurrences without fabricating introductions', () => {
    const cards = buildSpreadCompanionCards({ reading, visibleCount: 3, deckStyleId: 'rws-1909',
      revealedCards: new Set([1]), runId: 'visible', inspectionAvailable: true });
    assert.deepEqual(cards.map(card => [card.occurrenceId, card.inspectionAvailable]), [['visible:1', true]]);
    assert.equal(buildSpreadCompanionCards({ reading, visibleCount: 1, deckStyleId: 'rws-1909' })[0].inspectionAvailable, false);
  });

  test('card reflections follow their original spread occurrence through revealed-card filtering', () => {
    const cards = buildSpreadCompanionCards({ reading: [{ name: 'The Star' }, { name: 'The Star' }],
      visibleCount: 2, revealedCards: new Set([1]), deckStyleId: 'rws-1909',
      reflections: { 0: 'The first note.', 1: '  A different note.  ' } });
    assert.equal(cards[0].index, 1);
    assert.equal(cards[0].userReflection, 'A different note.');
  });

  test('only the matching card occurrence can validate its personal context', () => {
    const raw = 'The Star';
    const personalContext = { type: 'card-reflection', spreadIndex: 1, quote: 'I need quiet.' };
    const payload = { artworkEdition: 'rws-immanuelle-vector', expectedRaw: raw, associations: [{
      id: 'star-note', kind: 'identity', passage: { start: 0, end: raw.length, quote: raw },
      targets: [{ spreadIndex: 1, canonicalName: 'The Star', detailIds: [] }], personalContext
    }] };
    const cards = buildSpreadCompanionCards({ reading: [{ name: 'The Star' }, { name: 'The Star' }],
      visibleCount: 2, deckStyleId: 'rws-1909', reflections: { 0: 'I need movement.', 1: 'I need quiet.' } });
    const check = context => validatePassageAssociationsPayload({ ...payload,
      associations: [{ ...payload.associations[0], personalContext: context }] },
    { rawText: raw, sourceComplete: true, cards, artworkEdition: payload.artworkEdition });
    assert.deepEqual(check(personalContext).associations[0].personalContext, personalContext);
    assert.equal(check({ ...personalContext, spreadIndex: 0 }).associations[0].personalContext, undefined);
  });

  test('general reflection text never becomes a card note and embedded card notes remain supported', () => {
    const input = { reading: [{ name: 'The Star' }, { name: 'The Hermit', userReflection: 'Follow the light.' },
      { name: 'Justice', reflection: 'Find balance.' }], visibleCount: 3, deckStyleId: 'rws-1909' };
    assert.deepEqual(buildSpreadCompanionCards({ ...input, reflections: 'General thoughts.' })
      .map(card => card.userReflection), ['', 'Follow the light.', 'Find balance.']);
    const inherited = Object.create({ 0: 'Not a supplied note.' });
    assert.equal(buildSpreadCompanionCards({ ...input, reflections: inherited })[0].userReflection, '');
    assert.equal(buildSpreadCompanionCards({ ...input, reflections: { 0: { note: 'Invalid shape.' } } })[0].userReflection, '');
  });
});

describe('deriveNarrativeVisibility', () => {
  test('keeps eligible completed-reading visuals manual even with the legacy auto flag', () => {
    const state = deriveNarrativeVisibility({
      personalReading: { raw: 'Completed reading' },
      isPersonalReadingError: false,
      isReadingStreaming: false,
      narrativePhase: 'complete',
      themes: {
        knowledgeGraph: {
          narrativeHighlights: ['Pattern'],
          retrievedPassages: [{ id: 'p1' }]
        }
      },
      highlightItems: [{ id: 'h1' }],
      visibleCount: 3,
      revealedCardsSize: 3,
      isShuffling: false,
      isNarrativeFocus: false,
      canShowVisionPanel: false,
      effectiveTier: 'plus',
      isAuthenticated: true,
      autoGenerateVisualsEnabled: true,
      isGenerating: false,
      storyArtCards: [{ name: 'The Fool' }],
      cinematicCard: { name: 'The Fool' },
      isHandset: false
    });

    assert.equal(state.focusToggleAvailable, true);
    assert.equal(state.shouldShowSpreadInsights, true);
    assert.equal(state.canUseMediaGallery, true);
    assert.equal(state.shouldShowVisualCompanion, true);
    assert.equal(state.autoGenerateVisuals, false);
    assert.equal(state.visualCompanionModeLabel, 'Generate on demand');
    assert.equal(state.visualCompanionMessage, 'Generate artwork that stays anchored to this reading.');
  });

  test('keeps insight controls available on handset layouts', () => {
    const state = deriveNarrativeVisibility({
      personalReading: { raw: 'Completed reading' },
      isPersonalReadingError: false,
      isReadingStreaming: false,
      narrativePhase: 'complete',
      themes: {
        knowledgeGraph: {
          narrativeHighlights: ['Pattern']
        }
      },
      highlightItems: [],
      visibleCount: 1,
      revealedCardsSize: 1,
      isShuffling: false,
      isNarrativeFocus: false,
      canShowVisionPanel: false,
      effectiveTier: 'free',
      isAuthenticated: false,
      autoGenerateVisualsEnabled: false,
      isGenerating: false,
      storyArtCards: [],
      cinematicCard: null,
      isHandset: true
    });

    assert.equal(state.focusToggleAvailable, true);
  });

  test('keeps insight content available while the completion container hides extra panels', () => {
    const state = deriveNarrativeVisibility({
      themes: { knowledgeGraph: { narrativeHighlights: [{ text: 'A pattern' }] } },
      visibleCount: 3,
      revealedCardsSize: 3,
      isNarrativeFocus: true,
      isHandset: true
    });
    assert.equal(state.shouldShowSpreadInsights, true);
    assert.equal(state.focusToggleAvailable, true);
  });
});


test('gesture companion identities use run and spread occurrence with explicit artwork edition', () => {
  const input = { reading: [{ name: 'The Star', number: 17 }, { name: 'The Star', number: 17 }], visibleCount: 2, deckStyleId: 'rws-1909', runId: 'run-a' };
  const cards = buildSpreadCompanionCards(input);
  assert.deepEqual(cards.map(card => card.occurrenceId), ['run-a:0', 'run-a:1']);
  assert.equal(cards[0].artworkEdition, 'rws-1909-scan');
  assert.equal(buildSpreadCompanionCards({ ...input, artworkEdition: 'rws-immanuelle-vector' })[0].artworkEdition, 'rws-immanuelle-vector');
  assert.equal(buildSpreadCompanionCards({ ...input, deckStyleId: 'thoth-a1' })[0].artworkEdition, null);
  assert.equal(buildSpreadCompanionCards({ ...input, runId: 'run-b' })[0].occurrenceId, 'run-b:0');
});

test('panel model retains exact source and defaults gesture study to disabled', () => {
  const source = { runId: 'run-a', raw: '  The Star pours.\n', sourceRevision: 0, kind: 'hydrate', status: 'complete' };
  const sidecar = { regions: [] };
  const ordinary = buildNarrativePanelModel({ personalReading: { raw: source.raw }, gestureSource: source });
  assert.equal(ordinary.gestureStudyEnabled, false);
  assert.equal(ordinary.gestureSource, source);
  const fixture = buildNarrativePanelModel({ gestureSource: source, gestureStudyEnabled: true, gestureSidecar: sidecar, manualInspectionStatus: 'inspected' });
  assert.equal(fixture.gestureSidecar, sidecar);
  assert.equal(fixture.manualInspectionStatus, 'inspected');
});
