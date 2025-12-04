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
});
