import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizePositionKey, buildPositionCardText, getConnector } from '../functions/lib/narrative/helpers.js';

describe('normalizePositionKey', () => {
  describe('Celtic Cross positions', () => {
    it('normalizes position without Card suffix to canonical form', () => {
      assert.strictEqual(
        normalizePositionKey('Present — core situation'),
        'Present — core situation (Card 1)'
      );
    });

    it('passes through already-canonical position unchanged', () => {
      assert.strictEqual(
        normalizePositionKey('Present — core situation (Card 1)'),
        'Present — core situation (Card 1)'
      );
    });

    it('normalizes all 10 Celtic Cross positions', () => {
      const mappings = [
        ['Present — core situation', 'Present — core situation (Card 1)'],
        ['Challenge — crossing / tension', 'Challenge — crossing / tension (Card 2)'],
        ['Past — what lies behind', 'Past — what lies behind (Card 3)'],
        ['Near Future — what lies before', 'Near Future — what lies before (Card 4)'],
        ['Conscious — goals & focus', 'Conscious — goals & focus (Card 5)'],
        ['Subconscious — roots / hidden forces', 'Subconscious — roots / hidden forces (Card 6)'],
        ['Self / Advice — how to meet this', 'Self / Advice — how to meet this (Card 7)'],
        ['External Influences — people & environment', 'External Influences — people & environment (Card 8)'],
        ['Hopes & Fears — deepest wishes & worries', 'Hopes & Fears — deepest wishes & worries (Card 9)'],
        ['Outcome — likely path if unchanged', 'Outcome — likely path if unchanged (Card 10)']
      ];

      for (const [input, expected] of mappings) {
        assert.strictEqual(normalizePositionKey(input), expected, `Failed for: ${input}`);
      }
    });
  });

  describe('Other spread positions', () => {
    it('passes through Three-Card positions unchanged (already match)', () => {
      assert.strictEqual(
        normalizePositionKey('Past — influences that led here'),
        'Past — influences that led here'
      );
    });

    it('passes through unknown positions unchanged', () => {
      assert.strictEqual(
        normalizePositionKey('Custom Position'),
        'Custom Position'
      );
    });
  });
});

describe('buildPositionCardText with Celtic Cross positions', () => {
  it('uses position-specific template for normalized Celtic Cross position', () => {
    const cardInfo = {
      card: 'The Magician',
      number: 1,
      orientation: 'Upright',
      meaning: 'Willpower and manifestation.'
    };

    // Position from spreads.js (without Card #)
    const result = buildPositionCardText(cardInfo, 'Present — core situation', {});

    // Should contain position-specific intro (not generic fallback)
    assert.ok(
      result.includes('At the heart of this moment') ||
      result.includes('Right now, your story') ||
      result.includes('The core tone of this moment'),
      `Expected position-specific intro, got: ${result.substring(0, 200)}`
    );
  });

  it('still handles unknown positions with fallback', () => {
    const cardInfo = {
      card: 'The Fool',
      number: 0,
      orientation: 'Reversed',
      meaning: 'New beginnings with caution.'
    };

    const result = buildPositionCardText(cardInfo, 'Unknown Custom Position', {});

    // Should contain the position name (fallback behavior)
    assert.ok(result.includes('Unknown Custom Position'));
  });

  it('produces deterministic text for identical inputs', () => {
    const cardInfo = {
      card: 'The Magician',
      number: 1,
      orientation: 'Upright',
      meaning: 'Willpower and manifestation.'
    };

    const first = buildPositionCardText(cardInfo, 'Present — core situation', { context: 'career' });
    const second = buildPositionCardText(cardInfo, 'Present — core situation', { context: 'career' });

    assert.strictEqual(first, second);
  });
});

describe('getConnector with Celtic Cross positions', () => {
  it('returns connector for normalized Celtic Cross position', () => {
    // 'Past — what lies behind' has connectorToNext defined
    const connector = getConnector('Past — what lies behind', 'toNext');

    assert.ok(
      connector === 'Because of this,' ||
      connector === 'Because of this history,' ||
      connector === 'Because of this groundwork,',
      `Expected a valid connector, got: "${connector}"`
    );
  });

  it('returns empty string for unknown position', () => {
    const connector = getConnector('Unknown Position', 'toPrev');
    assert.strictEqual(connector, '');
  });

  it('returns deterministic connectors for identical inputs', () => {
    const first = getConnector('Past — what lies behind', 'toNext');
    const second = getConnector('Past — what lies behind', 'toNext');
    assert.strictEqual(first, second);
  });
});
