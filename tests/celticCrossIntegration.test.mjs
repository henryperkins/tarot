import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildPositionCardText, getConnector } from '../functions/lib/narrative/helpers.js';

describe('Celtic Cross End-to-End Integration', () => {
  const testCard = {
    card: 'The Magician',
    number: 1,
    orientation: 'Upright',
    meaning: 'Willpower and manifestation.'
  };

  // Positions as they come from spreads.js (without Card #)
  const celticCrossPositions = [
    'Present — core situation',
    'Challenge — crossing / tension',
    'Past — what lies behind',
    'Near Future — what lies before',
    'Conscious — goals & focus',
    'Subconscious — roots / hidden forces',
    'Self / Advice — how to meet this',
    'External Influences — people & environment',
    'Hopes & Fears — deepest wishes & worries',
    'Outcome — likely path if unchanged'
  ];

  // Position-specific intro patterns from POSITION_LANGUAGE (exact phrases from templates)
  const positionSpecificPatterns = {
    'Present — core situation': ['symbolic reflection on the present', 'symbolic lens on the present question', 'Present position offers'],
    'Challenge — crossing / tension': ['Crossing this, the challenge', 'In tension with that', 'highlights the knot'],
    'Past — what lies behind': ['symbolic lens', 'symbolic reflection', 'symbolic Past perspective'],
    'Near Future — what lies before': ['prospective symbolic lens', 'symbolic theme to consider', 'Looking ahead symbolically'],
    'Conscious — goals & focus': ['For reflection on goals and focus', 'symbolic lens for examining an aim', 'In the Conscious position'],
    'Subconscious — roots / hidden forces': ['Subconscious position offers', 'invites exploration of possibilities', 'For a reflective look beneath the surface'],
    'Self / Advice — how to meet this': ['Guidance on how to meet', 'offers a way you might', 'As counsel'],
    'External Influences — people & environment': ['For considering external conditions', 'symbolic lens for reflecting on circumstances', 'In the External position'],
    'Hopes & Fears — deepest wishes & worries': ['Hopes and fears blend', 'deepest wishes', 'What you long for'],
    'Outcome — likely path if unchanged': ['prospective symbolic lens', 'possible theme for thinking', 'symbolic reflection on what you might choose']
  };

  it('all 10 Celtic Cross positions use position-specific templates', () => {
    const results = [];

    celticCrossPositions.forEach((pos, idx) => {
      const result = buildPositionCardText(testCard, pos, {});
      const patterns = positionSpecificPatterns[pos] || [];
      const hasPositionSpecific = patterns.some(p => result.includes(p));

      results.push({
        position: pos,
        index: idx + 1,
        hasPositionSpecific,
        preview: result.substring(0, 100)
      });
    });

    const failures = results.filter(r => !r.hasPositionSpecific);

    if (failures.length > 0) {
      const details = failures.map(f => `  Position ${f.index}: ${f.position}\n    Preview: ${f.preview}`).join('\n');
      assert.fail(`${failures.length} positions not using specific templates:\n${details}`);
    }
  });

  it('getConnector returns valid connectors for Celtic Cross positions', () => {
    // Past has connectorToNext
    const pastConnector = getConnector('Past — what lies behind', 'toNext');
    assert.match(pastConnector, /symbolic|reflection/i);
    assert.doesNotMatch(pastConnector, /Because of (?:this|what)/);

    // Challenge has connectorToPrev
    const challengeConnector = getConnector('Challenge — crossing / tension', 'toPrev');
    assert.ok(
      ['However,', 'However, at the same time,', 'However, in contrast,'].includes(challengeConnector),
      `Expected valid connector for Challenge, got: "${challengeConnector}"`
    );

    // Near Future has connectorToPrev
    const futureConnector = getConnector('Near Future — what lies before', 'toPrev');
    assert.ok(
      ['Looking ahead symbolically,', 'As a possible lens for a next step,'].includes(futureConnector),
      `Expected valid connector for Near Future, got: "${futureConnector}"`
    );
  });
});
