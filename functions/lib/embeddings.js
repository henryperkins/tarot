// functions/lib/embeddings.js
// Embeddings utility for GraphRAG quality filtering
//
// Provides text embedding via the Workers AI binding (env.AI) and cosine
// similarity calculation. Used by graphRAG.js for semantic scoring of passage
// relevance.

import { sha256Hex } from './crypto.js';

// Multilingual (a question in any language can match the English canon), an
// 8,192-token context, and quick enough to sit on the reading path.
// Queries and passages embed the same way, so they share one request.
export const EMBEDDING_MODEL = '@cf/baai/bge-m3';

const MAX_INPUT_LENGTH = 8000;
const MAX_TEXTS_PER_REQUEST = 100;
const EMBEDDING_TIMEOUT_MS = 3000;

/**
 * Calculate cosine similarity between two vectors.
 * Returns 0-1 where 1 is identical direction.
 *
 * @param {number[]} a - First vector (normalized or unnormalized)
 * @param {number[]} b - Second vector (normalized or unnormalized)
 * @returns {number} Cosine similarity score (0-1)
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) {
    return 0;
  }

  // Clamp to [0, 1] to handle floating point imprecision
  return Math.max(0, Math.min(1, dot / magnitude));
}

/**
 * Normalize a vector to unit length.
 *
 * @param {number[]} vector - Input vector
 * @returns {number[]} Normalized vector
 */
export function normalizeVector(vector) {
  if (!vector || vector.length === 0) {
    return vector;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!norm || Number.isNaN(norm)) {
    return vector;
  }

  return vector.map((value) => value / norm);
}

// Module-level cache for embeddings to avoid redundant API calls
const embeddingCache = new Map();
const MAX_CACHE_SIZE = 100;

/**
 * Whether real embeddings can be requested: the Worker has a Workers AI binding.
 *
 * @param {Object} [env] - Worker environment
 * @returns {boolean}
 */
export function isEmbeddingProviderAvailable(env) {
  return typeof env?.AI?.run === 'function';
}

/**
 * Whether an embedding result is a real model embedding rather than the local
 * pseudo-embedding fallback.
 *
 * @param {{source?: string}} [result] - Result from embedTextWithMetadata()
 * @returns {boolean}
 */
export function isSemanticEmbedding(result) {
  return result?.source === 'workers-ai';
}

/**
 * Get embedding for text using Workers AI.
 * Falls back to a simple hash-based pseudo-embedding if the model is unavailable.
 *
 * @param {string} text - Text to embed
 * @param {Object} [options] - See embedTextsWithMetadata()
 * @returns {Promise<number[]>} Embedding vector
 */
export async function embedText(text, options = {}) {
  const { embedding } = await embedTextWithMetadata(text, options);
  return embedding;
}

/**
 * Get an embedding together with its source so callers can distinguish actual
 * semantic embeddings from the local pseudo-embedding fallback.
 *
 * @param {string} text - Text to embed
 * @param {Object} [options] - See embedTextsWithMetadata()
 * @returns {Promise<{embedding: number[], source: 'workers-ai'|'fallback'}>}
 */
export async function embedTextWithMetadata(text, options = {}) {
  const [result] = await embedTextsWithMetadata([text], options);
  return result;
}

/**
 * Embed several texts with one Workers AI request per MAX_TEXTS_PER_REQUEST
 * uncached texts. A text without a valid vector falls back to the
 * pseudo-embedding on its own; the rest of its batch keeps real vectors.
 *
 * @param {string[]} texts - Texts to embed
 * @param {Object} [options] - Options
 * @param {Object} [options.env] - Worker environment with the AI binding
 * @returns {Promise<Array<{embedding: number[], source: 'workers-ai'|'fallback'}>>} One result per text, in order
 */
export async function embedTextsWithMetadata(texts, options = {}) {
  const inputs = (Array.isArray(texts) ? texts : []).map((text) =>
    typeof text === 'string' ? text.trim().slice(0, MAX_INPUT_LENGTH) : ''
  );
  const results = inputs.map((input) => ({
    embedding: generateFallbackEmbedding(input),
    source: 'fallback'
  }));

  const { env } = options;
  if (!isEmbeddingProviderAvailable(env)) {
    return results;
  }

  // Positions per distinct text, so duplicates share one request slot.
  const positions = new Map();
  inputs.forEach((input, index) => {
    if (!input) return;
    if (!positions.has(input)) positions.set(input, []);
    positions.get(input).push(index);
  });

  const uncached = [];
  for (const [input, indexes] of positions) {
    // Hash the full input, not a prefix, so shared prefixes never reuse a vector.
    const cacheKey = await sha256Hex(JSON.stringify([EMBEDDING_MODEL, input]));
    const cached = embeddingCache.get(cacheKey);
    if (cached) {
      indexes.forEach((index) => { results[index] = { embedding: cached, source: 'workers-ai' }; });
    } else {
      uncached.push({ input, indexes, cacheKey });
    }
  }

  const batches = [];
  for (let start = 0; start < uncached.length; start += MAX_TEXTS_PER_REQUEST) {
    batches.push(uncached.slice(start, start + MAX_TEXTS_PER_REQUEST));
  }

  await Promise.all(batches.map(async (batch) => {
    const vectors = await fetchWorkersAIEmbeddings(env, batch.map((entry) => entry.input));
    batch.forEach((entry, offset) => {
      const embedding = toUnitVector(vectors?.[offset]);
      // Do not cache fallbacks; a subsequent call may succeed after an API outage.
      if (!embedding) return;
      cacheEmbedding(entry.cacheKey, embedding);
      entry.indexes.forEach((index) => { results[index] = { embedding, source: 'workers-ai' }; });
    });
  }));

  return results;
}

function cacheEmbedding(cacheKey, embedding) {
  if (embeddingCache.size >= MAX_CACHE_SIZE) {
    // Remove oldest entry (first key)
    const firstKey = embeddingCache.keys().next().value;
    embeddingCache.delete(firstKey);
  }
  embeddingCache.set(cacheKey, embedding);
}

/**
 * Request one batch of embeddings from Workers AI.
 *
 * @param {Object} env - Worker environment with the AI binding
 * @param {string[]} texts - Non-empty texts, at most MAX_TEXTS_PER_REQUEST
 * @returns {Promise<Array|null>} One raw vector per text, or null if the request failed
 */
async function fetchWorkersAIEmbeddings(env, texts) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);

  try {
    const response = await env.AI.run(
      EMBEDDING_MODEL,
      // Truncate rather than reject text past the model's token limit.
      { text: texts, truncate_inputs: true },
      { signal: controller.signal }
    );
    const vectors = response?.data;
    if (!Array.isArray(vectors) || vectors.length !== texts.length) {
      console.warn(
        `[Embeddings] Workers AI returned ${Array.isArray(vectors) ? vectors.length : 'no'} vectors for ${texts.length} texts`
      );
      return null;
    }
    return vectors;
  } catch (err) {
    const reason = err?.name === 'AbortError' ? `timed out after ${EMBEDDING_TIMEOUT_MS}ms` : err?.message;
    console.warn(`[Embeddings] Workers AI embedding failed: ${reason}`);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Validate a model vector and scale it to unit length.
 *
 * @param {unknown} vector - Raw vector from the model
 * @returns {number[]|null} Unit vector, or null if unusable
 */
function toUnitVector(vector) {
  if (!Array.isArray(vector) || vector.length === 0 || !vector.every(Number.isFinite)) {
    return null;
  }

  const squaredNorm = vector.reduce((sum, value) => sum + value * value, 0);
  if (!Number.isFinite(squaredNorm) || squaredNorm === 0) {
    return null;
  }

  return normalizeVector(vector);
}

/**
 * Generate a fallback pseudo-embedding using simple text features.
 * This is NOT a real embedding but provides basic similarity detection
 * when the embeddings API is unavailable.
 *
 * @param {string} text - Text to process
 * @returns {number[]} Pseudo-embedding vector (128 dimensions)
 */
function generateFallbackEmbedding(text) {
  const DIMENSIONS = 128;
  const vector = new Array(DIMENSIONS).fill(0);

  if (!text) {
    return vector;
  }

  const normalized = text.toLowerCase();
  const words = normalized.match(/\w+/g) || [];

  // Feature 1: Character frequency distribution (26 dimensions)
  for (const char of normalized) {
    const code = char.charCodeAt(0);
    if (code >= 97 && code <= 122) {
      // a-z
      vector[code - 97] += 1;
    }
  }

  // Feature 2: Word length distribution (10 dimensions)
  for (const word of words) {
    const lengthBucket = Math.min(word.length, 10) - 1;
    if (lengthBucket >= 0) {
      vector[26 + lengthBucket] += 1;
    }
  }

  // Feature 3: Common word indicators (semantic hints, 32 dimensions)
  const semanticTerms = [
    'love', 'career', 'health', 'money', 'family', 'future', 'past', 'present',
    'change', 'growth', 'challenge', 'opportunity', 'fear', 'hope', 'strength', 'wisdom',
    'journey', 'path', 'decision', 'choice', 'relationship', 'work', 'spiritual', 'emotional',
    'mental', 'physical', 'energy', 'balance', 'transformation', 'healing', 'guidance', 'insight'
  ];

  for (let i = 0; i < semanticTerms.length && i < 32; i++) {
    if (normalized.includes(semanticTerms[i])) {
      vector[36 + i] = 1;
    }
  }

  // Feature 4: Tarot-specific terms (60 dimensions)
  const tarotTerms = [
    'fool', 'magician', 'priestess', 'empress', 'emperor', 'hierophant', 'lovers', 'chariot',
    'strength', 'hermit', 'wheel', 'justice', 'hanged', 'death', 'temperance', 'devil',
    'tower', 'star', 'moon', 'sun', 'judgement', 'world', 'wands', 'cups',
    'swords', 'pentacles', 'ace', 'two', 'three', 'four', 'five', 'six',
    'seven', 'eight', 'nine', 'ten', 'page', 'knight', 'queen', 'king',
    'reversed', 'upright', 'spread', 'reading', 'card', 'position', 'meaning', 'interpretation',
    'archetype', 'symbol', 'element', 'fire', 'water', 'air', 'earth', 'major',
    'minor', 'arcana', 'triad', 'dyad'
  ];

  for (let i = 0; i < tarotTerms.length && i < 60; i++) {
    if (normalized.includes(tarotTerms[i])) {
      vector[68 + i] = 1;
    }
  }

  // Normalize the vector
  return normalizeVector(vector);
}

/**
 * Clear the embedding cache (useful for testing)
 */
export function clearEmbeddingCache() {
  embeddingCache.clear();
}

/**
 * Get cache statistics (useful for monitoring)
 *
 * @returns {Object} Cache stats
 */
export function getEmbeddingCacheStats() {
  return {
    size: embeddingCache.size,
    maxSize: MAX_CACHE_SIZE
  };
}
