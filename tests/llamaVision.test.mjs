import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runLlamaVisionAnalysis } from '../functions/lib/llamaVision.js';
import { buildVisionProofPayload, signVisionProof, verifyVisionProof } from '../functions/lib/visionProof.js';
import { mergeVisionAnalyses } from '../shared/vision/hybridVisionPipeline.js';
import { onRequestPost } from '../functions/api/vision-proof.js';

const TEST_SECRET = 'test-secret';
const DATA_URL = 'data:image/png;base64,ZmFrZQ==';

function makeVisionRequest(body) {
  return new Request('http://localhost/api/vision-proof', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function makeEnv({ prompts } = {}) {
  return {
    VISION_PROOF_SECRET: TEST_SECRET,
    AI: {
      run: async (_model, payload) => {
        const userMessage = payload?.messages?.find((message) => message.role === 'user');
        const textPart = userMessage?.content?.find((part) => part.type === 'text');
        if (Array.isArray(prompts)) {
          prompts.push(textPart?.text || '');
        }
        return {
          response: JSON.stringify({
            card: 'The Fool',
            confidence: 0.81,
            orientation: 'upright',
            reasoning: 'A traveler stands at the edge of a cliff.',
            visualDetails: ['cliff edge', 'small dog', 'bright sky']
          })
        };
      }
    }
  };
}

describe('runLlamaVisionAnalysis', () => {
  it('parses fenced JSON and preserves data URL', async () => {
    let capturedPayload = null;
    const env = {
      AI: {
        run: async (_model, payload) => {
          capturedPayload = payload;
          return {
            response: '```json\n{"card":"The Fool","confidence":0.87,"orientation":"upright","reasoning":"Bright traveler.","visualDetails":["cliff edge","small dog"]}\n```'
          };
        }
      }
    };

    const result = await runLlamaVisionAnalysis(env, {
      image: DATA_URL,
      allowedCards: ['The Fool']
    });

    assert.equal(result.status, 'ok');
    assert.equal(result.card, 'The Fool');
    assert.equal(result.orientation, 'upright');
    assert.equal(result.confidence, 0.87);
    assert.deepStrictEqual(result.visualDetails, ['cliff edge', 'small dog']);

    const userMessage = capturedPayload?.messages?.find((message) => message.role === 'user');
    const imagePart = userMessage?.content?.find((part) => part.type === 'image_url');
    assert.equal(imagePart?.image_url?.url, DATA_URL);
  });

  it('returns parse_error when response is not JSON', async () => {
    const env = {
      AI: {
        run: async () => ({ response: 'not-json' })
      }
    };

    const result = await runLlamaVisionAnalysis(env, { image: DATA_URL });
    assert.equal(result.status, 'parse_error');
  });

  it('returns timeout when AI call exceeds the deadline', async () => {
    const env = {
      AI: {
        run: (_model, _payload, options = {}) => new Promise((_, reject) => {
          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              const err = new Error('aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }
        })
      }
    };

    const result = await runLlamaVisionAnalysis(env, { image: DATA_URL, timeoutMs: 5 });
    assert.equal(result.status, 'timeout');
  });
});

describe('vision proof signing', () => {
  it('preserves vision metadata through sign/verify', async () => {
    const payload = buildVisionProofPayload({
      id: 'proof-1',
      deckStyle: 'rws-1909',
      ttlMs: 60 * 1000,
      insights: [
        {
          label: 'IMG_1',
          predictedCard: 'The Fool',
          confidence: 0.92,
          orientation: 'upright',
          reasoning: 'The figure stands at the cliff.',
          visualDetails: ['cliff edge', 'sun'],
          mergeSource: 'llama',
          componentScores: { clip: 0.2, llama: 0.9 }
        }
      ]
    });

    const signature = await signVisionProof(payload, TEST_SECRET);
    const verified = await verifyVisionProof({ ...payload, signature }, TEST_SECRET);
    const insight = verified.insights[0];

    assert.equal(insight.predictedCard, 'The Fool');
    assert.equal(insight.orientation, 'upright');
    assert.equal(insight.mergeSource, 'llama');
    assert.deepStrictEqual(insight.visualDetails, ['cliff edge', 'sun']);
    assert.deepStrictEqual(insight.componentScores, { clip: 0.2, llama: 0.9 });
  });
});

describe('mergeVisionAnalyses', () => {
  it('prefers higher-confidence llama match and retains clip details', () => {
    const clip = {
      topMatch: { cardName: 'The Fool', score: 0.4 },
      confidence: 0.4,
      matches: [{ cardName: 'The Fool', score: 0.4 }],
      attention: { gridSize: 1 },
      symbolVerification: { matchRate: 0.5 },
      visualProfile: { tone: ['bright'] }
    };
    const llama = {
      topMatch: { cardName: 'The Magician', score: 0.9 },
      confidence: 0.9,
      orientation: 'upright',
      reasoning: 'Staff and raised hand.',
      visualDetails: ['wand', 'table'],
      analysisStatus: 'ok'
    };

    const merged = mergeVisionAnalyses(clip, llama);

    assert.equal(merged.topMatch.cardName, 'The Magician');
    assert.equal(merged.mergeSource, 'llama');
    assert.equal(merged.orientation, 'upright');
    assert.equal(merged.attention, clip.attention);
    assert.deepStrictEqual(merged.componentScores, { clip: 0.4, llama: 0.9 });
  });

  it('falls back to clip when llama fails', () => {
    const clip = {
      topMatch: { cardName: 'The Fool', score: 0.6 },
      confidence: 0.6
    };
    const llama = {
      topMatch: { cardName: 'The Magician', score: 0.9 },
      confidence: 0.9,
      analysisStatus: 'error'
    };

    const merged = mergeVisionAnalyses(clip, llama);

    assert.equal(merged.topMatch.cardName, 'The Fool');
    assert.equal(merged.mergeSource, 'clip');
    assert.equal(merged.orientation, null);
  });
});

describe('vision-proof backend selection', () => {
  it('routes backendId to llama-vision', async () => {
    const env = makeEnv();
    const request = makeVisionRequest({
      deckStyle: 'marseille-classic',
      backendId: 'llama-vision',
      evidence: [{ label: 'img-1', dataUrl: DATA_URL }]
    });

    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.equal(payload?.proof?.insights?.[0]?.basis, 'llama');
  });

  it('uses VISION_BACKEND_DEFAULT when backendId is omitted', async () => {
    const env = { ...makeEnv(), VISION_BACKEND_DEFAULT: 'llama-vision' };
    const request = makeVisionRequest({
      deckStyle: 'custom-deck',
      evidence: [{ label: 'img-2', dataUrl: DATA_URL }]
    });

    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.equal(payload?.proof?.insights?.[0]?.basis, 'llama');
  });

  it('keys the backend cache by backendId and deckStyle', async () => {
    const prompts = [];
    const env = makeEnv({ prompts });

    const requestRws = makeVisionRequest({
      deckStyle: 'rws-1909',
      backendId: 'llama-vision',
      evidence: [{ label: 'img-3', dataUrl: DATA_URL }]
    });
    const requestThoth = makeVisionRequest({
      deckStyle: 'thoth-a1',
      backendId: 'llama-vision',
      evidence: [{ label: 'img-4', dataUrl: DATA_URL }]
    });

    const responseRws = await onRequestPost({ request: requestRws, env });
    const responseThoth = await onRequestPost({ request: requestThoth, env });

    assert.equal(responseRws.status, 201);
    assert.equal(responseThoth.status, 201);
    assert.equal(prompts.length, 2);
    assert.ok(prompts[0].includes('Classic Pamela Colman Smith watercolor palette'));
    assert.ok(prompts[1].includes('Abstract, prismatic geometry'));
  });
});
