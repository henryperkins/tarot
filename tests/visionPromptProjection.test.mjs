import assert from 'node:assert/strict';
import { test } from 'node:test';

import { onRequestPost as createVisionProof } from '../functions/api/vision-proof.js';
import { onRequestPost as createReading } from '../functions/api/tarot-reading.js';
import { verifyVisionProof } from '../functions/lib/visionProof.js';
import { buildVisionValidationSection, buildUploadedVisibleEvidenceSection } from '../functions/lib/narrative/prompts/visionValidation.js';
import { buildVisionEvidencePackets } from '../functions/lib/visionEvidence.js';
import { createVisionPromptProjector, projectVisionInsightForPrompt } from '../functions/lib/visionPromptProjection.js';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrativeBuilder.js';

const cardsInfo = [{ card: 'The Sun', canonicalName: 'The Sun', canonicalKey: 'the sun', position: 'Theme', orientation: 'Upright', meaning: 'Confidence and renewal.' }];
const safeDetail = 'A moonlit sky surrounds the sun, suggesting quiet strength.';
const post = (path, body) => new Request(`https://tableau.test${path}`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
});

test('projects recognizer prose after signing before the actual Modal reading request', async (t) => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
  const env = {
    MODAL_ENDPOINT_URL: 'https://modal.test', MODAL_MODEL: 'test-qwen', MODAL_PROXY_TOKEN: 'test-token',
    VISION_PROOF_SECRET: 'vision-projection-test-secret', GRAPHRAG_ENABLED: 'false', EVAL_ENABLED: 'false', EVAL_GATE_ENABLED: 'false',
    AI: { run: async () => ({ response: JSON.stringify({
      card: 'The Sun', confidence: 0.98, orientation: 'upright',
      reasoning: 'The Sun is more likely than The Moon because the bright disk and child distinguish it from the dogs and towers of The Moon. A child holds a banner.',
      visualDetails: ['A bright disk, unlike The Moon.', safeDetail],
      matches: [{ card: 'The Sun', confidence: 0.98 }, { card: 'The Moon', confidence: 0.9 }]
    }) }) }
  };
  const proofResponse = await createVisionProof({ env, request: post('/api/vision-proof', {
    backendId: 'llama-vision', deckStyle: 'rws-1909', evidence: [{ label: 'photo', dataUrl: 'data:image/png;base64,aGVsbG8=' }]
  }) });
  assert.equal(proofResponse.status, 201);
  const { proof } = await proofResponse.json();
  const signedBytes = JSON.stringify(proof);
  assert.match(proof.insights[0].reasoning, /The Moon/);
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '### Opening\n\nThe Sun invites confidence and renewal.\n\n### Insight\n\nOne small choice could help you find a steady rhythm.\n\nYour choices shape outcomes.' } }] });
  });
  const response = await createReading({ env, waitUntil: (promise) => promise.catch(() => {}), request: post('/api/tarot-reading', {
    spreadInfo: { name: 'One-Card Insight' }, deckStyle: 'rws-1909', cardsInfo,
    userQuestion: 'What can I reflect on today?', visionProof: proof
  }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).provider, 'modal-qwen');
  assert.ok(requests.length > 0);
  for (const request of requests) {
    const prompt = request.messages[1].content;
    assert.doesNotMatch(prompt, /The Moon|dogs and towers/);
    assert.match(prompt, /A child holds a banner/);
    assert.match(prompt, /moonlit sky surrounds the sun/);
    assert.match(prompt, /Secondary matches: The Sun/);
  }
  assert.equal(JSON.stringify(proof), signedBytes);
  assert.match((await verifyVisionProof(proof, env.VISION_PROOF_SECRET)).insights[0].reasoning, /The Moon/);
});

test('projects every diagnostic prose channel without mutating the raw insight', () => {
  const insight = {
    predictedCard: 'The Sun', canonicalKey: 'the sun', confidence: 0.98, matchesDrawnCard: true, promptEligible: true,
    label: 'The Moon card photograph', basis: 'Compared with The Moon', mergeSource: 'The Moon card candidate',
    reasoning: 'Unlike The Moon, this is bright. A child holds a banner.',
    visualDetails: ['The Moon card has towers.', safeDetail],
    visualProfile: { tone: ['The Moon card looks dim', 'warm'], emotion: ['The Moon card is uncertain', 'quiet strength'] },
    symbolVerification: { matchRate: 0.98, missingSymbols: ['The Moon card towers', 'sunflower'] }
  };
  const original = structuredClone(insight);
  const prompt = buildVisionValidationSection([insight], { cardsInfo, deckStyle: 'rws-1909' });
  assert.doesNotMatch(prompt, /The Moon/);
  assert.match(prompt, /A child holds a banner/);
  assert.match(prompt, /moonlit sky surrounds the sun/);
  assert.match(prompt, /warm|quiet strength/);
  assert.deepEqual(insight, original);
});

test('projects packet prose at rendering while retaining raw evidence diagnostics', () => {
  const packets = buildVisionEvidencePackets([{
    predictedCard: 'The Sun', confidence: 0.98, matchesDrawnCard: true, promptEligible: true,
    visualDetails: ['Unlike The Moon, this is bright.', safeDetail]
  }], cardsInfo);
  assert.match(packets[0].uncertainSymbols[0].literalObservation, /The Moon/);
  const original = structuredClone(packets);
  const prompt = buildUploadedVisibleEvidenceSection(packets, { cardsInfo, deckStyle: 'rws-1909' });
  assert.doesNotMatch(prompt, /The Moon/);
  assert.match(prompt, /moonlit sky surrounds the sun/);
  assert.deepEqual(packets, original);
});

test('projects modern and legacy evidence prose fields, including labels and symbolic meanings', () => {
  const alternate = 'The Tower card has a dark border.';
  const packets = [{
    card: 'The Sun', evidenceMode: 'uploaded_image', label: alternate,
    cardKnowledge: { coreThemes: [alternate, 'quiet strength'] },
    expectedRiderSymbols: [{ label: alternate }, { label: 'the sun' }],
    verifiedUploadedEvidence: [{ literalObservation: alternate }, { literalObservation: safeDetail }],
    uncertainSymbols: [{ label: alternate }, { literalObservation: 'A pale banner.' }],
    forbiddenClaims: [alternate, 'Treat unverified details cautiously.']
  }, {
    card: 'The Sun', evidenceMode: 'uploaded_image', label: 'photo',
    visibleEvidence: [{ literalObservation: alternate, symbolicMeaning: [alternate, 'confidence'] }, { literalObservation: safeDetail }]
  }];
  const original = structuredClone(packets);
  const prompt = buildUploadedVisibleEvidenceSection(packets, { cardsInfo });
  assert.doesNotMatch(prompt, /The Tower|dark border/);
  assert.match(prompt, /quiet strength|the sun|moonlit sky|pale banner|confidence/);
  assert.deepEqual(packets, original);
});

for (const [deckStyle, drawn, allowed, forbidden] of [
  ['rws-1909', { card: 'The Sun', canonicalKey: 'the sun' }, 'The Sun card shines brightly.', 'The Moon card has towers.'],
  ['thoth-a1', { card: 'Prince of Cups', canonicalKey: 'knight of cups' }, 'The Prince of Cups carries a cup.', 'The Prince of Swords carries a sword.'],
  ['thoth-a1', { card: 'Knight of Cups', canonicalKey: 'king of cups' }, 'The Knight of Cups carries a cup.', 'The Prince of Cups carries a cup.'],
  ['marseille-classic', { card: 'Le Soleil', canonicalKey: 'the sun' }, 'Le Soleil has two figures.', 'La Lune has two towers.']
]) {
  test(`respects drawn canonical identities and ${deckStyle} prose aliases for ${drawn.card}`, () => {
    const project = createVisionPromptProjector([drawn], deckStyle);
    assert.equal(project(`${forbidden} ${allowed}`), allowed);
    assert.equal(project(safeDetail), safeDetail);
    assert.equal(project('Strength is conveyed by the red palette. The sun lights the sky.'), 'Strength is conveyed by the red palette. The sun lights the sky.');
    assert.equal(project('Strength card appears here.'), '');
  });
}

test('projects card-level profiles using the whole spread while retaining literal imagery', () => {
  const raw = {
    predictedCard: 'The Sun',
    visualProfile: { tone: ['Unlike The Moon, this is bright.', 'warm'], emotion: ['Strength card appears here.', 'quiet strength'] },
    reasoning: 'A moonlit sky\nA golden banner'
  };
  const original = structuredClone(raw);
  const projected = projectVisionInsightForPrompt(raw, { cardsInfo, deckStyle: 'rws-1909' });
  assert.deepEqual(projected.visualProfile, { tone: ['warm'], emotion: ['quiet strength'] });
  assert.equal(projected.reasoning, 'A moonlit sky A golden banner');
  const drawnMoon = projectVisionInsightForPrompt(raw, { cardsInfo: [...cardsInfo, { card: 'The Moon', canonicalKey: 'the moon' }] });
  assert.equal(drawnMoon.visualProfile.tone[0], 'Unlike The Moon, this is bright.');
  assert.deepEqual(raw, original);
});

test('recognizes lower-case alternate-card comparisons without filtering ordinary symbol descriptions', () => {
  const project = createVisionPromptProjector(cardsInfo);
  for (const text of [
    'the sun is more likely than the moon because of the child.',
    'a bright disk, unlike the moon.',
    'alternate: the moon.',
    'recognized as strength.',
    'the moon card has towers.'
  ]) assert.equal(project(text), '', text);
  for (const text of [
    safeDetail,
    'The moon lights the sky.',
    'Unlike the dark border, the sun is bright.',
    'Compared with the dark border, quiet strength comes through.'
  ]) assert.equal(project(text), text, text);
});

test('keeps alternate-card tone and emotion out of the entire assembled reading prompt', () => {
  const { userPrompt } = buildEnhancedClaudePrompt({
    spreadInfo: { name: 'One-Card Insight' }, cardsInfo: [{ ...cardsInfo[0], number: 19 }],
    userQuestion: 'What can I reflect on today?', themes: {}, context: 'general',
    promptBudgetEnv: { GRAPHRAG_ENABLED: 'false' },
    visionInsights: [{
      predictedCard: 'The Sun', canonicalKey: 'the sun', confidence: 0.98, matchesDrawnCard: true,
      visualProfile: { tone: ['The Moon card has an uncertain tone.', 'warm'], emotion: ['Strength card appears here.', 'quiet strength'] }
    }]
  });
  assert.doesNotMatch(userPrompt, /The Moon|Strength card/);
  assert.match(userPrompt, /Vision-detected tone: warm/);
  assert.match(userPrompt, /Emotional quality: quiet strength/);
});
