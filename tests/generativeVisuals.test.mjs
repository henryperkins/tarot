// tests/generativeVisuals.test.mjs
// Unit tests for generative visual utilities

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  QUESTION_VISUAL_CUES,
  REVERSAL_TREATMENT,
  MINOR_ANIMATIONS,
  SUIT_ANIMATION_MODIFIERS,
  detectQuestionCategory,
  getCardVisuals,
  getCardAnimation
} from '../functions/lib/generativeVisuals.js';

describe('detectQuestionCategory', () => {
  it('detects career-related questions', () => {
    assert.strictEqual(detectQuestionCategory('Should I take this job offer?'), 'career');
    assert.strictEqual(detectQuestionCategory('Will I get the promotion?'), 'career');
    assert.strictEqual(detectQuestionCategory('What about my business venture?'), 'career');
  });

  it('detects relationship-related questions', () => {
    assert.strictEqual(detectQuestionCategory('Is this relationship right for me?'), 'relationship');
    assert.strictEqual(detectQuestionCategory('Will I find love?'), 'relationship');
    assert.strictEqual(detectQuestionCategory('Should I marry them?'), 'relationship');
  });

  it('detects finance-related questions', () => {
    assert.strictEqual(detectQuestionCategory('Should I invest in stocks?'), 'finance');
    assert.strictEqual(detectQuestionCategory('Will I get out of debt?'), 'finance');
    assert.strictEqual(detectQuestionCategory('Can I afford this house?'), 'finance');
  });

  it('detects spiritual-related questions', () => {
    assert.strictEqual(detectQuestionCategory('What is my soul purpose?'), 'spiritual');
    assert.strictEqual(detectQuestionCategory('How do I find enlightenment?'), 'spiritual');
    assert.strictEqual(detectQuestionCategory('What does the universe want from me?'), 'spiritual');
  });

  it('detects health-related questions', () => {
    assert.strictEqual(detectQuestionCategory('Will I recover from this illness?'), 'health');
    assert.strictEqual(detectQuestionCategory('How is my mental health journey going?'), 'health');
    assert.strictEqual(detectQuestionCategory('Why am I so tired?'), 'health');
  });

  it('detects decision-related questions', () => {
    assert.strictEqual(detectQuestionCategory('Should I move to a new city?'), 'decision');
    assert.strictEqual(detectQuestionCategory('Which option should I choose?'), 'decision');
    assert.strictEqual(detectQuestionCategory('Whether or not to proceed?'), 'decision');
  });

  it('returns general for unmatched questions', () => {
    assert.strictEqual(detectQuestionCategory('What does the future hold?'), 'general');
    assert.strictEqual(detectQuestionCategory(''), 'general');
    assert.strictEqual(detectQuestionCategory('Tell me something'), 'general');
  });
});

describe('QUESTION_VISUAL_CUES', () => {
  it('has all expected categories', () => {
    const expectedCategories = ['career', 'relationship', 'finance', 'spiritual', 'health', 'decision', 'general'];
    for (const category of expectedCategories) {
      assert.ok(QUESTION_VISUAL_CUES[category], `Missing category: ${category}`);
      assert.ok(QUESTION_VISUAL_CUES[category].cues, `${category} missing cues`);
      assert.ok(QUESTION_VISUAL_CUES[category].environment, `${category} missing environment`);
      assert.ok(QUESTION_VISUAL_CUES[category].metaphors, `${category} missing metaphors`);
    }
  });
});

describe('REVERSAL_TREATMENT', () => {
  it('has all required treatment specs', () => {
    assert.ok(REVERSAL_TREATMENT.colors, 'Missing colors');
    assert.ok(REVERSAL_TREATMENT.lighting, 'Missing lighting');
    assert.ok(REVERSAL_TREATMENT.motion, 'Missing motion');
    assert.ok(REVERSAL_TREATMENT.symbols, 'Missing symbols');
    assert.ok(REVERSAL_TREATMENT.mood, 'Missing mood');
    assert.ok(REVERSAL_TREATMENT.forImage, 'Missing forImage prompt fragment');
    assert.ok(REVERSAL_TREATMENT.forKeyframe, 'Missing forKeyframe prompt fragment');
    assert.ok(REVERSAL_TREATMENT.forVideo, 'Missing forVideo prompt fragment');
  });

  it('contains consistent visual language', () => {
    // All reversal treatments should mention internalization, shadow, or muting
    const allTreatments = [REVERSAL_TREATMENT.forImage, REVERSAL_TREATMENT.forKeyframe, REVERSAL_TREATMENT.forVideo];
    for (const treatment of allTreatments) {
      const hasConsistentLanguage = 
        treatment.toLowerCase().includes('shadow') ||
        treatment.toLowerCase().includes('muted') ||
        treatment.toLowerCase().includes('desaturated') ||
        treatment.toLowerCase().includes('internalized') ||
        treatment.toLowerCase().includes('contained') ||
        treatment.toLowerCase().includes('inward');
      assert.ok(hasConsistentLanguage, `Treatment lacks reversal visual language: ${treatment}`);
    }
  });
});

describe('getCardVisuals', () => {
  describe('Major Arcana', () => {
    it('returns visual data for Major Arcana by number', () => {
      const foolCard = { name: 'The Fool', number: 0 };
      const visual = getCardVisuals(foolCard);
      
      assert.strictEqual(visual.type, 'major');
      assert.ok(visual.figure, 'Missing figure');
      assert.ok(visual.element, 'Missing element');
    });

    it('handles all 22 Major Arcana cards', () => {
      for (let i = 0; i <= 21; i++) {
        const card = { name: `Card ${i}`, number: i };
        const visual = getCardVisuals(card);
        assert.strictEqual(visual.type, 'major', `Card ${i} should be major`);
      }
    });
  });

  describe('Minor Arcana', () => {
    it('returns visual data for court cards', () => {
      const queenCups = { name: 'Queen of Cups', suit: 'cups', rank: 'queen', rankValue: 13 };
      const visual = getCardVisuals(queenCups);
      
      assert.ok(visual.type === 'court' || visual.type === 'unknown', 'Court card should be court or fallback');
      assert.ok(visual.element, 'Missing element');
      assert.ok(visual.suit, 'Missing suit');
    });

    it('returns visual data for pip cards', () => {
      const threePentacles = { name: 'Three of Pentacles', suit: 'pentacles', rank: 'three', rankValue: 3 };
      const visual = getCardVisuals(threePentacles);
      
      assert.ok(visual.type === 'pip' || visual.type === 'unknown', 'Pip card should be pip or fallback');
      assert.ok(visual.element, 'Missing element');
      assert.ok(visual.suit, 'Missing suit');
    });

    it('maps suits to correct elements', () => {
      const suitElements = {
        wands: 'fire',
        cups: 'water',
        swords: 'air',
        pentacles: 'earth'
      };

      for (const [suit, expectedElement] of Object.entries(suitElements)) {
        const card = { name: `Ace of ${suit.charAt(0).toUpperCase() + suit.slice(1)}`, suit, rank: 'ace', rankValue: 1 };
        const visual = getCardVisuals(card);
        assert.strictEqual(visual.element, expectedElement, `${suit} should map to ${expectedElement}`);
      }
    });
  });

  describe('fallback behavior', () => {
    it('provides fallback for unknown cards', () => {
      const unknownCard = { name: 'Unknown Card', number: null, suit: 'wands' };
      const visual = getCardVisuals(unknownCard);
      
      assert.ok(visual.visual, 'Should have fallback visual');
      assert.ok(visual.figure, 'Should have fallback figure');
    });
  });
});

describe('getCardAnimation', () => {
  it('returns null for Major Arcana (use CARD_ANIMATIONS instead)', () => {
    const majorCard = { name: 'The Magician', number: 1 };
    const animation = getCardAnimation(majorCard);
    assert.strictEqual(animation, null);
  });

  it('returns animation data for Minor Arcana', () => {
    const card = { name: 'Five of Swords', suit: 'swords', rank: 'five', rankValue: 5 };
    const animation = getCardAnimation(card);
    
    assert.ok(animation, 'Should return animation');
    assert.ok(animation.action, 'Missing action');
    assert.ok(animation.camera, 'Missing camera');
    assert.ok(animation.beat, 'Missing beat');
    assert.ok(animation.atmosphere, 'Missing atmosphere');
  });

  it('includes suit-specific motion modifiers', () => {
    const wandsCard = { name: 'Knight of Wands', suit: 'wands', rank: 'knight', rankValue: 12 };
    const animation = getCardAnimation(wandsCard);
    
    assert.ok(animation.action.toLowerCase().includes('flame') || 
              animation.action.toLowerCase().includes('spark') ||
              animation.atmosphere.toLowerCase().includes('warm') ||
              animation.atmosphere.toLowerCase().includes('fire'),
              'Wands animation should have fire-related motion');
  });
});

describe('MINOR_ANIMATIONS', () => {
  it('has animations for all ranks', () => {
    const expectedRanks = ['ace', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'page', 'knight', 'queen', 'king'];
    for (const rank of expectedRanks) {
      assert.ok(MINOR_ANIMATIONS[rank], `Missing animation for rank: ${rank}`);
      assert.ok(MINOR_ANIMATIONS[rank].action, `${rank} missing action`);
      assert.ok(MINOR_ANIMATIONS[rank].camera, `${rank} missing camera`);
      assert.ok(MINOR_ANIMATIONS[rank].beat, `${rank} missing beat`);
    }
  });

  it('ace has startingPose for keyframe alignment', () => {
    assert.ok(MINOR_ANIMATIONS.ace.startingPose, 'Ace should have startingPose for keyframe alignment');
  });
});

describe('SUIT_ANIMATION_MODIFIERS', () => {
  it('has modifiers for all four suits', () => {
    const expectedSuits = ['wands', 'cups', 'swords', 'pentacles'];
    for (const suit of expectedSuits) {
      assert.ok(SUIT_ANIMATION_MODIFIERS[suit], `Missing modifier for suit: ${suit}`);
      assert.ok(SUIT_ANIMATION_MODIFIERS[suit].motion, `${suit} missing motion`);
      assert.ok(SUIT_ANIMATION_MODIFIERS[suit].atmosphere, `${suit} missing atmosphere`);
      assert.ok(SUIT_ANIMATION_MODIFIERS[suit].soundscape, `${suit} missing soundscape`);
    }
  });

  it('motion descriptions include elemental cues', () => {
    assert.ok(SUIT_ANIMATION_MODIFIERS.wands.motion.toLowerCase().includes('flame') || 
              SUIT_ANIMATION_MODIFIERS.wands.motion.toLowerCase().includes('spark'),
              'Wands should have fire motion');
    assert.ok(SUIT_ANIMATION_MODIFIERS.cups.motion.toLowerCase().includes('water') || 
              SUIT_ANIMATION_MODIFIERS.cups.motion.toLowerCase().includes('flow'),
              'Cups should have water motion');
    assert.ok(SUIT_ANIMATION_MODIFIERS.swords.motion.toLowerCase().includes('wind') || 
              SUIT_ANIMATION_MODIFIERS.swords.motion.toLowerCase().includes('air'),
              'Swords should have air motion');
    assert.ok(SUIT_ANIMATION_MODIFIERS.pentacles.motion.toLowerCase().includes('earth') || 
              SUIT_ANIMATION_MODIFIERS.pentacles.motion.toLowerCase().includes('grow'),
              'Pentacles should have earth motion');
  });
});
