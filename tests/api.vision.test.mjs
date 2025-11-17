import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { onRequestPost } from '../functions/api/tarot-reading.js';
import { buildVisionProofPayload, signVisionProof } from '../functions/lib/visionProof.js';

function makeRequest(payload) {
  return new Request('http://localhost/api/tarot-reading', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

const TEST_SECRET = 'test-secret';

async function createVisionProof({ insights, deckStyle = 'rws-1909' }) {
  const payload = buildVisionProofPayload({
    id: `proof-${Math.random().toString(36).slice(2)}`,
    deckStyle,
    insights,
    ttlMs: 10 * 60 * 1000
  });
  const signature = await signVisionProof(payload, TEST_SECRET);
  return { ...payload, signature };
}

const BASE_PAYLOAD = {
  spreadInfo: { name: 'One-Card Insight' },
  cardsInfo: [
    {
      position: 'One-Card Insight',
      card: 'The Fool',
      orientation: 'Upright',
      meaning: 'New beginnings'
    }
  ],
  userQuestion: 'Is the path clear?',
  reflectionsText: ''
};

describe('vision research mode', () => {
  it('allows readings when no vision proof accompanies the request', async () => {
    const request = makeRequest(BASE_PAYLOAD);
    const response = await onRequestPost({ request, env: { VISION_PROOF_SECRET: TEST_SECRET } });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.ok(typeof payload.reading === 'string' && payload.reading.length > 0);
  });

  it('collects telemetry without blocking readings when proof cards mismatch', async () => {
    const proof = await createVisionProof({
      insights: [
        { label: 'IMG_001', predictedCard: 'The Magician', confidence: 0.82 }
      ]
    });
    const request = makeRequest({
      ...BASE_PAYLOAD,
      visionProof: proof
    });

    const response = await onRequestPost({ request, env: { VISION_PROOF_SECRET: TEST_SECRET } });
    assert.equal(response.status, 200, 'Telemetry mismatches should not block readings');

    const payload = await response.json();
    assert.ok(typeof payload.reading === 'string' && payload.reading.length > 0);
  });

  it('rejects tampered proofs that fail verification', async () => {
    const proof = await createVisionProof({
      insights: [
        { label: 'IMG_002', predictedCard: 'The Magician', confidence: 0.91 }
      ]
    });
    const tamperedProof = { ...proof, signature: 'invalid-signature' };
    const request = makeRequest({
      ...BASE_PAYLOAD,
      visionProof: tamperedProof
    });

    const response = await onRequestPost({ request, env: { VISION_PROOF_SECRET: TEST_SECRET } });
    assert.equal(response.status, 400);

    const payload = await response.json();
    assert.match(payload.error, /Vision proof/i);
  });
});
