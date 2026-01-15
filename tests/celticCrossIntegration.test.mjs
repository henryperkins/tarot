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
    'Present — core situation': ['At the heart of this moment', 'Right now, your story', 'The core tone of this moment'],
    'Challenge — crossing / tension': ['Crossing this, the challenge', 'In tension with that', 'highlights the knot'],
    'Past — what lies behind': ['Looking to what lies behind', 'In the background', 'The roots of this story'],
    'Near Future — what lies before': ['What lies ahead', 'As the next chapter', 'Soon, the story leans'],
    'Conscious — goals & focus': ['Your conscious goal', 'speaks to what you know', 'In your conscious mind'],
    'Subconscious — roots / hidden forces': ['Hidden beneath awareness', 'Below the surface', 'In the deeper layers'],
    'Self / Advice — how to meet this': ['Guidance on how to meet', 'offers a way you might', 'As counsel'],
    'External Influences — people & environment': ['External influences, people and forces', 'Around you', 'In the wider field'],
    'Hopes & Fears — deepest wishes & worries': ['Hopes and fears blend', 'deepest wishes', 'What you long for'],
    'Outcome — likely path if unchanged': ['The likely outcome', 'If nothing major shifts', 'As things stand']
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
    assert.ok(
      ['Because of this,', 'Because of this history,', 'Because of this groundwork,'].includes(pastConnector),
      `Expected valid connector for Past, got: "${pastConnector}"`
    );

    // Challenge has connectorToPrev
    const challengeConnector = getConnector('Challenge — crossing / tension', 'toPrev');
    assert.ok(
      ['However,', 'However, at the same time,', 'However, in contrast,'].includes(challengeConnector),
      `Expected valid connector for Challenge, got: "${challengeConnector}"`
    );

    // Near Future has connectorToPrev
    const futureConnector = getConnector('Near Future — what lies before', 'toPrev');
    assert.ok(
      ['Therefore,', 'Therefore, looking ahead,', 'Therefore, as this unfolds,'].includes(futureConnector),
      `Expected valid connector for Near Future, got: "${futureConnector}"`
    );
  });
});
