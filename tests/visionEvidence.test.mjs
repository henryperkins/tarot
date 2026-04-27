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
    assert.deepEqual(packets[0].visibleEvidence, []);
    assert.equal(packets[0].suppressionReason, 'card_mismatch');
  });
});
