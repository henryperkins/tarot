// functions/lib/embeddings.js
// Embeddings utility for GraphRAG quality filtering
//
// Provides text embedding via Azure OpenAI and cosine similarity calculation.
// Used by graphRAG.js for semantic scoring of passage relevance.

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
 * Get embedding for text using Azure OpenAI embeddings API.
 * Falls back to a simple hash-based pseudo-embedding if API is unavailable.
 *
 * @param {string} text - Text to embed
 * @param {Object} [options] - Options
 * @param {Object} [options.env] - Environment variables (for Cloudflare Workers)
 * @returns {Promise<number[]>} Embedding vector
 */
export async function embedText(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return generateFallbackEmbedding('');
  }

  const trimmed = text.trim().slice(0, 8000); // Limit input length
  if (!trimmed) {
    return generateFallbackEmbedding('');
  }

  // Check cache first
  const cacheKey = trimmed.slice(0, 200); // Use prefix as cache key
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey);
  }

  // Try Azure OpenAI embeddings
  const env = options.env || (typeof process !== 'undefined' && process.env ? process.env : {});
  const embedding = await fetchAzureEmbedding(trimmed, env);

  if (embedding) {
    // Cache the result
    if (embeddingCache.size >= MAX_CACHE_SIZE) {
      // Remove oldest entry (first key)
      const firstKey = embeddingCache.keys().next().value;
      embeddingCache.delete(firstKey);
    }
    embeddingCache.set(cacheKey, embedding);
    return embedding;
  }

  // Fallback to hash-based pseudo-embedding
  return generateFallbackEmbedding(trimmed);
}

/**
 * Fetch embedding from Azure OpenAI embeddings API.
 *
 * Uses the v1 API format for consistency with the Responses API.
 * See: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/embeddings
 *
 * @param {string} text - Text to embed
 * @param {Object} env - Environment variables
 * @returns {Promise<number[]|null>} Embedding vector or null if unavailable
 */
async function fetchAzureEmbedding(text, env) {
  const endpoint = env?.AZURE_OPENAI_ENDPOINT;
  const apiKey = env?.AZURE_OPENAI_API_KEY;
  const embeddingModel = env?.AZURE_OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large';
  // Azure OpenAI v1 embeddings path requires api-version=preview (literal string)
  // This is different from deployment-based paths which use date-based versions
  const apiVersion = env?.AZURE_OPENAI_EMBEDDINGS_API_VERSION || 'preview';

  if (!endpoint || !apiKey) {
    return null;
  }

  try {
    // Normalize endpoint: strip trailing slashes and any existing /openai/v1 path
    const normalizedEndpoint = endpoint
      .replace(/\/+$/, '')
      .replace(/\/openai\/v1\/?$/, '')
      .replace(/\/openai\/?$/, '');

    // V1 embeddings path with api-version=preview (required for this path)
    const url = `${normalizedEndpoint}/openai/v1/embeddings?api-version=${encodeURIComponent(apiVersion)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        input: text,
        model: embeddingModel
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn(`[Embeddings] Azure v1 API error ${response.status}: ${errText}`);
      return null;
    }

    const data = await response.json();
    const embedding = data?.data?.[0]?.embedding;

    if (Array.isArray(embedding) && embedding.length > 0) {
      return normalizeVector(embedding);
    }

    return null;
  } catch (err) {
    console.warn('[Embeddings] Azure embedding fetch failed:', err.message);
    return null;
  }
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
