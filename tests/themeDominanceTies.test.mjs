import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSpreadThemes } from '../functions/lib/spreadAnalysis.js';
import { generateFollowUpSuggestions } from '../src/lib/followUpSuggestions.js';
import { buildSymbolElementCue } from '../src/lib/symbolElementBridge.js';
import { normalizeThemeLabel } from '../src/lib/themeText.js';

function minor(card, suit) {
  return { card, name: card, suit, position: 'Card', orientation: 'Upright', meaning: 'Test meaning.' };
}

// Wands and Cups tie at two cards each (so Fire and Water tie too); Swords trails.
const TIED_TWO_WAY = [
  minor('Two of Wands', 'Wands'),
  minor('Three of Wands', 'Wands'),
  minor('Two of Cups', 'Cups'),
  minor('Three of Cups', 'Cups'),
  minor('Two of Swords', 'Swords')
];

describe('theme dominance with tied counts', () => {
  it('names no dominant suit when every suit appears once', async () => {
    // The reviewed reading: one card per suit plus Strength (Leo → Fire).
    const themes = await analyzeSpreadThemes([
      minor('Two of Swords', 'Swords'),
      minor('Knight of Wands', 'Wands'),
      minor('Six of Cups', 'Cups'),
      minor('Ace of Pentacles', 'Pentacles'),
      { card: 'Strength', name: 'Strength', number: 8, position: 'Card', orientation: 'Upright' }
    ]);

    assert.deepEqual(themes.suitCounts, { Wands: 1, Cups: 1, Swords: 1, Pentacles: 1 });
    assert.equal(themes.dominantSuit, null);
    assert.equal(themes.dominantElement, 'Fire', 'Fire still leads outright (Wands + Strength)');
  });

  it('names no dominant suit or element when two share the top count', async () => {
    const themes = await analyzeSpreadThemes(TIED_TWO_WAY);

    assert.equal(themes.dominantSuit, null);
    assert.equal(themes.dominantElement, null);
  });

  it('names every suit in a three-way tie for the lead', async () => {
    const themes = await analyzeSpreadThemes([
      ...TIED_TWO_WAY,
      minor('Three of Swords', 'Swords'),
      minor('Two of Pentacles', 'Pentacles')
    ]);

    assert.match(themes.suitFocus, /Wands/);
    assert.match(themes.suitFocus, /Cups/);
    assert.match(themes.suitFocus, /Swords/);
    assert.doesNotMatch(themes.suitFocus, /Pentacles/);
  });

  it('still names a suit and element that lead outright', async () => {
    const themes = await analyzeSpreadThemes([
      minor('Two of Wands', 'Wands'),
      minor('Three of Wands', 'Wands'),
      minor('Two of Cups', 'Cups')
    ]);

    assert.equal(themes.dominantSuit, 'Wands');
    assert.equal(themes.dominantElement, 'Fire');
  });

  it('describes tied leading elements as sharing the lead', async () => {
    const themes = await analyzeSpreadThemes(TIED_TWO_WAY);

    assert.doesNotMatch(themes.elementalBalance, /\b(?:Fire|Water) leads\b/);
    assert.match(themes.elementalBalance, /Fire and Water/);
  });

  it('does not call an even two-element split domination', async () => {
    const themes = await analyzeSpreadThemes(TIED_TWO_WAY.slice(0, 4));

    assert.doesNotMatch(themes.elementalBalance, /dominates/);
    assert.match(themes.elementalBalance, /Fire and Water/);
  });
});

describe('client insights with tied counts', () => {
  it('does not suggest questions about a "strong" element or suit that only ties', () => {
    const suggestions = generateFollowUpSuggestions(TIED_TWO_WAY, {}, {}, { limit: 20 });

    assert.ok(
      !suggestions.some((s) => s.type === 'elemental' && /\bstrong\b/.test(s.text)),
      'No elemental question should call a tied element strong'
    );
    assert.ok(!suggestions.some((s) => s.type === 'suit'), 'No suit question should pick one of the tied suits');
  });

  it('still suggests a question for an element that leads outright', () => {
    const suggestions = generateFollowUpSuggestions(TIED_TWO_WAY.slice(0, 3), {}, {}, { limit: 20 });

    assert.ok(suggestions.some((s) => s.type === 'elemental' && s.text.includes('strong Fire energy')));
  });

  it('names the suit and element whose counts triggered the suggestion, not stale stored labels', () => {
    const reading = [
      minor('Two of Wands', 'Wands'),
      minor('Three of Wands', 'Wands'),
      minor('Four of Wands', 'Wands'),
      minor('Two of Cups', 'Cups'),
      minor('Two of Swords', 'Swords')
    ];
    const staleThemes = {
      suitCounts: { Wands: 3, Cups: 1, Swords: 1, Pentacles: 0 },
      elementCounts: { Fire: 3, Water: 1, Air: 1, Earth: 0 },
      dominantSuit: 'Cups',
      dominantElement: 'Water'
    };

    const suggestions = generateFollowUpSuggestions(reading, staleThemes, {}, { limit: 20 });

    assert.ok(suggestions.some((s) => s.type === 'elemental' && s.text.includes('strong Fire energy')));
    assert.ok(!suggestions.some((s) => s.text.includes('Water')));
    assert.ok(suggestions.some((s) => s.type === 'suit' && s.anchorKey === 'Wands'));
  });

  it('does not say the reading leans toward one of two tied elements', () => {
    const cue = buildSymbolElementCue({
      reading: [{ name: 'Ace of Wands' }, { name: 'Ace of Cups' }],
      themes: {
        suitCounts: { Wands: 2, Cups: 2, Swords: 1, Pentacles: 0 },
        elementCounts: { Fire: 2, Water: 2, Air: 1, Earth: 0 }
      }
    });

    assert.equal(cue, null);
  });
});

describe('journal coach labels for tied themes', () => {
  // Labels are built from the stored analysis text, so feed them real producer output.
  it('names every suit in a multi-suit balanced focus', async () => {
    const themes = await analyzeSpreadThemes([
      ...TIED_TWO_WAY,
      minor('Three of Swords', 'Swords'),
      minor('Two of Pentacles', 'Pentacles')
    ]);

    assert.equal(normalizeThemeLabel(themes.suitFocus), 'Balanced focus: Wands, Cups & Swords');
  });

  it('keeps the two-suit balanced focus label', async () => {
    const themes = await analyzeSpreadThemes(TIED_TWO_WAY);

    assert.equal(normalizeThemeLabel(themes.suitFocus), 'Balanced focus: Wands & Cups');
  });

  it('shortens a shared elemental lead without singling one element out', async () => {
    const themes = await analyzeSpreadThemes(TIED_TWO_WAY);

    assert.equal(normalizeThemeLabel(themes.elementalBalance), 'Fire & Water share the lead');
  });
});

describe('four-way suit tie', () => {
  it('names all four suits and no dominant suit when each appears twice', async () => {
    const themes = await analyzeSpreadThemes([
      ...TIED_TWO_WAY.slice(0, 4),
      minor('Two of Swords', 'Swords'),
      minor('Three of Swords', 'Swords'),
      minor('Two of Pentacles', 'Pentacles'),
      minor('Three of Pentacles', 'Pentacles')
    ]);

    assert.equal(themes.dominantSuit, null);
    assert.equal(normalizeThemeLabel(themes.suitFocus), 'Balanced focus: Wands, Cups, Swords & Pentacles');
  });
});
