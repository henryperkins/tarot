import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildOgImageSvg, buildErrorOgImage } from '../functions/lib/ogImageBuilder.js';

describe('OG Image Builder', () => {
  const sampleEntry = {
    ts: Date.parse('2024-12-01T12:00:00Z'),
    spread: 'Three-Card Story',
    question: 'How can I navigate this career transition?',
    context: 'career',
    cards: [
      { position: 'Past', name: 'Two of Wands', suit: 'Wands', orientation: 'Upright' },
      { position: 'Present', name: 'The Tower', orientation: 'Reversed' },
      { position: 'Future', name: 'The Star', orientation: 'Upright' }
    ],
    themes: {
      suitFocus: 'Mixed suits emphasize balance',
      archetypeDescription: 'Transformation leading to hope'
    }
  };

  const sampleShareRecord = {
    token: 'abc123xyz',
    title: 'My Journey Reading',
    scope: 'entry'
  };

  describe('buildOgImageSvg', () => {
    it('generates valid SVG document', () => {
      const svg = buildOgImageSvg([sampleEntry], sampleShareRecord);

      assert.match(svg, /^<\?xml version="1\.0"/);
      assert.match(svg, /<svg width="1200" height="630"/);
      assert.match(svg, /<\/svg>$/);
    });

    it('includes brand name', () => {
      const svg = buildOgImageSvg([sampleEntry], sampleShareRecord);
      assert.match(svg, /TABLEU/);
      assert.doesNotMatch(svg, /MYSTIC TAROT|mystictarot\.app/);
    });

    it('includes spread name', () => {
      const svg = buildOgImageSvg([sampleEntry], sampleShareRecord);
      assert.match(svg, /Three-Card Story/);
    });

    it('includes formatted date', () => {
      const svg = buildOgImageSvg([sampleEntry], sampleShareRecord);
      // Date should be formatted like "Dec 1, 2024"
      assert.match(svg, /Dec\s+1,?\s+2024/);
    });

    it('includes card names', () => {
      const svg = buildOgImageSvg([sampleEntry], sampleShareRecord);
      assert.match(svg, /Two of Wands/);
      assert.match(svg, /The Tower/);
      assert.match(svg, /The Star/);
    });

    it('includes card positions', () => {
      const svg = buildOgImageSvg([sampleEntry], sampleShareRecord);
      assert.match(svg, /Past/);
      assert.match(svg, /Present/);
      assert.match(svg, /Future/);
    });

    it('shows reversal indicator for reversed cards', () => {
      const svg = buildOgImageSvg([sampleEntry], sampleShareRecord);
      // The Tower is reversed, should have ↺ indicator
      assert.match(svg, /The Tower.*↺/);
    });

    it('includes context when present', () => {
      const svg = buildOgImageSvg([sampleEntry], sampleShareRecord);
      assert.match(svg, /CAREER/i);
    });

    it('includes question when present', () => {
      const svg = buildOgImageSvg([sampleEntry], sampleShareRecord);
      assert.match(svg, /career transition/);
    });

    it('includes theme when present', () => {
      const svg = buildOgImageSvg([sampleEntry], sampleShareRecord);
      assert.match(svg, /THEME/);
      assert.match(svg, /Mixed suits/);
    });

    it('includes share token in footer', () => {
      const svg = buildOgImageSvg([sampleEntry], sampleShareRecord);
      assert.match(svg, /tarot\.lakefrontdev\.com\/share\/abc123xyz/);
    });

    it('includes share title when present', () => {
      const svg = buildOgImageSvg([sampleEntry], sampleShareRecord);
      assert.match(svg, /My Journey Reading/);
    });

    it('handles missing share title gracefully', () => {
      const recordWithoutTitle = { token: 'xyz789', scope: 'entry' };
      const svg = buildOgImageSvg([sampleEntry], recordWithoutTitle);

      assert.match(svg, /<svg/);
      assert.match(svg, /tarot\.lakefrontdev\.com\/share\/xyz789/);
    });

    it('uses the canonical site when no share token is available', () => {
      const svg = buildOgImageSvg([sampleEntry], {});

      assert.match(svg, />tarot\.lakefrontdev\.com<\/text>/);
      assert.doesNotMatch(svg, /\/share\/undefined|\/share\/null/);
    });

    it('handles entry without question', () => {
      const entryNoQuestion = { ...sampleEntry, question: null };
      const svg = buildOgImageSvg([entryNoQuestion], sampleShareRecord);

      assert.match(svg, /<svg/);
      assert.doesNotMatch(svg, /career transition/);
    });

    it('handles entry without themes', () => {
      const entryNoThemes = { ...sampleEntry, themes: null };
      const svg = buildOgImageSvg([entryNoThemes], sampleShareRecord);

      assert.match(svg, /<svg/);
      assert.doesNotMatch(svg, /THEME/);
    });

    it('limits to 5 cards maximum', () => {
      const manyCards = {
        ...sampleEntry,
        cards: [
          { position: '1', name: 'Card One', orientation: 'Upright' },
          { position: '2', name: 'Card Two', orientation: 'Upright' },
          { position: '3', name: 'Card Three', orientation: 'Upright' },
          { position: '4', name: 'Card Four', orientation: 'Upright' },
          { position: '5', name: 'Card Five', orientation: 'Upright' },
          { position: '6', name: 'Card Six', orientation: 'Upright' },
          { position: '7', name: 'Card Seven', orientation: 'Upright' }
        ]
      };
      const svg = buildOgImageSvg([manyCards], sampleShareRecord);

      // Should show "+2 more cards"
      assert.match(svg, /\+2 more cards/);
      // Should not include Card Six or Seven in the main display
      assert.doesNotMatch(svg, /Card Six/);
      assert.doesNotMatch(svg, /Card Seven/);
    });

    it('shows entry count for multi-entry shares', () => {
      const entries = [sampleEntry, { ...sampleEntry, ts: Date.now() }];
      const svg = buildOgImageSvg(entries, sampleShareRecord);

      assert.match(svg, /2 readings shared/);
    });

    it('uses correct colors for different suits', () => {
      const svg = buildOgImageSvg([sampleEntry], sampleShareRecord);

      // Wands use the established Wands Gold accent.
      assert.match(svg, /#C9A876/);
      // Major Arcana (The Tower, The Star) use Candlelit Brass.
      assert.match(svg, /#D4B896/);
    });

    it('handles empty entries array', () => {
      const svg = buildOgImageSvg([], sampleShareRecord);

      assert.match(svg, /<svg/);
      assert.match(svg, /TABLEU/);
    });

    it('handles null entries', () => {
      const svg = buildOgImageSvg(null, sampleShareRecord);

      assert.match(svg, /<svg/);
    });

    it('escapes XML special characters', () => {
      const entryWithSpecialChars = {
        ...sampleEntry,
        question: 'What about "love" & <relationships>?',
        spread: 'Test & Learn'
      };
      const svg = buildOgImageSvg([entryWithSpecialChars], sampleShareRecord);

      // Should escape special characters
      assert.match(svg, /&amp;/);
      assert.match(svg, /&lt;/);
      assert.match(svg, /&gt;/);
      assert.match(svg, /&quot;/);
    });

    it('truncates long spread names', () => {
      const longSpreadName = {
        ...sampleEntry,
        spread: 'This Is A Very Long Spread Name That Should Be Truncated For Display'
      };
      const svg = buildOgImageSvg([longSpreadName], sampleShareRecord);

      // Should truncate to ~22 chars with ellipsis
      assert.match(svg, /This Is A Very Long\.\.\./);
    });

    it('keeps markup-like content inert across every share field', () => {
      const maliciousText = '<script>&"\'x';
      const svg = buildOgImageSvg([{
        ...sampleEntry,
        spread: maliciousText,
        question: maliciousText,
        context: maliciousText,
        cards: [{ name: maliciousText, position: maliciousText }],
        themes: { suitFocus: maliciousText }
      }], { title: maliciousText, token: maliciousText });

      assert.doesNotMatch(svg, /<script>|<SCRIPT>/);
      assert.match(svg, /&lt;script&gt;&amp;&quot;&apos;x/);
      assert.match(svg, /CONTEXT: &lt;SCRIPT&gt;&amp;&quot;&apos;X/);
      assert.match(svg, /tarot\.lakefrontdev\.com\/share\/&lt;script&gt;&amp;&quot;&apos;x/);
    });

    it('shows all five cards without an overflow label at the boundary', () => {
      const cards = Array.from({ length: 5 }, (_, index) => ({ name: `Visible card ${index + 1}` }));
      const svg = buildOgImageSvg([{ ...sampleEntry, cards }], sampleShareRecord);

      assert.match(svg, /Visible card 5/);
      assert.doesNotMatch(svg, /more cards/);
    });
  });

  describe('buildErrorOgImage', () => {
    it('generates valid SVG document', () => {
      const svg = buildErrorOgImage('Test error message');

      assert.match(svg, /^<\?xml version="1\.0"/);
      assert.match(svg, /<svg width="1200" height="630"/);
      assert.match(svg, /<\/svg>$/);
    });

    it('includes brand name', () => {
      const svg = buildErrorOgImage('Test message');
      assert.match(svg, /TABLEU/);
      assert.doesNotMatch(svg, /MYSTIC TAROT|mystictarot\.app/);
    });

    it('includes error message', () => {
      const svg = buildErrorOgImage('Reading not found');
      assert.match(svg, /Reading not found/);
    });

    it('uses default message when none provided', () => {
      const svg = buildErrorOgImage();
      assert.match(svg, /Reading not found/);
    });

    it('escapes special characters in message', () => {
      const svg = buildErrorOgImage('Error: <invalid> & "broken"');
      assert.match(svg, /&lt;invalid&gt;/);
      assert.match(svg, /&amp;/);
    });
  });
});
