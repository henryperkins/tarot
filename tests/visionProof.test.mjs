import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';

import { onRequestPost } from '../functions/api/vision-proof.js';
import { buildVisionProofPayload, signVisionProof, verifyVisionProof } from '../functions/lib/visionProof.js';
import { annotateVisionInsights } from '../functions/lib/readingQuality.js';
import { resolveReadingCards } from '../functions/lib/readingCardResolution.js';

const TEST_SECRET = 'vision-identity-test-secret';

function drawnCard(card, deckStyle) {
  return resolveReadingCards([{ card, position: 'Daily focus', orientation: 'Upright', meaning: 'A calm moment.' }], deckStyle);
}

// This is the literal pre-versioned wire shape, independently signed so changes
// to the production builder cannot silently change the compatibility fixture.
function legacyProof(deckStyle = 'rws-1909', predictedCard = 'Knight of Cups') {
  const payload = {
    id: 'legacy-vision-proof',
    deckStyle,
    createdAt: '2026-09-04T00:00:00.000Z',
    expiresAt: '2099-01-01T00:00:00.000Z',
    insights: [{
      label: 'legacy-upload',
      predictedCard,
      confidence: 0.98,
      basis: 'llama',
      matches: [{ card: predictedCard, confidence: 0.98, basis: 'llama' }],
      attention: null,
      symbolVerification: null,
      visualProfile: null,
      orientation: 'upright',
      reasoning: null,
      visualDetails: null,
      mergeSource: null,
      componentScores: null,
      routerFeatures: null,
      calibratedConfidence: null,
      decisionReason: null,
      abstain: false,
      imageQuality: null
    }]
  };
  const signature = createHmac('sha256', TEST_SECRET).update(JSON.stringify(payload)).digest('base64');
  return { ...payload, signature };
}

describe('signed vision identity', () => {
  for (const [displayName, canonicalName, secondaryDisplay, secondaryCanonical] of [
    ['Prince of Cups', 'Knight of Cups', 'Knight of Cups', 'King of Cups'],
    ['Knight of Cups', 'King of Cups', 'Prince of Cups', 'Knight of Cups']
  ]) {
    it(`preserves raw Thoth ${displayName} through build, sign, verify, and annotation`, async () => {
      const payload = buildVisionProofPayload({
        id: `proof-${displayName}`,
        deckStyle: 'thoth-a1',
        insights: [{
          label: 'court-upload',
          predictedCard: displayName,
          confidence: 0.98,
          matches: [{ card: displayName, confidence: 0.98 }, { card: secondaryDisplay, confidence: 0.7 }]
        }]
      });
      const signature = await signVisionProof(payload, TEST_SECRET);
      const verified = await verifyVisionProof({ ...payload, signature }, TEST_SECRET);
      const [annotated] = annotateVisionInsights(verified.insights, drawnCard(displayName, 'thoth-a1'), 'thoth-a1');

      assert.equal(verified.insights[0].predictedCard, canonicalName);
      assert.equal(verified.insights[0].canonicalName, canonicalName);
      assert.equal(verified.insights[0].canonicalKey, canonicalName.toLowerCase());
      assert.equal(annotated.canonicalName, canonicalName);
      assert.equal(annotated.matchesDrawnCard, true);
      assert.deepEqual(annotated.matches.map((match) => match.canonicalName), [canonicalName, secondaryCanonical]);
    });
  }

  for (const canonicalFields of [
    { canonicalName: 'Knight of Cups' },
    { canonicalKey: 'knight of cups', canonicalName: 'Knight of Cups' }
  ]) {
    it(`honors explicit canonical identity when annotating ${JSON.stringify(canonicalFields)}`, () => {
      const [annotated] = annotateVisionInsights([{
        predictedCard: 'Knight of Cups',
        ...canonicalFields,
        confidence: 0.98,
        matches: [{ card: 'Knight of Cups', ...canonicalFields, confidence: 0.98 }]
      }], drawnCard('Prince of Cups', 'thoth-a1'), 'thoth-a1');
      assert.equal(annotated.canonicalName, 'Knight of Cups');
      assert.equal(annotated.matchesDrawnCard, true);
      assert.equal(annotated.matches[0].canonicalName, 'Knight of Cups');
    });
  }

  it('keeps legacy signatures valid while ignoring newly injected unsigned primary identity metadata', async () => {
    const proof = legacyProof('thoth-a1', 'King of Cups');
    proof.insights[0].canonicalName = 'Knight of Cups';
    proof.insights[0].canonicalKey = 'knight of cups';
    const verified = await verifyVisionProof(proof, TEST_SECRET);
    const [annotated] = annotateVisionInsights(verified.insights, drawnCard('Knight of Cups', 'thoth-a1'), 'thoth-a1');

    assert.equal(verified.insights[0].predictedCard, 'King of Cups');
    assert.equal(verified.insights[0].canonicalName, 'King of Cups');
    assert.equal(verified.insights[0].canonicalKey, 'king of cups');
    assert.equal(annotated.matchesDrawnCard, true);
    assert.equal(annotated.matches[0].canonicalName, 'King of Cups');
  });

  it('authenticates the format version instead of accepting an unsigned upgrade of a legacy proof', async () => {
    await assert.rejects(verifyVisionProof({ ...legacyProof(), version: 2 }, TEST_SECRET), /signature|identity/i);
  });

  it('rejects changes to each identity field in a newly signed proof', async () => {
    const payload = buildVisionProofPayload({
      id: 'tamper-identity',
      deckStyle: 'thoth-a1',
      insights: [{
        predictedCard: 'Prince of Cups',
        confidence: 0.98,
        matches: [{ card: 'Prince of Cups', confidence: 0.98 }]
      }]
    });
    const signature = await signVisionProof(payload, TEST_SECRET);
    await verifyVisionProof({ ...payload, signature }, TEST_SECRET);
    for (const [field, value] of [
      ['predictedCard', 'King of Cups'], ['canonicalName', 'King of Cups'], ['canonicalKey', 'king of cups']
    ]) {
      const tampered = structuredClone({ ...payload, signature });
      tampered.insights[0][field] = value;
      await assert.rejects(verifyVisionProof(tampered, TEST_SECRET), /signature|identity/i, field);
    }
    for (const [field, value] of [
      ['card', 'King of Cups'], ['canonicalName', 'King of Cups'], ['canonicalKey', 'king of cups']
    ]) {
      const tampered = structuredClone({ ...payload, signature });
      tampered.insights[0].matches[0][field] = value;
      await assert.rejects(verifyVisionProof(tampered, TEST_SECRET), /signature|identity/i, `secondary ${field}`);
    }
  });

  it('retains legacy RWS proof identity and rejects signed secondary tampering', async () => {
    const proof = legacyProof();
    const verified = await verifyVisionProof(proof, TEST_SECRET);
    const [annotated] = annotateVisionInsights(verified.insights, drawnCard('Knight of Cups', 'rws-1909'));
    assert.equal(annotated.canonicalName, 'Knight of Cups');
    assert.equal(annotated.matchesDrawnCard, true);
    proof.insights[0].matches[0].canonicalKey = 'king of cups';
    await assert.rejects(verifyVisionProof(proof, TEST_SECRET), /signature/i);
  });
});

describe('vision API signed identity round trip', () => {
  const pendingResults = [];
  const env = {
    VISION_PROOF_SECRET: TEST_SECRET,
    AI: { run: async () => ({ response: JSON.stringify(pendingResults.shift()) }) }
  };

  for (const [deckStyle, displayName, canonicalName, secondaryDisplay, secondaryCanonical] of [
    ['thoth-a1', 'Prince of Cups', 'Knight of Cups', 'Knight of Cups', 'King of Cups'],
    ['thoth-a1', 'Knight of Cups', 'King of Cups', 'Prince of Cups', 'Knight of Cups'],
    ['rws-1909', 'Knight of Cups', 'Knight of Cups', 'King of Cups', 'King of Cups'],
    ['marseille-classic', 'Chevalier of Coupes', 'Knight of Cups', 'Roi of Coupes', 'King of Cups']
  ]) {
    it(`preserves ${deckStyle} ${displayName} and secondary identities from provider to reading annotation`, async () => {
      pendingResults.push({
        card: displayName,
        confidence: 0.98,
        orientation: 'upright',
        reasoning: 'A court figure holds a cup.',
        visualDetails: ['a cup'],
        matches: [{ card: displayName, confidence: 0.98 }, { card: secondaryDisplay, confidence: 0.7 }]
      });
      const request = new Request('http://localhost/api/vision-proof', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          deckStyle,
          backendId: 'llama-vision',
          evidence: [{ label: 'court-upload', dataUrl: 'data:image/png;base64,ZmFrZQ==' }]
        })
      });
      const response = await onRequestPost({ request, env });
      assert.equal(response.status, 201);
      const { proof } = await response.json();
      const verified = await verifyVisionProof(proof, TEST_SECRET);
      const [annotated] = annotateVisionInsights(verified.insights, drawnCard(displayName, deckStyle), deckStyle);

      assert.equal(proof.insights[0].predictedCard, canonicalName);
      assert.equal(verified.insights[0].canonicalName, canonicalName);
      assert.equal(annotated.canonicalName, canonicalName);
      assert.equal(annotated.matchesDrawnCard, true);
      assert.deepEqual(annotated.matches.map((match) => match.canonicalName), [canonicalName, secondaryCanonical]);
    });
  }
});
