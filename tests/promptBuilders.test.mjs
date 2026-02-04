// tests/promptBuilders.test.mjs
// Unit tests for story art and video prompt builders

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  buildSingleScenePrompt,
  buildTriptychPrompt,
  buildCardVignettePrompt
} from '../functions/lib/storyArtPrompts.js';
import {
  buildCardRevealPrompt,
  buildKeyframePrompt,
  buildRevealSequence
} from '../functions/lib/videoPrompts.js';

// Test fixtures
const majorArcanaCard = {
  name: 'The Fool',
  number: 0,
  suit: null,
  rank: null,
  position: 'Present',
  reversed: false,
  meaning: 'New beginnings, spontaneity, adventure'
};

const majorArcanaReversed = {
  ...majorArcanaCard,
  reversed: true,
  meaning: 'Recklessness, risk-taking, lack of direction'
};

const minorArcanaCard = {
  name: 'Three of Pentacles',
  number: null,
  suit: 'pentacles',
  rank: 'three',
  rankValue: 3,
  position: 'Future',
  reversed: false,
  meaning: 'Teamwork, collaboration, learning'
};

const courtCard = {
  name: 'Queen of Cups',
  number: null,
  suit: 'cups',
  rank: 'queen',
  rankValue: 13,
  position: 'Advice',
  reversed: false,
  meaning: 'Emotional security, intuition, compassion'
};

const testQuestion = 'Should I start a new creative project?';
const careerQuestion = 'Will I get the promotion at work?';

describe('buildSingleScenePrompt', () => {
  it('generates prompt for Major Arcana cards', () => {
    const prompt = buildSingleScenePrompt([majorArcanaCard], testQuestion, 'watercolor');
    
    assert.ok(prompt.includes('The Fool'), 'Should include card name');
    assert.ok(prompt.includes('Present'), 'Should include position');
    assert.ok(prompt.includes(testQuestion), 'Should include question');
    assert.ok(prompt.includes('No text'), 'Should have text constraint');
  });

  it('generates prompt for Minor Arcana cards', () => {
    const prompt = buildSingleScenePrompt([minorArcanaCard], testQuestion, 'watercolor');
    
    assert.ok(prompt.includes('Three of Pentacles'), 'Should include card name');
    assert.ok(prompt.includes('earth'), 'Should include element');
    assert.ok(prompt.includes('Future'), 'Should include position');
  });

  it('handles mixed Major and Minor Arcana', () => {
    const prompt = buildSingleScenePrompt([majorArcanaCard, minorArcanaCard], testQuestion, 'watercolor');
    
    assert.ok(prompt.includes('The Fool'), 'Should include Major card');
    assert.ok(prompt.includes('Three of Pentacles'), 'Should include Minor card');
  });

  it('applies question category visual cues', () => {
    const prompt = buildSingleScenePrompt([majorArcanaCard], careerQuestion, 'watercolor');
    
    // Career questions should get career-related visual cues
    assert.ok(
      prompt.toLowerCase().includes('path') ||
      prompt.toLowerCase().includes('workspace') ||
      prompt.toLowerCase().includes('opportunity') ||
      prompt.toLowerCase().includes('professional'),
      'Should include career-related visual cues'
    );
  });

  it('applies reversal treatment consistently', () => {
    const prompt = buildSingleScenePrompt([majorArcanaReversed], testQuestion, 'watercolor');
    
    assert.ok(
      prompt.toLowerCase().includes('shadow') ||
      prompt.toLowerCase().includes('internalized') ||
      prompt.toLowerCase().includes('muted') ||
      prompt.toLowerCase().includes('veiled'),
      'Reversed card should have reversal visual treatment'
    );
  });

  it('includes narrative context when provided', () => {
    const narrative = 'The querent is at a crossroads in their creative journey...';
    const prompt = buildSingleScenePrompt([majorArcanaCard], testQuestion, 'watercolor', narrative);
    
    assert.ok(prompt.includes('NARRATIVE CONTEXT'), 'Should include narrative label');
    assert.ok(prompt.includes('crossroads'), 'Should include narrative content');
  });
});

describe('buildTriptychPrompt', () => {
  it('generates three-panel prompt', () => {
    const cards = [majorArcanaCard, minorArcanaCard, courtCard];
    const prompt = buildTriptychPrompt(cards, testQuestion, 'watercolor');
    
    assert.ok(prompt.includes('LEFT PANEL'), 'Should have left panel');
    assert.ok(prompt.includes('CENTER PANEL'), 'Should have center panel');
    assert.ok(prompt.includes('RIGHT PANEL'), 'Should have right panel');
    assert.ok(prompt.includes('TRIPTYCH'), 'Should mention triptych format');
  });

  it('includes question category environment cues', () => {
    const cards = [majorArcanaCard, minorArcanaCard, courtCard];
    const prompt = buildTriptychPrompt(cards, careerQuestion, 'watercolor');
    
    assert.ok(prompt.includes('Environment cues'), 'Should have environment cues');
  });

  it('handles Minor Arcana with elemental energy', () => {
    const cards = [minorArcanaCard, courtCard, majorArcanaCard];
    const prompt = buildTriptychPrompt(cards, testQuestion, 'watercolor');
    
    // Minor cards should show elemental energy
    assert.ok(
      prompt.toLowerCase().includes('earth') ||
      prompt.toLowerCase().includes('water') ||
      prompt.toLowerCase().includes('element'),
      'Should include elemental energy for Minor Arcana'
    );
  });
});

describe('buildCardVignettePrompt', () => {
  it('generates single card vignette', () => {
    const prompt = buildCardVignettePrompt(majorArcanaCard, testQuestion, 'Present', 'watercolor');
    
    assert.ok(prompt.includes('The Fool'), 'Should include card name');
    assert.ok(prompt.includes('Present'), 'Should include position');
    assert.ok(prompt.includes('vignette'), 'Should mention vignette format');
    assert.ok(prompt.includes('9:16'), 'Should specify portrait aspect ratio');
  });

  it('includes suit symbols for Minor Arcana', () => {
    const prompt = buildCardVignettePrompt(minorArcanaCard, testQuestion, 'Future', 'watercolor');
    
    assert.ok(
      prompt.includes('ELEMENTAL ENERGY') ||
      prompt.includes('earth') ||
      prompt.includes('pentacle'),
      'Should include suit/element information'
    );
  });

  it('applies question theme cues', () => {
    const prompt = buildCardVignettePrompt(majorArcanaCard, careerQuestion, 'Present', 'watercolor');
    
    assert.ok(prompt.includes('QUESTION THEME CUES'), 'Should have question theme cues section');
  });

  it('applies unified reversal treatment', () => {
    const reversedMinor = { ...minorArcanaCard, reversed: true };
    const prompt = buildCardVignettePrompt(reversedMinor, testQuestion, 'Future', 'watercolor');
    
    assert.ok(
      prompt.toLowerCase().includes('shadow') ||
      prompt.toLowerCase().includes('internalized') ||
      prompt.toLowerCase().includes('veiled'),
      'Should apply reversal treatment'
    );
  });
});

describe('buildKeyframePrompt', () => {
  it('returns object with prompt and startingPoseDescription', () => {
    const result = buildKeyframePrompt(majorArcanaCard, testQuestion, 'Present', 'mystical');
    
    assert.ok(typeof result === 'object', 'Should return object');
    assert.ok(result.prompt, 'Should have prompt property');
    assert.ok(result.startingPoseDescription, 'Should have startingPoseDescription');
  });

  it('maintains backwards compatibility with toString', () => {
    const result = buildKeyframePrompt(majorArcanaCard, testQuestion, 'Present', 'mystical');
    
    assert.strictEqual(result.toString(), result.prompt, 'toString should return prompt');
    assert.strictEqual(String(result), result.prompt, 'String coercion should work');
  });

  it('includes question category environment cues', () => {
    const result = buildKeyframePrompt(majorArcanaCard, careerQuestion, 'Present', 'mystical');
    
    assert.ok(result.prompt.includes('Environment cues'), 'Should have environment cues');
  });

  it('generates starting pose for Minor Arcana', () => {
    const result = buildKeyframePrompt(minorArcanaCard, testQuestion, 'Future', 'mystical');
    
    assert.ok(result.startingPoseDescription, 'Should have starting pose');
    assert.ok(result.prompt.includes('STARTING POSE'), 'Prompt should include starting pose section');
  });

  it('applies unified reversal treatment', () => {
    const result = buildKeyframePrompt(majorArcanaReversed, testQuestion, 'Present', 'mystical');
    
    assert.ok(
      result.prompt.toLowerCase().includes('contained') ||
      result.prompt.toLowerCase().includes('desaturated') ||
      result.prompt.toLowerCase().includes('diffused'),
      'Should apply keyframe reversal treatment'
    );
  });
});

describe('buildCardRevealPrompt', () => {
  it('generates video prompt for Major Arcana', () => {
    const prompt = buildCardRevealPrompt(majorArcanaCard, testQuestion, 'Present', 'mystical');
    
    assert.ok(prompt.includes('The Fool'), 'Should include card name');
    assert.ok(prompt.includes('Cinematography'), 'Should include cinematography section');
    assert.ok(prompt.includes('Actions'), 'Should include actions section');
  });

  it('generates video prompt for Minor Arcana with suit atmosphere', () => {
    const prompt = buildCardRevealPrompt(minorArcanaCard, testQuestion, 'Future', 'mystical');
    
    assert.ok(prompt.includes('Three of Pentacles'), 'Should include card name');
    assert.ok(
      prompt.toLowerCase().includes('suit atmosphere') ||
      prompt.toLowerCase().includes('earth'),
      'Should include suit-specific atmosphere'
    );
  });

  it('includes question theme visual metaphors', () => {
    const prompt = buildCardRevealPrompt(majorArcanaCard, careerQuestion, 'Present', 'mystical');
    
    assert.ok(prompt.includes('Visual metaphor'), 'Should include visual metaphor');
    assert.ok(prompt.includes('Question theme cues'), 'Should include question cues');
  });

  it('aligns with keyframe starting pose when provided', () => {
    const keyframeDesc = 'Figure stands at crossroads, hand raised';
    const prompt = buildCardRevealPrompt(majorArcanaCard, testQuestion, 'Present', 'mystical', keyframeDesc);
    
    assert.ok(prompt.includes('STARTING STATE'), 'Should have starting state section');
    assert.ok(prompt.includes(keyframeDesc), 'Should include keyframe description');
  });

  it('applies unified reversal treatment', () => {
    const prompt = buildCardRevealPrompt(majorArcanaReversed, testQuestion, 'Present', 'mystical');
    
    assert.ok(prompt.includes('REVERSED ENERGY'), 'Should have reversed energy section');
    assert.ok(
      prompt.toLowerCase().includes('underwater') ||
      prompt.toLowerCase().includes('inward') ||
      prompt.toLowerCase().includes('hesitant'),
      'Should apply video reversal treatment'
    );
  });
});

describe('buildRevealSequence', () => {
  it('generates sequence with linked keyframe and video prompts', () => {
    const cards = [majorArcanaCard, minorArcanaCard];
    const sequence = buildRevealSequence(cards, testQuestion, 'mystical');
    
    assert.strictEqual(sequence.length, 2, 'Should have one item per card');
    
    for (const item of sequence) {
      assert.ok(item.keyframePrompt, 'Should have keyframe prompt');
      assert.ok(item.videoPrompt, 'Should have video prompt');
      assert.strictEqual(item.duration, 4, 'Should have 4-second duration');
      assert.strictEqual(item.size, '1280x720', 'Should have correct size');
    }
  });

  it('passes keyframe starting pose to video prompt', () => {
    const cards = [majorArcanaCard];
    const sequence = buildRevealSequence(cards, testQuestion, 'mystical');
    
    // Video prompt should receive keyframe's starting pose description
    assert.ok(sequence[0].videoPrompt.includes('STARTING STATE'), 'Video should have starting state from keyframe');
  });
});

describe('style consistency', () => {
  const styles = ['watercolor', 'celestial', 'tarot', 'cosmic'];
  
  it('all styles produce valid prompts', () => {
    for (const style of styles) {
      const imagePrompt = buildSingleScenePrompt([majorArcanaCard], testQuestion, style);
      assert.ok(imagePrompt.length > 100, `${style} image prompt should have content`);
      
      const videoPrompt = buildCardRevealPrompt(majorArcanaCard, testQuestion, 'Present', style);
      assert.ok(videoPrompt.length > 100, `${style} video prompt should have content`);
    }
  });
});

describe('constraint enforcement', () => {
  it('image prompts include no-text constraint', () => {
    const prompt = buildSingleScenePrompt([majorArcanaCard], testQuestion, 'watercolor');
    assert.ok(prompt.toLowerCase().includes('no text'), 'Should forbid text');
  });

  it('video prompts include no-text constraint', () => {
    const prompt = buildCardRevealPrompt(majorArcanaCard, testQuestion, 'Present', 'mystical');
    assert.ok(prompt.toLowerCase().includes('no text'), 'Should forbid text');
  });

  it('image prompts forbid modern objects', () => {
    const prompt = buildSingleScenePrompt([majorArcanaCard], testQuestion, 'watercolor');
    assert.ok(prompt.toLowerCase().includes('no modern'), 'Should forbid modern objects');
  });

  it('video prompts forbid modern objects', () => {
    const prompt = buildCardRevealPrompt(majorArcanaCard, testQuestion, 'Present', 'mystical');
    assert.ok(prompt.toLowerCase().includes('no modern'), 'Should forbid modern objects');
  });
});
