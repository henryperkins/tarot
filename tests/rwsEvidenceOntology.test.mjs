import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getRwsCardEvidence,
  getRwsEvidenceByStableId,
  getRwsHardNegatives,
  normalizeRwsSymbolName
} from '../shared/vision/rwsEvidenceOntology.js';

describe('rws evidence ontology', () => {
  it('exposes stable card identity and visible evidence for The Fool', () => {
    const fool = getRwsCardEvidence('The Fool');
    assert.equal(fool.stableId, 'major_00_fool');
    assert.equal(fool.deck, 'Rider-Waite-Smith');
    assert.equal(fool.card, 'The Fool');
    const cliff = fool.visualSymbols.find((entry) => entry.symbol === 'cliff');
    assert.equal(cliff.symbolId, 'rws.fool.cliff');
    assert.equal(cliff.salience, 0.95);
    assert.deepEqual(cliff.expectedRegion, {
      shape: 'rect',
      x: 0.854,
      y: 0.42,
      width: 0.122,
      height: 0.28
    });
    assert.ok(cliff.aliases.includes('precipice'));
    assert.ok(fool.visualSymbols.some((entry) => entry.symbol === 'white_rose'));
    assert.deepEqual(fool.hardNegatives.map((entry) => entry.card), ['The Sun', 'Strength']);
    assert.ok(fool.coreThemes.includes('beginnings'));
    assert.ok(fool.avoidClaims.some((claim) => /specific future event/i.test(claim)));
  });

  it('maps symbol names to normalized concept arrays', () => {
    const magician = getRwsCardEvidence('The Magician');
    const infinity = magician.visualSymbols.find((entry) => entry.symbol === 'infinity_symbol');
    assert.ok(infinity, 'expected infinity_symbol on Magician');
    assert.ok(infinity.literalObservation.length > 10);
    assert.ok(infinity.symbolicMeaning.includes('eternal potential'));
  });

  it('supports stable id lookup', () => {
    const priestess = getRwsEvidenceByStableId('major_02_high_priestess');
    assert.equal(priestess.card, 'The High Priestess');
  });

  it('exposes directional hard negatives for visually confusable cards', () => {
    assert.deepEqual(
      getRwsHardNegatives('The High Priestess').map((entry) => entry.card),
      ['Justice', 'The Hierophant']
    );
    assert.deepEqual(
      getRwsHardNegatives('The Fool').map((entry) => entry.card),
      ['The Sun', 'Strength']
    );
    assert.deepEqual(getRwsHardNegatives('Three of Cups'), []);
  });

  it('generates stable minor-card ontology symbols', () => {
    const twoSwords = getRwsCardEvidence('Two of Swords');

    assert.equal(twoSwords.stableId, 'swords_02');
    assert.ok(twoSwords.visualSymbols.length > 0);
    assert.ok(twoSwords.visualSymbols.some((entry) => entry.symbol === 'two_razor_sharp_swords'));
    assert.ok(twoSwords.visualSymbols.every((entry) => entry.symbolId.startsWith('rws.two_of_swords.')));
    assert.ok(twoSwords.visualSymbols.every((entry) => entry.expectedRegion === null));
  });

  it('normalizes symbol aliases for absence checks', () => {
    assert.equal(normalizeRwsSymbolName('White Rose'), 'white_rose');
    assert.equal(normalizeRwsSymbolName('crossed swords'), 'crossed_swords');
  });
});
