/**
 * Journal Search Utilities
 * 
 * Semantic search utilities for journal entries.
 * Enables pattern recognition across a user's reading history.
 */

import { generateEmbeddings } from './coachSuggestion.js';

const DEFAULT_SEARCH_LIMIT = 3;
const DEFAULT_MIN_SIMILARITY = 0.65;
const DEFAULT_CARD_HISTORY_LIMIT = 30;

/**
 * Find journal entries semantically similar to a query
 * 
 * @param {Object} env - Worker environment with AI and DB bindings
 * @param {string} userId - User ID to search for
 * @param {string} query - Search query text
 * @param {Object} options - Search options
 * @param {number} options.limit - Max entries to return (default: 3)
 * @param {number} options.minSimilarity - Min cosine similarity threshold (default: 0.65)
 * @param {string} options.requestId - Request ID for logging
 * @returns {Promise<Array>} Similar journal entries with similarity scores
 */
export async function findSimilarJournalEntries(env, userId, query, options = {}) {
  const { 
    limit = DEFAULT_SEARCH_LIMIT, 
    minSimilarity = DEFAULT_MIN_SIMILARITY,
    requestId = 'journal-search'
  } = options;
  
  if (!env?.AI || !env?.DB) {
    console.log(`[${requestId}] [journalSearch] Missing AI or DB binding`);
    return [];
  }
  
  if (!userId || !query || typeof query !== 'string' || query.trim().length < 3) {
    console.log(`[${requestId}] [journalSearch] Invalid userId or query`);
    return [];
  }
  
  const startTime = Date.now();
  
  try {
    // Generate embedding for the query
    const embeddings = await generateEmbeddings(env, [query.trim()], requestId);
    
    if (!embeddings || embeddings.length === 0 || !embeddings[0]) {
      console.log(`[${requestId}] [journalSearch] Failed to generate query embedding`);
      return [];
    }
    
    const queryEmbedding = embeddings[0];
    
    // Fetch recent entries with embeddings
    const entries = await env.DB.prepare(`
      SELECT 
        id, question, narrative, extracted_steps, step_embeddings, 
        cards_json, spread_key, context, created_at
      FROM journal_entries 
      WHERE user_id = ? AND step_embeddings IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 50
    `).bind(userId).all();
    
    if (!entries?.results?.length) {
      console.log(`[${requestId}] [journalSearch] No entries with embeddings found`);
      return [];
    }
    
    // Score each entry by semantic similarity
    const scored = entries.results
      .map(entry => {
        try {
          const stepEmbeddings = safeJsonParse(entry.step_embeddings, []);
          if (!Array.isArray(stepEmbeddings) || stepEmbeddings.length === 0) {
            return null;
          }
          
          // Find max similarity across all step embeddings
          const maxSim = Math.max(
            ...stepEmbeddings.map(emb => cosineSimilarity(queryEmbedding, emb))
          );
          
          // Also check similarity against question if available
          // (This is a lightweight heuristic - we don't have question embeddings pre-computed)
          
          return {
            id: entry.id,
            question: entry.question,
            narrative: entry.narrative?.slice(0, 300),
            extractedSteps: safeJsonParse(entry.extracted_steps, []),
            cards: safeJsonParse(entry.cards_json, []).map(c => c.name || c.card),
            spreadKey: entry.spread_key,
            context: entry.context,
            created_at: entry.created_at,
            similarity: maxSim
          };
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean)
      .filter(e => e.similarity >= minSimilarity);
    
    // Sort by similarity and return top results
    const results = scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
    
    const latencyMs = Date.now() - startTime;
    console.log(`[${requestId}] [journalSearch] Found ${results.length}/${entries.results.length} similar entries in ${latencyMs}ms`);
    
    return results;
    
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error(`[${requestId}] [journalSearch] Error after ${latencyMs}ms: ${error.message}`);
    return [];
  }
}

/**
 * Get recurring card patterns for specific cards
 * 
 * @param {Object} db - D1 database binding
 * @param {string} userId - User ID
 * @param {string[]} cardNames - Array of card names to check
 * @param {Object} options - Options
 * @param {number} options.limit - Max entries to scan (default: 30)
 * @returns {Promise<Array>} Card patterns with counts and contexts
 */
export async function getRecurringCardPatterns(db, userId, cardNames, options = {}) {
  const { limit = DEFAULT_CARD_HISTORY_LIMIT } = options;
  
  if (!db || !userId || !cardNames?.length) {
    return [];
  }
  
  try {
    // Query recent entries for card frequency
    const entries = await db.prepare(`
      SELECT cards_json, context, created_at
      FROM journal_entries
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(userId, limit).all();
    
    if (!entries?.results?.length) {
      return [];
    }
    
    const cardStats = new Map();
    
    entries.results.forEach(entry => {
      try {
        const cards = safeJsonParse(entry.cards_json, []);
        cards.forEach(card => {
          const name = normalizeCardName(card.name || card.card);
          if (!name) return;
          
          if (!cardStats.has(name)) {
            cardStats.set(name, { count: 0, contexts: [], dates: [] });
          }
          
          const stats = cardStats.get(name);
          stats.count++;
          if (entry.context && !stats.contexts.includes(entry.context)) {
            stats.contexts.push(entry.context);
          }
          stats.dates.push(entry.created_at);
        });
      } catch (e) {
        // Skip malformed entries
      }
    });
    
    // Normalize input card names for matching
    const normalizedInputCards = cardNames.map(normalizeCardName).filter(Boolean);
    
    // Return patterns for requested cards that appear 2+ times
    const patterns = normalizedInputCards
      .filter(name => cardStats.has(name) && cardStats.get(name).count >= 2)
      .map(name => {
        const stats = cardStats.get(name);
        return {
          card: name,
          count: stats.count,
          contexts: stats.contexts,
          lastSeen: Math.max(...stats.dates)
        };
      })
      .sort((a, b) => b.count - a.count);
    
    return patterns;
    
  } catch (error) {
    console.warn(`[getRecurringCardPatterns] Error: ${error.message}`);
    return [];
  }
}

/**
 * Get overall card frequency for a user
 * 
 * @param {Object} db - D1 database binding
 * @param {string} userId - User ID
 * @param {Object} options - Options
 * @param {number} options.limit - Max entries to scan (default: 30)
 * @param {number} options.topN - Top N cards to return (default: 10)
 * @returns {Promise<Array>} Top recurring cards with counts
 */
export async function getTopRecurringCards(db, userId, options = {}) {
  const { limit = DEFAULT_CARD_HISTORY_LIMIT, topN = 10 } = options;
  
  if (!db || !userId) {
    return [];
  }
  
  try {
    const entries = await db.prepare(`
      SELECT cards_json, context, created_at
      FROM journal_entries
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(userId, limit).all();
    
    if (!entries?.results?.length) {
      return [];
    }
    
    const cardStats = new Map();
    
    entries.results.forEach(entry => {
      try {
        const cards = safeJsonParse(entry.cards_json, []);
        cards.forEach(card => {
          const name = normalizeCardName(card.name || card.card);
          if (!name) return;
          
          if (!cardStats.has(name)) {
            cardStats.set(name, { count: 0, contexts: new Set() });
          }
          
          const stats = cardStats.get(name);
          stats.count++;
          if (entry.context) {
            stats.contexts.add(entry.context);
          }
        });
      } catch (e) {
        // Skip malformed entries
      }
    });
    
    // Convert to array and sort by frequency
    const sorted = Array.from(cardStats.entries())
      .map(([card, stats]) => ({
        card,
        count: stats.count,
        contexts: Array.from(stats.contexts)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, topN);
    
    return sorted;
    
  } catch (error) {
    console.warn(`[getTopRecurringCards] Error: ${error.message}`);
    return [];
  }
}

/**
 * Compute cosine similarity between two vectors
 * 
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number} Cosine similarity (0 to 1)
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || !Array.isArray(a) || !Array.isArray(b)) return 0;
  if (a.length !== b.length) return 0;
  
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude === 0 ? 0 : dot / magnitude;
}

/**
 * Normalize card name for consistent matching
 * Handles variations like "The Tower" vs "Tower", "Queen of Cups" vs "queen of cups"
 */
function normalizeCardName(name) {
  if (!name || typeof name !== 'string') return '';
  
  return name
    .trim()
    .toLowerCase()
    // Normalize spacing
    .replace(/\s+/g, ' ')
    // Standardize "the" prefix
    .replace(/^the\s+/i, '')
    // Standardize reversed notation
    .replace(/\s*\(reversed?\)$/i, '')
    .replace(/\s*reversed$/i, '')
    // Title case for comparison
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Safely parse JSON with fallback
 */
function safeJsonParse(str, fallback) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export default {
  findSimilarJournalEntries,
  getRecurringCardPatterns,
  getTopRecurringCards,
  cosineSimilarity
};
