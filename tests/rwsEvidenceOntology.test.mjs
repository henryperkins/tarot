import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getRwsCardEvidence,
  getRwsEvidenceByStableId,
  normalizeRwsSymbolName
} from '../shared/vision/rwsEvidenceOntology.js';

describe('rws evidence ontology', () => {
  it('exposes stable card identity and visible evidence for The Fool', () => {
    const fool = getRwsCardEvidence('The Fool');
    assert.equal(fool.stableId, 'major_00_fool');
    assert.equal(fool.deck, 'Rider-Waite-Smith');
    assert.equal(fool.card, 'The Fool');
    assert.ok(fool.visualSymbols.some((entry) => entry.symbol === 'cliff'));
    assert.ok(fool.visualSymbols.some((entry) => entry.symbol === 'white_rose'));
    assert.ok(fool.coreThemes.includes('beginnings'));
    assert.ok(fool.avoidClaims.some((claim) => /specific future event/i.test(claim)));
  });

  it('maps symbol names to normalized concept arrays', () => {
    const magician = getRwsCardEvidence('The Magician');
    const infinity = magician.visualSymbols.find((entry) => entry.symbol === 'infinity_symbol');
    assert.ok(infinity.literalObservation.length > 10);
    assert.ok(infinity.symbolicMeaning.includes('eternal potential'));
  });

  it('supports stable id lookup', () => {
    const priestess = getRwsEvidenceByStableId('major_02_high_priestess');
    assert.equal(priestess.card, 'The High Priestess');
  });

  it('normalizes symbol aliases for absence checks', () => {
    assert.equal(normalizeRwsSymbolName('White Rose'), 'white_rose');
    assert.equal(normalizeRwsSymbolName('crossed swords'), 'crossed_swords');
  });
});
