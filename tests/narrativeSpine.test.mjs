import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  analyzeSpineCompleteness,
  enhanceSection,
  validateReadingNarrative
} from '../functions/lib/narrativeSpine.js';

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
});
