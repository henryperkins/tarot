// tests/embeddings.test.mjs
// Tests for embeddings utility module
// Run with: npm test -- tests/embeddings.test.mjs

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMBEDDING_MODEL,
  cosineSimilarity,
  normalizeVector,
  embedText,
  embedTextWithMetadata,
  embedTextsWithMetadata,
  isSemanticEmbedding,
  clearEmbeddingCache,
  getEmbeddingCacheStats
} from '../functions/lib/embeddings.js';

// Workers AI binding stub that returns one vector per requested text.
function workersAI(t, vectorFor = () => [1, 0]) {
  const run = t.mock.fn(async (_model, { text }) => ({
    data: text.map((value) => vectorFor(value)),
    shape: [text.length, 2]
  }));
  return { env: { AI: { run } }, run };
}

describe('cosineSimilarity', () => {
  test('returns 1 for identical vectors', () => {
    const v = [1, 0, 0, 0];
    const similarity = cosineSimilarity(v, v);
    assert.ok(Math.abs(similarity - 1) < 0.001, 'Identical vectors should have similarity 1');
  });

  test('returns 1 for parallel vectors of different magnitude', () => {
    const a = [1, 2, 3];
    const b = [2, 4, 6]; // Same direction, 2x magnitude
    const similarity = cosineSimilarity(a, b);
    assert.ok(Math.abs(similarity - 1) < 0.001, 'Parallel vectors should have similarity 1');
  });

  test('returns 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    const similarity = cosineSimilarity(a, b);
    assert.ok(Math.abs(similarity) < 0.001, 'Orthogonal vectors should have similarity 0');
  });

  test('returns 0 for mismatched vector lengths', () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    const similarity = cosineSimilarity(a, b);
    assert.strictEqual(similarity, 0, 'Mismatched lengths should return 0');
  });

  test('returns 0 for empty vectors', () => {
    assert.strictEqual(cosineSimilarity([], []), 0);
  });

  test('returns 0 for null/undefined inputs', () => {
    assert.strictEqual(cosineSimilarity(null, [1, 2]), 0);
    assert.strictEqual(cosineSimilarity([1, 2], null), 0);
    assert.strictEqual(cosineSimilarity(undefined, [1, 2]), 0);
  });

  test('returns 0 for zero vectors', () => {
    const zero = [0, 0, 0];
    const nonzero = [1, 2, 3];
    assert.strictEqual(cosineSimilarity(zero, nonzero), 0, 'Zero vector should return 0');
    assert.strictEqual(cosineSimilarity(zero, zero), 0, 'Two zero vectors should return 0');
  });

  test('clamps result to [0, 1] range', () => {
    // Due to floating point, result should never exceed 1
    const a = [0.1, 0.2, 0.3, 0.4, 0.5];
    const b = [0.1, 0.2, 0.3, 0.4, 0.5];
    const similarity = cosineSimilarity(a, b);
    assert.ok(similarity >= 0 && similarity <= 1, 'Should be in [0, 1] range');
  });

  test('handles negative values correctly', () => {
    const a = [1, -1, 1];
    const b = [1, -1, 1];
    const similarity = cosineSimilarity(a, b);
    assert.ok(Math.abs(similarity - 1) < 0.001, 'Identical vectors with negatives should be 1');
  });
});

describe('normalizeVector', () => {
  test('normalizes to unit length', () => {
    const v = [3, 4]; // Length 5
    const normalized = normalizeVector(v);

    // Check unit length
    const length = Math.sqrt(normalized.reduce((sum, x) => sum + x * x, 0));
    assert.ok(Math.abs(length - 1) < 0.001, 'Normalized vector should have length 1');

    // Check direction preserved
    assert.ok(Math.abs(normalized[0] - 0.6) < 0.001);
    assert.ok(Math.abs(normalized[1] - 0.8) < 0.001);
  });

  test('returns empty array for empty input', () => {
    const result = normalizeVector([]);
    assert.deepStrictEqual(result, []);
  });

  test('returns input for null/undefined', () => {
    assert.strictEqual(normalizeVector(null), null);
    assert.strictEqual(normalizeVector(undefined), undefined);
  });

  test('handles zero vector', () => {
    const zero = [0, 0, 0];
    const result = normalizeVector(zero);
    // Should return original (can't normalize zero vector)
    assert.deepStrictEqual(result, zero);
  });

  test('handles single-element vector', () => {
    const v = [5];
    const normalized = normalizeVector(v);
    assert.ok(Math.abs(normalized[0] - 1) < 0.001, 'Single element should normalize to 1');
  });
});

describe('embedText', () => {
  test('returns array for valid text', async () => {
    const embedding = await embedText('test text');
    assert.ok(Array.isArray(embedding), 'Should return array');
    assert.ok(embedding.length > 0, 'Should have dimensions');
  });

  test('returns consistent embedding for same text (cache)', async () => {
    clearEmbeddingCache();

    const text = 'consistent test text';
    const first = await embedText(text);
    const second = await embedText(text);

    assert.deepStrictEqual(first, second, 'Same text should produce same embedding');
  });

  test('returns fallback embedding for empty text', async () => {
    const embedding = await embedText('');
    assert.ok(Array.isArray(embedding), 'Should return array for empty text');
  });

  test('returns fallback embedding for null/undefined', async () => {
    const nullEmbed = await embedText(null);
    const undefEmbed = await embedText(undefined);

    assert.ok(Array.isArray(nullEmbed), 'Should return array for null');
    assert.ok(Array.isArray(undefEmbed), 'Should return array for undefined');
  });

  test('produces different embeddings for different text', async () => {
    const embed1 = await embedText('love and relationships');
    const embed2 = await embedText('career and money');

    // At least some dimensions should differ
    let hasDifference = false;
    for (let i = 0; i < Math.min(embed1.length, embed2.length); i++) {
      if (Math.abs(embed1[i] - embed2[i]) > 0.001) {
        hasDifference = true;
        break;
      }
    }
    assert.ok(hasDifference, 'Different texts should produce different embeddings');
  });

  test('truncates very long text', async () => {
    const longText = 'word '.repeat(5000); // Very long
    const embedding = await embedText(longText);
    assert.ok(Array.isArray(embedding), 'Should handle long text');
    assert.ok(embedding.length > 0, 'Should produce valid embedding');
  });

  test('detects semantic terms in fallback embedding', async () => {
    // Without API, uses fallback which has semantic term detection
    const loveEmbed = await embedText('love relationships emotional connection', { env: null });
    const careerEmbed = await embedText('career work professional opportunity', { env: null });

    // These should have different semantic fingerprints
    const similarity = cosineSimilarity(loveEmbed, careerEmbed);
    assert.ok(similarity < 0.95, 'Different topics should have lower similarity');
  });

  test('detects tarot terms in fallback embedding', async () => {
    const tarotEmbed = await embedText('fool magician death tower transformation', { env: null });
    const genericEmbed = await embedText('random words without meaning here', { env: null });

    // Tarot-specific terms should produce distinct embedding
    const similarity = cosineSimilarity(tarotEmbed, genericEmbed);
    assert.ok(similarity < 0.9, 'Tarot terms should produce distinct embedding');
  });
});

describe('Embedding Cache', () => {
  beforeEach(clearEmbeddingCache);
  afterEach(clearEmbeddingCache);

  test('clearEmbeddingCache clears all entries', async (t) => {
    const { env } = workersAI(t);
    // Add something to cache
    await embedText('cache test', { env });

    const beforeClear = getEmbeddingCacheStats();
    assert.equal(beforeClear.size, 1);

    clearEmbeddingCache();

    const afterClear = getEmbeddingCacheStats();
    assert.strictEqual(afterClear.size, 0, 'Cache should be empty after clear');
  });

  test('getEmbeddingCacheStats returns valid stats', () => {
    const stats = getEmbeddingCacheStats();

    assert.ok(typeof stats.size === 'number', 'Should have size');
    assert.ok(typeof stats.maxSize === 'number', 'Should have maxSize');
    assert.ok(stats.size >= 0, 'Size should be non-negative');
    assert.ok(stats.maxSize > 0, 'MaxSize should be positive');
  });

  test('cache respects max size limit', async (t) => {
    const { env } = workersAI(t);
    const stats = getEmbeddingCacheStats();
    const maxSize = stats.maxSize;

    // Add more than max entries
    for (let i = 0; i < maxSize + 10; i++) {
      await embedText(`unique text entry number ${i}`, { env });
    }

    const afterStats = getEmbeddingCacheStats();
    assert.equal(afterStats.size, maxSize);
  });

  test('keeps texts with the same first 200 characters separate', async (t) => {
    const prefix = 'Shared background before the distinct current question. '.repeat(5);
    const firstText = `${prefix}Focus on my career.`;
    const secondText = `${prefix}Focus on my marriage.`;
    const { env, run } = workersAI(t, (text) => (text === firstText ? [1, 0] : [0, 1]));

    assert.deepEqual(await embedText(firstText, { env }), [1, 0]);
    assert.deepEqual(await embedText(secondText, { env }), [0, 1]);
    assert.equal(run.mock.callCount(), 2);
  });

  test('reuses embeddings for equivalent normalized inputs', async (t) => {
    const { env, run } = workersAI(t);

    await embedText('  hope after a transition\n', { env });
    assert.deepEqual(await embedText('hope after a transition', { env }), [1, 0]);
    assert.deepEqual(run.mock.calls[0].arguments[1].text, ['hope after a transition']);
    assert.equal(run.mock.callCount(), 1);
  });

  test('keys the same capped API input consistently', async (t) => {
    const cappedInput = 'a'.repeat(8000);
    const { env, run } = workersAI(t);

    await embedText(`${cappedInput}first unused suffix`, { env });
    assert.deepEqual(await embedText(`${cappedInput}second unused suffix`, { env }), [1, 0]);
    assert.deepEqual(run.mock.calls[0].arguments[1].text, [cappedInput]);
    assert.equal(run.mock.callCount(), 1);
  });
});

describe('Workers AI embeddings', () => {
  beforeEach(clearEmbeddingCache);
  afterEach(clearEmbeddingCache);

  test('requests the embedding model with input truncation enabled', async (t) => {
    const { env, run } = workersAI(t);

    const result = await embedTextWithMetadata('What helps me rest?', { env });

    const [model, input] = run.mock.calls[0].arguments;
    assert.equal(model, EMBEDDING_MODEL);
    assert.deepEqual(input, { text: ['What helps me rest?'], truncate_inputs: true });
    assert.equal(isSemanticEmbedding(result), true);
  });

  test('embeds a batch in one request and returns results in input order', async (t) => {
    const { env, run } = workersAI(t, (text) => (text === 'b' ? [0, 1] : [1, 0]));

    const results = await embedTextsWithMetadata(['a', 'b', 'a', ''], { env });

    assert.equal(run.mock.callCount(), 1);
    assert.deepEqual(run.mock.calls[0].arguments[1].text, ['a', 'b'], 'Duplicate and empty texts are not sent');
    assert.deepEqual(results.map((r) => r.source), ['workers-ai', 'workers-ai', 'workers-ai', 'fallback']);
    assert.deepEqual(results.map((r) => r.embedding).slice(0, 3), [[1, 0], [0, 1], [1, 0]]);
  });

  test('splits batches of more than 100 texts', async (t) => {
    const { env, run } = workersAI(t);
    const texts = Array.from({ length: 130 }, (_, i) => `passage ${i}`);

    const results = await embedTextsWithMetadata(texts, { env });

    assert.deepEqual(run.mock.calls.map((call) => call.arguments[1].text.length), [100, 30]);
    assert.ok(results.every(isSemanticEmbedding));
  });

  test('falls back only for the texts whose vectors are unusable', async (t) => {
    const run = t.mock.fn(async () => ({ data: [[3, 4], [0, 0], [1, Number.NaN]] }));

    const results = await embedTextsWithMetadata(['good', 'zero', 'not a number'], { env: { AI: { run } } });

    assert.deepEqual(results.map((r) => r.source), ['workers-ai', 'fallback', 'fallback']);
    assert.deepEqual(results[0].embedding, [0.6, 0.8], 'Model vectors are scaled to unit length');
    assert.equal(getEmbeddingCacheStats().size, 1, 'Only the usable vector is cached');
  });

  for (const [failure, run] of [
    ['the request throws', async () => { throw new Error('Synthetic outage'); }],
    ['the response has too few vectors', async () => ({ data: [[1, 0]] })],
    ['the response has no vectors', async () => ({ response: 'not embeddings' })]
  ]) {
    test(`falls back for the whole batch when ${failure}`, async () => {
      const results = await embedTextsWithMetadata(['first', 'second'], { env: { AI: { run } } });

      assert.deepEqual(results.map((r) => r.source), ['fallback', 'fallback']);
      assert.equal(getEmbeddingCacheStats().size, 0, 'Failures are not cached');
    });
  }

  test('gives up on a request that outlasts the timeout', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let markStarted;
    const started = new Promise((resolve) => { markStarted = resolve; });
    let requestSignal;
    const run = (_model, _input, { signal }) => {
      requestSignal = signal;
      markStarted();
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      });
    };

    const pending = embedTextWithMetadata('slow text', { env: { AI: { run } } });
    await started;
    assert.equal(requestSignal.aborted, false);
    t.mock.timers.tick(3000);

    assert.equal((await pending).source, 'fallback');
    assert.equal(requestSignal.aborted, true);
  });

  test('uses the fallback without a Workers AI binding', async () => {
    const result = await embedTextWithMetadata('no binding', { env: {} });

    assert.equal(result.source, 'fallback');
    assert.equal(isSemanticEmbedding(result), false);
  });
});
