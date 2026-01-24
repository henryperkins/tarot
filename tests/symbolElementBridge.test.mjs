import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  buildSymbolElementCue,
  getSymbolFollowUpPrompt,
  getElementForSymbolFamily,
  enrichSymbolWithElement,
  symbolMatchesDominantElement,
  ELEMENT_FAMILY_MAP
} from '../src/lib/symbolElementBridge.js';

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

  test('getElementForSymbolFamily maps fire symbols correctly', () => {
    assert.equal(getElementForSymbolFamily('fire'), 'Fire');
    assert.equal(getElementForSymbolFamily('flame'), 'Fire');
    assert.equal(getElementForSymbolFamily('wand'), 'Fire');
    assert.equal(getElementForSymbolFamily('torch'), 'Fire');
    assert.equal(getElementForSymbolFamily('sun'), 'Fire');
  });

  test('getElementForSymbolFamily maps water symbols correctly', () => {
    assert.equal(getElementForSymbolFamily('water'), 'Water');
    assert.equal(getElementForSymbolFamily('cup'), 'Water');
    assert.equal(getElementForSymbolFamily('chalice'), 'Water');
    assert.equal(getElementForSymbolFamily('moon'), 'Water');
  });

  test('getElementForSymbolFamily maps air symbols correctly', () => {
    assert.equal(getElementForSymbolFamily('sword'), 'Air');
    assert.equal(getElementForSymbolFamily('feather'), 'Air');
    assert.equal(getElementForSymbolFamily('cloud'), 'Air');
  });

  test('getElementForSymbolFamily maps earth symbols correctly', () => {
    assert.equal(getElementForSymbolFamily('pentacle'), 'Earth');
    assert.equal(getElementForSymbolFamily('mountains'), 'Earth');
    assert.equal(getElementForSymbolFamily('tree'), 'Earth');
    assert.equal(getElementForSymbolFamily('stone'), 'Earth');
  });

  test('getElementForSymbolFamily returns null for unmapped symbols', () => {
    assert.equal(getElementForSymbolFamily('unknown'), null);
    assert.equal(getElementForSymbolFamily(null), null);
    assert.equal(getElementForSymbolFamily(''), null);
  });

  test('enrichSymbolWithElement adds element to symbol', () => {
    const symbol = { object: 'wand', family: 'wand' };
    const enriched = enrichSymbolWithElement(symbol);
    assert.equal(enriched.element, 'Fire');
    assert.equal(enriched.object, 'wand');
  });

  test('symbolMatchesDominantElement returns true when symbol matches', () => {
    const symbol = { object: 'wand', family: 'wand' };
    const themes = {
      elementCounts: { Fire: 3, Water: 0, Air: 0, Earth: 0 }
    };
    assert.equal(symbolMatchesDominantElement(symbol, themes), true);
  });

  test('symbolMatchesDominantElement returns false when symbol does not match', () => {
    const symbol = { object: 'cup', family: 'cup' };
    const themes = {
      elementCounts: { Fire: 3, Water: 0, Air: 0, Earth: 0 }
    };
    assert.equal(symbolMatchesDominantElement(symbol, themes), false);
  });

  test('ELEMENT_FAMILY_MAP contains all four elements', () => {
    assert.ok(ELEMENT_FAMILY_MAP.Fire, 'Fire should be present');
    assert.ok(ELEMENT_FAMILY_MAP.Water, 'Water should be present');
    assert.ok(ELEMENT_FAMILY_MAP.Air, 'Air should be present');
    assert.ok(ELEMENT_FAMILY_MAP.Earth, 'Earth should be present');
    assert.ok(ELEMENT_FAMILY_MAP.Fire.includes('fire'), 'Fire should include fire symbol');
    assert.ok(ELEMENT_FAMILY_MAP.Water.includes('water'), 'Water should include water symbol');
  });
});
