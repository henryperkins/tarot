import assert from 'node:assert/strict';
import { it } from 'node:test';
import { evaluateVisionInsightPromptEligibility } from '../functions/lib/readingQuality.js';
import { mergeVisionAnalyses } from '../shared/vision/hybridVisionPipeline.js';
import { TarotVisionPipeline } from '../shared/vision/tarotVisionPipeline.js';
import { onRequestPost } from '../functions/api/vision-proof.js';
import { verifyVisionProof } from '../functions/lib/visionProof.js';
import { buildVisionProofPayload, signVisionProof } from '../functions/lib/visionProof.js';
import { buildVisionEvidencePackets } from '../functions/lib/visionEvidence.js';

for (const annotationStatus of [undefined, 'unverified', 'unsupported']) {
  it(`keeps ${annotationStatus} symbols out of prompts even at high confidence`, () => {
    const result = evaluateVisionInsightPromptEligibility({ matchesDrawnCard: true, confidence: 1, symbolVerification: { annotationStatus, matchRate: 1, weightedMatchRate: 1 } });
    assert.equal(result.promptEligible, false);
    assert.equal(result.telemetryOnly, true);
    assert.equal(result.suppressionReason, 'symbol_annotations_unverified');
  });
}

it('rejects a known absence false positive even when confidence clears the floor', () => {
  const result = evaluateVisionInsightPromptEligibility({ matchesDrawnCard: true, confidence: 1, symbolVerification: { annotationStatus: 'verified', weightedMatchRate: 0.9, absentSymbolFalsePositive: true } });
  assert.equal(result.promptEligible, false);
  assert.equal(result.suppressionReason, 'absent_symbol_false_positive');
});

it('does not promote agreement using unsupported symbol evidence', () => {
  const result = mergeVisionAnalyses(
    { topMatch: { cardName: 'The Fool', score: 0.9 }, symbolVerification: { annotationStatus: 'unsupported', weightedMatchRate: 1 } },
    { topMatch: { cardName: 'The Fool', score: 0.9 }, analysisStatus: 'ok' }
  );
  assert.notEqual(result.decisionReason, 'clip_llama_agree_symbol_grounded');
  assert.equal(result.symbolVerification.telemetryOnly, true);
});

it('retains the annotation restriction through API sanitization and signed proof verification', async (t) => {
  t.mock.method(TarotVisionPipeline.prototype, '_ensureCardEmbeddings', async () => {});
  t.mock.method(TarotVisionPipeline.prototype, 'analyzeImages', async () => [{
    label: 'test-photo', topMatch: { cardName: 'The Fool', score: 1 },
    symbolVerification: { annotationStatus: 'unsupported', deckStyle: 'marseille-classic', matchRate: null, weightedMatchRate: null, absenceExpectedCount: 0, absentSymbolFalsePositive: null }
  }]);
  const response = await onRequestPost({
    request: new Request('https://example.test/api/vision-proof', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deckStyle: 'marseille-classic', backendId: 'clip-default', evidence: [{ label: 'test-photo', dataUrl: 'data:image/png;base64,AA==' }] }) }),
    env: { VISION_PROOF_SECRET: 'test-only-annotation-secret' }
  });
  assert.equal(response.status, 201);
  const { proof } = await response.json();
  const verified = await verifyVisionProof(proof, 'test-only-annotation-secret');
  assert.equal(verified.insights[0].symbolVerification.annotationStatus, 'unsupported');
  assert.equal(verified.insights[0].symbolVerification.absentSymbolFalsePositive, null);
  const result = evaluateVisionInsightPromptEligibility({ ...verified.insights[0], matchesDrawnCard: true });
  assert.equal(result.promptEligible, false);
});

it('does not describe unverified annotation matches as verified visual evidence', () => {
  const [packet] = buildVisionEvidencePackets([{ predictedCard: 'The Fool', confidence: 1, matchesDrawnCard: true, symbolVerification: { annotationStatus: 'unverified', weightedMatchRate: 1, matches: [{ object: 'dog', found: true, confidence: 1 }] } }], [{ card: 'The Fool' }]);
  assert.notEqual(packet?.visualClaimMode, 'verified_visual_evidence');
});

it('keeps authenticated older symbol proofs without annotation provenance telemetry-only', async () => {
  const payload = buildVisionProofPayload({ id: 'legacy-symbols', deckStyle: 'rws-1909', insights: [{ predictedCard: 'The Fool', confidence: 1, symbolVerification: { weightedMatchRate: 0.99, matchRate: 1 } }] });
  const signature = await signVisionProof(payload, 'test-only-legacy-secret');
  const proof = await verifyVisionProof({ ...payload, signature }, 'test-only-legacy-secret');
  assert.equal(evaluateVisionInsightPromptEligibility({ ...proof.insights[0], matchesDrawnCard: true }).promptEligible, false);
  const merged = mergeVisionAnalyses({ topMatch: { cardName: 'The Fool', score: 1 }, symbolVerification: proof.insights[0].symbolVerification }, { topMatch: { cardName: 'The Fool', score: 1 }, analysisStatus: 'ok' });
  assert.notEqual(merged.decisionReason, 'clip_llama_agree_symbol_grounded');
  assert.equal(merged.symbolVerification.telemetryOnly, true);
});
