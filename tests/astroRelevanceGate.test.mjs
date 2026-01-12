import { describe, it } from 'node:test';
import assert from 'node:assert';
import { shouldIncludeAstroInsights } from '../functions/lib/narrative/prompts.js';

describe('shouldIncludeAstroInsights', () => {
  it('returns true when astro anchor cards appear', () => {
    const cards = [{ card: 'The Sun', number: 19 }, { card: 'Three of Cups', number: null }];
    const themes = { majorRatio: 0.2 };

    assert.strictEqual(shouldIncludeAstroInsights(cards, themes), true);
  });

  it('returns false for grounded spreads with no astro signals', () => {
    const cards = [
      { card: 'Three of Pentacles', number: null },
      { card: 'Eight of Pentacles', number: null },
      { card: 'Page of Pentacles', number: null }
    ];

    const themes = {
      majorRatio: 0,
      knowledgeGraph: { graphKeys: {} },
      timingProfile: { type: 'short' }
    };

    assert.strictEqual(shouldIncludeAstroInsights(cards, themes), false);
  });

  it('returns true when graph combos and timing signals align', () => {
    const cards = [
      { card: 'Knight of Wands', number: null },
      { card: 'Queen of Swords', number: null },
      { card: 'The Lovers', number: 6 }
    ];

    const themes = {
      majorRatio: 0.33,
      knowledgeGraph: { graphKeys: { completeTriadIds: ['lovers-empress-hierophant'] } },
      timingProfile: { type: 'seasonal' }
    };

    assert.strictEqual(shouldIncludeAstroInsights(cards, themes), true);
  });

  it('returns true when user intent is astro-focused even without anchors', () => {
    const cards = [
      { card: 'Three of Pentacles', number: null },
      { card: 'Six of Cups', number: null },
      { card: 'Page of Swords', number: null }
    ];

    const themes = { majorRatio: 0, knowledgeGraph: { graphKeys: {} }, timingProfile: { type: 'short' } };

    const question = 'How do upcoming eclipses and retrogrades affect my career over the next few months?';

    assert.strictEqual(shouldIncludeAstroInsights(cards, themes, question), true);
  });

  it('returns true during Full Moon even with minimal other signals', () => {
    const cards = [
      { card: 'Three of Pentacles', number: null },
      { card: 'Eight of Wands', number: null }
    ];

    const themes = { majorRatio: 0, knowledgeGraph: { graphKeys: {} }, timingProfile: { type: 'short' } };
    const ephemerisContext = { moonPhase: { phaseName: 'Full Moon' } };

    // Full Moon (+2) meets the threshold of 2
    assert.strictEqual(shouldIncludeAstroInsights(cards, themes, '', ephemerisContext), true);
  });

  it('returns true during New Moon even with minimal other signals', () => {
    const cards = [
      { card: 'Page of Cups', number: null },
      { card: 'Seven of Swords', number: null }
    ];

    const themes = { majorRatio: 0, knowledgeGraph: { graphKeys: {} }, timingProfile: { type: 'short' } };
    const ephemerisContext = { moonPhase: { phaseName: 'New Moon' } };

    // New Moon (+2) meets the threshold of 2
    assert.strictEqual(shouldIncludeAstroInsights(cards, themes, '', ephemerisContext), true);
  });

  it('returns false during Waxing Crescent with no other signals', () => {
    const cards = [
      { card: 'Two of Pentacles', number: null },
      { card: 'Five of Wands', number: null }
    ];

    const themes = { majorRatio: 0, knowledgeGraph: { graphKeys: {} }, timingProfile: { type: 'short' } };
    const ephemerisContext = { moonPhase: { phaseName: 'Waxing Crescent' } };

    // Waxing Crescent (+0) doesn't meet threshold
    assert.strictEqual(shouldIncludeAstroInsights(cards, themes, '', ephemerisContext), false);
  });

  it('returns true when The Moon card appears during actual Full Moon (resonance)', () => {
    const cards = [
      { card: 'The Moon', number: 18 },
      { card: 'Two of Cups', number: null }
    ];

    const themes = { majorRatio: 0.5, knowledgeGraph: { graphKeys: {} }, timingProfile: { type: 'short' } };
    const ephemerisContext = { moonPhase: { phaseName: 'Full Moon' } };

    // The Moon anchor (+2) + Full Moon (+2) + resonance (+1) + majorHeavy (+1) = 6
    assert.strictEqual(shouldIncludeAstroInsights(cards, themes, '', ephemerisContext), true);
  });

  it('returns true during First Quarter with one other signal', () => {
    const cards = [
      { card: 'Knight of Wands', number: null },
      { card: 'The Chariot', number: 7 }
    ];

    // The Chariot is not in astroAnchors, but majorRatio counts
    const themes = { majorRatio: 0.5, knowledgeGraph: { graphKeys: {} }, timingProfile: { type: 'short' } };
    const ephemerisContext = { moonPhase: { phaseName: 'First Quarter' } };

    // majorHeavy (+1) + First Quarter (+1) = 2
    assert.strictEqual(shouldIncludeAstroInsights(cards, themes, '', ephemerisContext), true);
  });
});
