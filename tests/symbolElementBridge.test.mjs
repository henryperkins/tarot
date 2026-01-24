import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { buildSymbolElementCue, getSymbolFollowUpPrompt } from '../src/lib/symbolElementBridge.js';

describe('symbolElementBridge', () => {
  test('buildSymbolElementCue returns cue for dominant suit with matching symbols', () => {
    const reading = [{ name: 'Ace of Wands' }];
    const themes = {
      suitCounts: { Wands: 3, Cups: 0, Swords: 0, Pentacles: 0 },
      elementCounts: { Fire: 3, Water: 0, Air: 0, Earth: 0 }
    };

    const cue = buildSymbolElementCue({ reading, themes });
    assert.ok(cue, 'Expected a cue to be returned');
    assert.ok(cue.text.includes('Wands') || cue.text.includes('Fire'));
    assert.ok(cue.text.toLowerCase().includes('wand'));
  });

  test('getSymbolFollowUpPrompt prefers dominant family when available', () => {
    const reading = [
      { name: 'Ace of Wands' },
      { name: 'Ace of Wands' }
    ];
    const themes = {
      suitCounts: { Wands: 3, Cups: 0, Swords: 0, Pentacles: 0 }
    };

    const prompt = getSymbolFollowUpPrompt(reading, themes);
    assert.ok(prompt, 'Expected a symbol prompt');
    assert.ok(prompt.toLowerCase().includes('wand'));
  });
});
