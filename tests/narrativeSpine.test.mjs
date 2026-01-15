import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  analyzeSpineCompleteness,
  enhanceSection,
  validateReadingNarrative,
  isCardSection
} from '../functions/lib/narrativeSpine.js';

// ──────────────────────────────────────────────────────────
// isCardSection Tests
// ──────────────────────────────────────────────────────────
describe('isCardSection', () => {
  describe('structural sections', () => {
    it('returns false for Opening', () => {
      assert.equal(isCardSection('Opening', 'Welcome to your reading...'), false);
    });

    it('returns false for Closing', () => {
      assert.equal(isCardSection('Closing', 'Thank you for this session...'), false);
    });

    it('returns false for Next Steps', () => {
      assert.equal(isCardSection('Next Steps', 'Consider journaling about...'), false);
    });

    it('returns false for Gentle Next Steps', () => {
      assert.equal(isCardSection('Gentle Next Steps', 'You might try...'), false);
    });

    it('returns false for Synthesis', () => {
      assert.equal(isCardSection('Synthesis', 'Bringing these threads together...'), false);
    });

    it('returns false for Reflection', () => {
      assert.equal(isCardSection('Reflection', 'As you sit with this reading...'), false);
    });

    it('returns false for Guidance for This Connection', () => {
      assert.equal(isCardSection('Guidance for This Connection', 'Consider journaling about...'), false);
    });

    it('returns false for Synthesis & Guidance', () => {
      assert.equal(isCardSection('Synthesis & Guidance', 'Bringing these threads together...'), false);
    });
  });

  describe('card sections by header', () => {
    it('returns true for Major Arcana in header', () => {
      assert.equal(isCardSection('The Fool', 'New beginnings await...'), true);
    });

    it('returns true for Minor Arcana in header', () => {
      assert.equal(isCardSection('Three of Cups', 'Celebration and joy...'), true);
    });

    it('returns true for card with position context', () => {
      assert.equal(isCardSection('The Tower (Challenge)', 'Sudden change...'), true);
    });
  });

  describe('card sections by content', () => {
    it('returns true when content contains Major Arcana', () => {
      assert.equal(isCardSection('Present Situation', 'The Tower crashes through...'), true);
    });

    it('returns true when content contains Minor Arcana', () => {
      assert.equal(isCardSection('Your Challenge', 'The Five of Swords appears here...'), true);
    });
  });

  describe('edge cases', () => {
    it('returns false for unknown header without card content', () => {
      assert.equal(isCardSection('Final Thoughts', 'Remember to breathe...'), false);
    });

    it('handles case-insensitive matching', () => {
      assert.equal(isCardSection('OPENING', 'Welcome...'), false);
      assert.equal(isCardSection('the fool', 'New beginnings...'), true);
    });
  });
});

// ──────────────────────────────────────────────────────────
// validateReadingNarrative card section tracking Tests
// ──────────────────────────────────────────────────────────
describe('validateReadingNarrative card section tracking', () => {
  it('should return separate card and structural section counts', () => {
    const reading = `
**Opening**
Welcome to your reading today.

**The Fool**
The Fool appears upright, signaling new beginnings.
This energy stems from your willingness to take risks.
Consider stepping into the unknown with trust.

**The Magician**
The Magician brings focus and skill.
Your resources are aligned because you've done the work.
Channel this energy into your creative projects.

**Synthesis**
Together, these cards weave a story of fresh starts.

**Next Steps**
Journal about what "beginning" means to you.
`;

    const result = validateReadingNarrative(reading);

    assert.equal(result.cardSections, 2); // Fool, Magician
    assert.equal(result.structuralSections, 3); // Opening, Synthesis, Next Steps
    assert.ok(result.cardComplete >= 1);
    assert.equal(result.totalSections, 5);
  });
});

describe('narrative spine helper heuristics', () => {
  it('detects story spine clauses with varied phrasing', () => {
    const text = [
      'Anchor: The Sun upright bathes the scene in unapologetic clarity.',
      'That gentle burn steadies your nervous system, which in turn dissolves hesitation.',
      'From here, lean into the conversations that are beckoning next.'
    ].join(' ');

    const analysis = analyzeSpineCompleteness(text);

    assert.equal(analysis.missing.length, 0, 'Should not report missing elements');
    assert.ok(analysis.present.what, 'Should detect WHAT clause');
    assert.ok(analysis.present.why, 'Should detect WHY connector');
    assert.ok(analysis.present.whatsNext, 'Should detect forward-looking guidance');
  });

  it('honors explicit spine hints when builders provide overrides', () => {
    const analysis = analyzeSpineCompleteness('Freestyle reflection without cues.', {
      spineHints: { what: true, why: true, whatsNext: false }
    });

    assert.ok(analysis.present.what, 'Hint should mark WHAT as present');
    assert.ok(analysis.present.why, 'Hint should mark WHY as present');
    assert.strictEqual(analysis.present.whatsNext, false, 'Unset hint should leave detection result');
    assert.deepEqual(analysis.missing, ['whatsNext'], 'Only WHAT\'S NEXT should be missing');
  });

  it('avoids duplicate enhancements when clauses already exist upstream', () => {
    const section = 'Because these energies already harmonize, relief begins to return.';
    const metadata = {
      type: 'future',
      cards: [
        { position: 'Anchor', card: 'The Sun', orientation: 'Upright' },
        { position: 'Bridge', card: 'The Empress', orientation: 'Upright' }
      ],
      relationships: {
        elementalRelationship: { relationship: 'supportive' }
      }
    };

    const result = enhanceSection(section, metadata);
    const becauseCount = (result.text.match(/Because/gi) || []).length;

    assert.ok(result.text.startsWith('Anchor: The Sun Upright.'), 'Should prepend card identification');
    assert.equal(becauseCount, 1, 'Should not add duplicate causal connector');
    assert.ok(
      result.text.includes('Consider what this trajectory invites you to do next.'),
      'Future sections should receive guidance prompt'
    );
    assert.deepEqual(
      result.validation.enhancements,
      ['Added card identification', 'Added forward-looking guidance'],
      'Only card ID and guidance should be injected'
    );
  });

  it('validates markdown heading sections that use ### syntax', () => {
    const reading = [
      '### Anchor',
      'Anchor: The Sun steadies your confidence and frames this moment.',
      '### Bridge',
      'Bridge: The Moon contrasts that warmth, so you can witness nuance. From here, choose the conversations you will tend next.'
    ].join('\n');

    const validation = validateReadingNarrative(reading);

    assert.equal(validation.totalSections, 2, 'Should capture both markdown sections');
    assert.strictEqual(validation.sectionAnalyses[0].header, 'Anchor');
    assert.ok(validation.sectionAnalyses[0].analysis.present.what, 'Anchor section should have WHAT clause');
    assert.ok(validation.sectionAnalyses[1].analysis.present.why, 'Bridge section should capture WHY clause');
    assert.ok(validation.isValid, 'Reading should pass required spine checks');
  });

  it('accepts colon headings on standalone lines', () => {
    const reading = [
      'Opening:',
      'The Sun steadies your confidence and frames this moment.',
      '',
      'Closing:',
      'From here, choose the conversations you will tend next.'
    ].join('\n');

    const validation = validateReadingNarrative(reading);

    assert.equal(validation.totalSections, 2, 'Should capture colon-delimited sections');
    assert.strictEqual(validation.sectionAnalyses[0].header, 'Opening');
    assert.ok(validation.sectionAnalyses[0].analysis.present.what, 'Opening section should have WHAT clause');
  });

  it('falls back to paragraph sections when headings are missing', () => {
    const reading = [
      'The Sun steadies your confidence in this moment. Because it warms the scene, hesitation softens. From here, choose the conversation that renews trust.',
      '',
      'The Moon introduces a softer undercurrent in the same story. Since the light shifts, hidden feelings surface. Next, slow your pace and listen before deciding.'
    ].join('\n');

    const validation = validateReadingNarrative(reading);

    assert.equal(validation.totalSections, 2, 'Should treat paragraphs as sections');
    assert.ok(validation.isValid, 'Paragraph sections should pass spine checks');
  });
});
