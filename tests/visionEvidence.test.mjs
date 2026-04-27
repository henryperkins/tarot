import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildVisionEvidencePackets } from '../functions/lib/visionEvidence.js';

const cardsInfo = [
  { card: 'The Fool', canonicalName: 'The Fool', canonicalKey: 'fool', orientation: 'Upright' }
];

describe('vision evidence packets', () => {
  it('maps eligible matched proof symbols to RWS evidence', () => {
    const packets = buildVisionEvidencePackets([
      {
        label: 'fool-photo',
        predictedCard: 'The Fool',
        confidence: 0.92,
        matchesDrawnCard: true,
        promptEligible: true,
        orientation: 'upright',
        visualDetails: ['cliff edge', 'small dog', 'white rose'],
        symbolVerification: {
          matchRate: 0.8,
          matches: [
            { object: 'cliff', found: true, confidence: 0.74 },
            { object: 'white rose', found: true, confidence: 0.68 }
          ],
          missingSymbols: []
        }
      }
    ], cardsInfo, 'rws-1909');

    assert.equal(packets.length, 1);
    assert.equal(packets[0].card, 'The Fool');
    assert.equal(packets[0].evidenceMode, 'uploaded_image');
    assert.equal(packets[0].visualClaimMode, 'verified_visual_evidence');
    assert.ok(packets[0].cardKnowledge.coreThemes.includes('beginnings'));
    assert.ok(packets[0].expectedRiderSymbols.some((entry) => entry.symbol === 'cliff'));
    assert.ok(packets[0].verifiedUploadedEvidence.some((entry) => entry.symbol === 'cliff'));
    assert.ok(packets[0].visibleEvidence.some((entry) => entry.symbol === 'cliff'));
    assert.ok(packets[0].visibleEvidence[0].symbolicMeaning.length > 0);
  });

  it('keeps mismatches telemetry-only and strips off-spread visible details', () => {
    const packets = buildVisionEvidencePackets([
      {
        label: 'magician-photo',
        predictedCard: 'The Magician',
        confidence: 0.9,
        matchesDrawnCard: false,
        promptEligible: false,
        visualDetails: ['wand', 'infinity symbol']
      }
    ], cardsInfo, 'rws-1909');

    assert.equal(packets[0].evidenceMode, 'telemetry_only');
    assert.equal(packets[0].visualClaimMode, 'ask_for_confirmation');
    assert.deepEqual(packets[0].visibleEvidence, []);
    assert.deepEqual(packets[0].verifiedUploadedEvidence, []);
    assert.equal(packets[0].suppressionReason, 'card_mismatch');
  });

  it('keeps high-confidence low-weighted uploads at card-level only', () => {
    const packets = buildVisionEvidencePackets([
      {
        label: 'fool-photo',
        predictedCard: 'The Fool',
        confidence: 0.91,
        matchesDrawnCard: true,
        promptEligible: false,
        suppressionReason: 'weak_weighted_symbol_verification',
        symbolVerification: {
          matchRate: 0.75,
          weightedMatchRate: 0.31,
          matches: [
            { object: 'feather', found: true, confidence: 0.7 },
            { object: 'cliff', found: false, confidence: 0 }
          ],
          missingSymbols: ['cliff'],
          highSalienceMissing: ['cliff']
        },
        visualDetails: ['a cliff is visible']
      }
    ], cardsInfo, 'rws-1909');

    assert.equal(packets[0].evidenceMode, 'telemetry_only');
    assert.equal(packets[0].visualClaimMode, 'card_level_only');
    assert.deepEqual(packets[0].verifiedUploadedEvidence, []);
    assert.ok(packets[0].uncertainSymbols.some((entry) => entry.label === 'a cliff is visible'));
    assert.ok(packets[0].forbiddenClaims.some((claim) => /Do not say "I see"/.test(claim)));
  });
});
