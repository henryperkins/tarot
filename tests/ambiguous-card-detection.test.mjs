/**
 * Test for ambiguous card detection patterns
 * Verifies that hasExplicitCardContext correctly identifies card references
 * while avoiding false positives from common vocabulary.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Import the actual implementation from the shared module
import { hasExplicitCardContext } from '../functions/lib/cardContextDetection.js';

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
