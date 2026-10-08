import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  buildNarrativeText,
  buildSpreadCompanionCards,
  buildStoryArtCards,
  deriveNarrativeVisibility,
  selectCinematicCard
} from '../src/hooks/narrativeReadingModelUtils.js';

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
});

describe('deriveNarrativeVisibility', () => {
  test('enables desktop insight controls and auto visuals for eligible completed readings', () => {
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
    assert.equal(state.visualCompanionModeLabel, 'Auto generation on');
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

  test('can restore insights after entering focus mode and narrowing the viewport', () => {
    const state = deriveNarrativeVisibility({
      themes: { knowledgeGraph: { narrativeHighlights: [{ text: 'A pattern' }] } },
      visibleCount: 3,
      revealedCardsSize: 3,
      isNarrativeFocus: true,
      isHandset: true
    });
    assert.equal(state.shouldShowSpreadInsights, false);
    assert.equal(state.focusToggleAvailable, true);
  });
});
