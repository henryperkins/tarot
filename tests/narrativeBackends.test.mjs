import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { composeReadingEnhanced } from '../functions/lib/narrativeBackends.js';
import {
  analyzeRelationship,
  analyzeSpreadThemes,
  analyzeThreeCard
} from '../functions/lib/spreadAnalysis.js';
import {
  buildElementalRemedies,
  computeRemedyRotationIndex
} from '../functions/lib/narrative/helpers.js';

function minor(name, suit, rank, rankValue, position, orientation = 'Upright', meaning = 'Embodied lesson in this area.') {
  return {
    card: name,
    name,
    suit,
    rank,
    rankValue,
    position,
    orientation,
    meaning
  };
}

function major(name, number, position, orientation = 'Upright', meaning = 'Meaningful transformation and growth.') {
  return {
    card: name,
    name,
    number,
    position,
    orientation,
    meaning
  };
}

describe('composeReadingEnhanced', () => {
  it('passes spreadInfo through spread dispatch so remedy rotation can vary by spread metadata', async () => {
    const cardsInfo = [
      minor('Ace of Wands', 'Wands', 'Ace', 1, 'You / your energy', 'Upright'),
      minor('Two of Wands', 'Wands', 'Two', 2, 'Them / their energy', 'Upright'),
      minor('Three of Wands', 'Wands', 'Three', 3, 'The connection / shared lesson', 'Upright')
    ];
    const themes = await analyzeSpreadThemes(cardsInfo);
    const relationshipAnalysis = analyzeRelationship(cardsInfo);
    const userQuestion = 'What is the energy of this connection?';

    const spreadInfoA = { name: 'Relationship Snapshot Alpha', key: 'alpha' };
    const spreadInfoB = { name: 'Relationship Snapshot Gamma', key: 'gamma' };

    const idxA = computeRemedyRotationIndex({ cardsInfo, userQuestion, spreadInfo: spreadInfoA });
    const idxB = computeRemedyRotationIndex({ cardsInfo, userQuestion, spreadInfo: spreadInfoB });
    assert.notEqual(idxA % 4, idxB % 4, 'Test setup should use distinct remedy rotation buckets');

    const expectedRemediesA = buildElementalRemedies(themes.elementCounts, cardsInfo.length, 'general', { rotationIndex: idxA });
    const expectedRemediesB = buildElementalRemedies(themes.elementCounts, cardsInfo.length, 'general', { rotationIndex: idxB });
    assert.ok(expectedRemediesA && expectedRemediesB);

    const payloadA = {
      spreadInfo: spreadInfoA,
      cardsInfo,
      userQuestion,
      reflectionsText: '',
      analysis: {
        themes,
        spreadAnalysis: relationshipAnalysis,
        spreadKey: 'relationship'
      },
      context: 'general'
    };
    const payloadB = {
      spreadInfo: spreadInfoB,
      cardsInfo,
      userQuestion,
      reflectionsText: '',
      analysis: {
        themes,
        spreadAnalysis: relationshipAnalysis,
        spreadKey: 'relationship'
      },
      context: 'general'
    };

    const resultA = await composeReadingEnhanced(payloadA);
    const resultB = await composeReadingEnhanced(payloadB);

    assert.ok(resultA.reading.includes('To bring in underrepresented energies:'), 'Expected remedies in reading A');
    assert.ok(resultB.reading.includes('To bring in underrepresented energies:'), 'Expected remedies in reading B');
    assert.ok(resultA.reading.includes(expectedRemediesA.split('\n')[1]));
    assert.ok(resultB.reading.includes(expectedRemediesB.split('\n')[1]));
    assert.notEqual(resultA.reading, resultB.reading, 'Spread metadata should influence remedy rotation text');
  });

  it('records reasoning metadata via buildReadingWithReasoning integration', async () => {
    const cardsInfo = [
      major('The Fool', 0, 'Past — influences that led here', 'Upright'),
      major('The Magician', 1, 'Present — where you stand now', 'Upright'),
      major('The High Priestess', 2, 'Future — trajectory if nothing shifts', 'Upright')
    ];
    const themes = await analyzeSpreadThemes(cardsInfo);
    const threeCardAnalysis = analyzeThreeCard(cardsInfo);

    const payload = {
      spreadInfo: { name: 'Three-Card Story (Past · Present · Future)', key: 'threeCard' },
      cardsInfo,
      userQuestion: 'How should I move forward?',
      reflectionsText: '',
      analysis: {
        themes,
        spreadAnalysis: threeCardAnalysis,
        spreadKey: 'threeCard'
      },
      context: 'general'
    };

    const result = await composeReadingEnhanced(payload);
    assert.ok(typeof result.reading === 'string' && result.reading.length > 0);
    assert.ok(payload.reasoningMeta, 'Reasoning metadata should be attached to payload');
    assert.ok(payload.reasoningMeta.questionIntent, 'Reasoning metadata should include question intent');
    assert.ok(payload.reasoningMeta.narrativeArc, 'Reasoning metadata should include narrative arc');
  });
});
