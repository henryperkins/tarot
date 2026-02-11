import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deriveLegacyScene } from '../src/hooks/useSceneOrchestrator.js';

function baseState(overrides = {}) {
  return {
    isShuffling: false,
    hasConfirmedSpread: true,
    revealedCards: new Set([0, 1, 2]),
    totalCards: 3,
    isGenerating: true,
    isReadingStreamActive: false,
    personalReading: null,
    reading: [{}, {}, {}],
    ...overrides
  };
}

describe('deriveLegacyScene', () => {
  it('keeps interlude while stream is active and no text has arrived', () => {
    const scene = deriveLegacyScene(baseState({
      isReadingStreamActive: true,
      personalReading: null
    }));
    assert.equal(scene, 'interlude');
  });

  it('switches to delivery once first streamed text chunk exists', () => {
    const scene = deriveLegacyScene(baseState({
      isReadingStreamActive: true,
      personalReading: {
        raw: 'First chunk',
        normalized: 'First chunk',
        isStreaming: true
      }
    }));
    assert.equal(scene, 'delivery');
  });

  it('switches to delivery when stream chunks arrive via paragraphs', () => {
    const scene = deriveLegacyScene(baseState({
      isReadingStreamActive: true,
      personalReading: {
        raw: '',
        normalized: '',
        paragraphs: ['First chunk'],
        isStreaming: true
      }
    }));
    assert.equal(scene, 'delivery');
  });

  it('switches to complete when streaming ends and reading is finalized', () => {
    const scene = deriveLegacyScene(baseState({
      isGenerating: false,
      isReadingStreamActive: false,
      personalReading: {
        raw: 'Final narrative.',
        normalized: 'Final narrative.',
        isStreaming: false
      }
    }));
    assert.equal(scene, 'complete');
  });

  it('returns shuffling when isShuffling is true', () => {
    const scene = deriveLegacyScene(baseState({
      isShuffling: true,
      hasConfirmedSpread: false,
      revealedCards: new Set()
    }));
    assert.equal(scene, 'shuffling');
  });

  it('returns drawing when cards are partially revealed', () => {
    const scene = deriveLegacyScene(baseState({
      revealedCards: new Set([0, 1]),
      totalCards: 3,
      isGenerating: false
    }));
    assert.equal(scene, 'drawing');
  });

  it('returns revealing when all cards revealed but no personal reading', () => {
    const scene = deriveLegacyScene(baseState({
      isGenerating: false,
      personalReading: null
    }));
    assert.equal(scene, 'revealing');
  });

  it('returns idle when no spread confirmed', () => {
    const scene = deriveLegacyScene({
      isShuffling: false,
      hasConfirmedSpread: false,
      revealedCards: new Set(),
      totalCards: 0,
      isGenerating: false,
      isReadingStreamActive: false,
      personalReading: null,
      reading: null
    });
    assert.equal(scene, 'idle');
  });

  it('returns complete when personalReading is string and not generating', () => {
    const scene = deriveLegacyScene({
      isShuffling: false,
      hasConfirmedSpread: true,
      revealedCards: new Set([0, 1, 2]),
      totalCards: 3,
      isGenerating: false,
      isReadingStreamActive: false,
      personalReading: 'Final reading text',
      reading: [{}, {}, {}]
    });
    assert.equal(scene, 'complete');
  });

  it('handles revealedCards as array instead of Set', () => {
    const scene = deriveLegacyScene(baseState({
      revealedCards: [0, 1],
      totalCards: 3
    }));
    assert.equal(scene, 'drawing');
  });
});
