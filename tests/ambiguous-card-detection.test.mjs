/**
 * Test for ambiguous card detection patterns
 * Verifies that hasExplicitCardContext correctly identifies card references
 * while avoiding false positives from common vocabulary.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Inline the function for testing (mirrors tarot-reading.js implementation)
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function hasExplicitCardContext(text = '', name = '') {
  if (!text || !name) return false;

  const namePattern = escapeRegex(name);

  const patterns = [
    // "Justice card", "Death card", "the Strength card", etc.
    new RegExp(`\\b(?:the\\s+)?${namePattern}\\s+card\\b`, 'i'),

    // "Justice (Major Arcana)", "Major Arcana Justice", "Major Arcana: Death"
    new RegExp(`\\b${namePattern}\\b[^\\n]{0,40}\\bmajor arcana\\b`, 'i'),
    new RegExp(`\\bmajor arcana\\b[^\\n]{0,40}\\b${namePattern}\\b`, 'i'),

    // "The Death archetype", "Strength archetype", "archetype of Death"
    new RegExp(`\\b(?:the\\s+)?${namePattern}\\s+archetype\\b`, 'i'),
    new RegExp(`\\barchetype\\s+(?:of\\s+)?(?:the\\s+)?${namePattern}\\b`, 'i'),

    // "Death reversed", "Justice upright", "Strength (reversed)"
    new RegExp(`\\b${namePattern}\\s+(?:reversed|upright)\\b`, 'i'),
    new RegExp(`\\b${namePattern}\\s*\\(\\s*(?:reversed|upright)\\s*\\)`, 'i'),

    // Markdown bold formatting: "**Death**", "**Justice**"
    new RegExp(`\\*\\*${namePattern}\\*\\*`, 'i'),

    // Position labels: "Present: Death", "Card 1: Justice", "Outcome — Death"
    new RegExp(`\\b(?:present|past|future|challenge|outcome|advice|anchor|core|heart|theme|guidance|position|card\\s*\\d+)\\s*[:\\-–—]\\s*(?:the\\s+)?${namePattern}\\b`, 'i'),

    // Card name followed by position context: "Death in the Present position"
    new RegExp(`\\b${namePattern}\\s+(?:in\\s+(?:the\\s+)?)?(?:present|past|future|challenge|outcome|advice|anchor)\\s+position\\b`, 'i')
  ];

  return patterns.some((regex) => regex.test(text));
}

describe('hasExplicitCardContext patterns', () => {
  describe('should detect card references', () => {
    it('detects "Death card"', () => {
      assert.equal(hasExplicitCardContext('The Death card appears in this spread', 'Death'), true);
    });

    it('detects markdown bold **Death**', () => {
      assert.equal(hasExplicitCardContext('Here we see **Death** reversed', 'Death'), true);
    });

    it('detects "Death archetype"', () => {
      assert.equal(hasExplicitCardContext('The Death archetype represents transformation', 'Death'), true);
    });

    it('detects "archetype of Death"', () => {
      assert.equal(hasExplicitCardContext('This speaks to the archetype of Death', 'Death'), true);
    });

    it('detects "Death reversed"', () => {
      assert.equal(hasExplicitCardContext('Death reversed suggests resistance', 'Death'), true);
    });

    it('detects "Justice upright"', () => {
      assert.equal(hasExplicitCardContext('Justice upright brings balance', 'Justice'), true);
    });

    it('detects "Strength (reversed)"', () => {
      assert.equal(hasExplicitCardContext('Strength (reversed) indicates inner work', 'Strength'), true);
    });

    it('detects position label "Present: Death"', () => {
      assert.equal(hasExplicitCardContext('Present: Death shows the core situation', 'Death'), true);
    });

    it('detects position label "Card 1: Justice"', () => {
      assert.equal(hasExplicitCardContext('Card 1: Justice sits at the center', 'Justice'), true);
    });

    it('detects "Outcome — Death"', () => {
      assert.equal(hasExplicitCardContext('Outcome — Death suggests transformation', 'Death'), true);
    });
  });

  describe('should NOT detect common vocabulary', () => {
    it('ignores "a sense of justice"', () => {
      assert.equal(hasExplicitCardContext('Restore a sense of justice in how you negotiate', 'Justice'), false);
    });

    it('ignores "inner strength"', () => {
      assert.equal(hasExplicitCardContext('Find your inner strength and resilience', 'Strength'), false);
    });

    it('ignores "death of old patterns"', () => {
      assert.equal(hasExplicitCardContext('The death of old patterns brings renewal', 'Death'), false);
    });

    it('ignores "practice temperance"', () => {
      assert.equal(hasExplicitCardContext('Practice temperance in your daily habits', 'Temperance'), false);
    });

    it('ignores "exercise judgement"', () => {
      assert.equal(hasExplicitCardContext('You must exercise sound judgement here', 'Judgement'), false);
    });
  });
});
