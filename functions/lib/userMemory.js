/**
 * User Memory Library
 *
 * Persistent memory storage for follow-up chat personalization.
 * Enables the AI tarot reader to remember user preferences, recurring themes,
 * and communication styles across sessions.
 */

import { truncateText } from '../../shared/utils.js';

// Limits
const MAX_MEMORY_TEXT_LENGTH = 200;
const MAX_KEYWORDS = 5;
const MAX_KEYWORD_LENGTH = 30;
const MAX_MEMORIES_PER_USER = 100;
const DEFAULT_MEMORY_LIMIT = 10;

// Valid categories for tarot memory
const VALID_CATEGORIES = ['theme', 'card_affinity', 'communication', 'life_context', 'general'];

// PII patterns to reject
const PII_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/,              // SSN
  /\b(?:\d[ -]?){12,18}\d\b/,            // Credit card (allows spaces/hyphens)
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,  // Phone
];

// Instruction-like patterns to reject (prevent prompt injection via memory)
const INSTRUCTION_PATTERNS = [
  /\b(always|never|must|should)\s+(ignore|obey|follow|disregard)/i,
  /\b(system|developer|admin)\s+(instruction|prompt|rule)/i,
  /\boverride\b.*\b(instruction|rule|policy)/i,
  /\bignore\s+(previous|above|all|prior)/i,
  /\bdisregard\s+(previous|above|all|prior)/i,
  /\bforget\s+(everything|all|previous)/i,
  /\bnew\s+(instruction|rule|directive)/i,
  /\byou\s+are\s+(now|a|an)\b/i,
  /\bact\s+as\s+(if|a|an)\b/i,
  /\bpretend\s+(to|you)/i,
  /\brole[-\s]?play/i,
  /```/,  // Code blocks could contain injection
  /^\s*#/m,  // Markdown headers could structure-inject
  /^\s*\*\*/m,  // Bold formatting at line start
  /\[.*\]\(.*\)/,  // Markdown links
];

// Wrapper using shared truncateText (default behavior matches original)
function clampText(value, max = MAX_MEMORY_TEXT_LENGTH) {
  return truncateText(value, max);
}

/**
 * Sanitize memory text for safe prompt injection
 * - Collapses newlines to prevent structure breaking
 * - Escapes characters that could break markdown list format
 * - Normalizes whitespace
 */
function sanitizeMemoryTextForPrompt(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/[\r\n]+/g, ' ')           // Collapse newlines
    .replace(/\s+/g, ' ')               // Normalize whitespace
    .replace(/^[-*•]\s*/g, '')          // Strip leading list markers
    .replace(/[<>]/g, '')               // Strip angle brackets (prevent XML-like tags)
    .trim();
}

/**
 * Sanitize keywords array
 */
function sanitizeKeywords(keywords) {
  if (!Array.isArray(keywords)) return [];
  return keywords
    .filter(k => typeof k === 'string')
    .map(k => k.trim())
    .filter(k => k && !containsSensitiveContent(k))
    .map(k => k.toLowerCase().slice(0, MAX_KEYWORD_LENGTH))
    .slice(0, MAX_KEYWORDS);
}

/**
 * Check if text contains PII or instruction-like content
 */
function containsSensitiveContent(text) {
  if (!text) return false;
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  for (const pattern of INSTRUCTION_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  return false;
}

/**
 * Validate category
 */
function normalizeCategory(category) {
  if (typeof category !== 'string') return 'general';
  const lower = category.toLowerCase().trim();
  return VALID_CATEGORIES.includes(lower) ? lower : 'general';
}

/**
 * Save a memory note
 *
 * @param {D1Database} db
 * @param {string} userId
 * @param {Object} memory
 * @param {string} memory.text - Memory content (max 200 chars)
 * @param {string[]} [memory.keywords] - Keywords for retrieval
 * @param {string} [memory.category] - theme, card_affinity, communication, life_context, general
 * @param {string} [memory.scope] - 'global' or 'session'
 * @param {string} [memory.sessionId] - Reading request ID if session-scoped
 * @param {number} [memory.confidence] - AI confidence (0.0-1.0)
 * @param {string} [memory.source] - 'ai', 'user', or 'system'
 * @returns {Promise<{id: string, saved: boolean, reason?: string}>}
 */
export async function saveMemory(db, userId, memory) {
  if (!db || !userId) {
    return { id: null, saved: false, reason: 'missing_db_or_user' };
  }

  const text = clampText(memory?.text);
  if (!text) {
    return { id: null, saved: false, reason: 'empty_text' };
  }
  if (text.length < 3) {
    return { id: null, saved: false, reason: 'text_too_short' };
  }

  // Safety check: reject PII or instruction-like content
  if (containsSensitiveContent(text)) {
    return { id: null, saved: false, reason: 'sensitive_content' };
  }

  const keywords = sanitizeKeywords(memory?.keywords);
  const category = normalizeCategory(memory?.category);
  const scope = memory?.scope === 'session' ? 'session' : 'global';
  const sessionId = scope === 'session' ? (memory?.sessionId || null) : null;
  const confidence = typeof memory?.confidence === 'number'
    ? Math.max(0, Math.min(1, memory.confidence))
    : 1.0;
  const source = ['ai', 'user', 'system'].includes(memory?.source) ? memory.source : 'ai';

  const id = crypto.randomUUID();
  const nowSeconds = Math.floor(Date.now() / 1000);

  // For session memories, set expiry to 24 hours
  const expiresAt = scope === 'session' ? nowSeconds + (24 * 60 * 60) : null;

  try {
    // Enforce MAX_MEMORIES_PER_USER limit
    const countResult = await db.prepare(`
      SELECT COUNT(*) as cnt FROM user_memories WHERE user_id = ?
    `).bind(userId).first();
    const currentCount = countResult?.cnt || 0;

    if (currentCount >= MAX_MEMORIES_PER_USER) {
      // Attempt to prune old/low-confidence memories to make room
      const pruneResult = await pruneMemories(db, userId, { maxCount: MAX_MEMORIES_PER_USER - 1 });
      console.log(`[saveMemory] User at memory limit (${currentCount}), pruned ${pruneResult.deleted} memories`);

      // Re-check count after pruning
      const recount = await db.prepare(`
        SELECT COUNT(*) as cnt FROM user_memories WHERE user_id = ?
      `).bind(userId).first();

      if ((recount?.cnt || 0) >= MAX_MEMORIES_PER_USER) {
        console.warn(`[saveMemory] User still at limit after pruning, rejecting new memory`);
        return { id: null, saved: false, reason: 'limit_exceeded' };
      }
    }
    // Use INSERT OR IGNORE to handle the unique constraint on (user_id, text) for global scope
    // If duplicate, we'll return deduplicated: true
    const result = await db.prepare(`
      INSERT OR IGNORE INTO user_memories (
        id, user_id, text, keywords, category, scope, session_id,
        source, confidence, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      userId,
      text,
      keywords.length > 0 ? keywords.join(',') : null,
      category,
      scope,
      sessionId,
      source,
      confidence,
      nowSeconds,
      expiresAt
    ).run();

    // Check if row was actually inserted (changes > 0)
    const inserted = result?.meta?.changes > 0;

    if (!inserted && scope === 'global') {
      // Memory was deduplicated - update last_accessed_at on existing
      await db.prepare(`
        UPDATE user_memories
        SET last_accessed_at = ?, confidence = MAX(confidence, ?)
        WHERE user_id = ? AND text = ? AND scope = 'global'
      `).bind(nowSeconds, confidence, userId, text).run();

      return { id: null, saved: true, deduplicated: true };
    }

    return { id: inserted ? id : null, saved: inserted };
  } catch (error) {
    console.warn('[saveMemory] Error saving memory:', error?.message || error);
    return { id: null, saved: false, reason: 'db_error' };
  }
}

/**
 * Retrieve memories for prompt injection
 *
 * @param {D1Database} db
 * @param {string} userId
 * @param {Object} options
 * @param {string} [options.scope] - 'global', 'session', or 'all' (default: 'all')
 * @param {string[]} [options.categories] - Filter by categories
 * @param {number} [options.limit] - Max memories to return (default: 10)
 * @param {string} [options.sessionId] - Include session memories for this reading
 * @returns {Promise<Array<Memory>>}
 */
export async function getMemories(db, userId, options = {}) {
  if (!db || !userId) return [];

  const limit = Math.min(options.limit || DEFAULT_MEMORY_LIMIT, MAX_MEMORIES_PER_USER);
  const scope = options.scope || 'all';
  const sessionId = options.sessionId || null;
  const categories = Array.isArray(options.categories) ? options.categories : null;

  const nowSeconds = Math.floor(Date.now() / 1000);

  try {
    let query = `
      SELECT id, text, keywords, category, scope, session_id, source, confidence, created_at
      FROM user_memories
      WHERE user_id = ?
        AND (expires_at IS NULL OR expires_at > ?)
    `;
    const bindings = [userId, nowSeconds];

    // Scope filter - always add a filter to prevent leaking session memories
    if (scope === 'global') {
      query += ` AND scope = 'global'`;
    } else if (scope === 'session' && sessionId) {
      query += ` AND scope = 'session' AND session_id = ?`;
      bindings.push(sessionId);
    } else if (scope === 'all' && sessionId) {
      // Include global + session memories for this reading
      query += ` AND (scope = 'global' OR (scope = 'session' AND session_id = ?))`;
      bindings.push(sessionId);
    } else {
      // Default to global-only if scope is invalid or sessionId missing for session/all
      // This prevents leaking session memories from other sessions
      query += ` AND scope = 'global'`;
    }

    // Category filter
    if (categories && categories.length > 0) {
      const placeholders = categories.map(() => '?').join(', ');
      query += ` AND category IN (${placeholders})`;
      bindings.push(...categories);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    bindings.push(limit);

    const result = await db.prepare(query).bind(...bindings).all();

    // Update last_accessed_at for retrieved memories
    const memoryIds = (result?.results || []).map(r => r.id);
    if (memoryIds.length > 0) {
      const updatePlaceholders = memoryIds.map(() => '?').join(', ');
      await db.prepare(`
        UPDATE user_memories SET last_accessed_at = ? WHERE id IN (${updatePlaceholders})
      `).bind(nowSeconds, ...memoryIds).run();
    }

    return (result?.results || []).map(row => ({
      id: row.id,
      text: row.text,
      keywords: row.keywords ? row.keywords.split(',') : [],
      category: row.category,
      scope: row.scope,
      sessionId: row.session_id,
      source: row.source || 'ai',
      confidence: row.confidence,
      createdAt: row.created_at ? row.created_at * 1000 : null,
    }));
  } catch (error) {
    console.warn('[getMemories] Error fetching memories:', error?.message || error);
    return [];
  }
}

/**
 * Consolidate session memories into global scope
 *
 * @param {D1Database} db
 * @param {string} userId
 * @param {string} sessionId - Reading request ID
 * @returns {Promise<{promoted: number, pruned: number}>}
 */
export async function consolidateSessionMemories(db, userId, sessionId) {
  if (!db || !userId || !sessionId) {
    return { promoted: 0, pruned: 0 };
  }

  try {
    // Get session memories for this reading
    const sessionMemories = await db.prepare(`
      SELECT id, text, keywords, category, confidence
      FROM user_memories
      WHERE user_id = ? AND scope = 'session' AND session_id = ?
    `).bind(userId, sessionId).all();

    const memories = sessionMemories?.results || [];
    if (memories.length === 0) {
      return { promoted: 0, pruned: 0 };
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    let promoted = 0;

    for (const mem of memories) {
      // Check if similar global memory exists
      const existing = await db.prepare(`
        SELECT id, confidence FROM user_memories
        WHERE user_id = ? AND scope = 'global' AND text = ?
      `).bind(userId, mem.text).first();

      if (existing) {
        // Update existing memory's confidence and access time
        await db.prepare(`
          UPDATE user_memories
          SET confidence = MAX(confidence, ?), last_accessed_at = ?
          WHERE id = ?
        `).bind(mem.confidence, nowSeconds, existing.id).run();
      } else {
        // Promote to global scope
        await db.prepare(`
          UPDATE user_memories
          SET scope = 'global', session_id = NULL, expires_at = NULL, created_at = ?
          WHERE id = ?
        `).bind(nowSeconds, mem.id).run();
        promoted++;
      }
    }

    // Delete remaining session memories that were merged into existing
    const { meta } = await db.prepare(`
      DELETE FROM user_memories
      WHERE user_id = ? AND scope = 'session' AND session_id = ?
    `).bind(userId, sessionId).run();

    return { promoted, pruned: (meta?.changes || 0) };
  } catch (error) {
    console.warn('[consolidateSessionMemories] Error:', error?.message || error);
    return { promoted: 0, pruned: 0 };
  }
}

/**
 * Prune old or low-confidence memories
 *
 * @param {D1Database} db
 * @param {string} userId
 * @param {Object} options
 * @param {number} [options.maxAgeDays] - Delete memories older than this (default: 365)
 * @param {number} [options.minConfidence] - Delete memories below this confidence (default: 0.3)
 * @param {number} [options.maxCount] - Keep only this many memories (default: 100)
 * @returns {Promise<{deleted: number}>}
 */
export async function pruneMemories(db, userId, options = {}) {
  if (!db || !userId) return { deleted: 0 };

  const maxAgeDays = options.maxAgeDays ?? 365;
  const minConfidence = options.minConfidence ?? 0.3;
  const maxCount = options.maxCount ?? MAX_MEMORIES_PER_USER;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const cutoffSeconds = nowSeconds - (maxAgeDays * 24 * 60 * 60);

  let totalDeleted = 0;

  try {
    // Delete expired session memories
    const expired = await db.prepare(`
      DELETE FROM user_memories
      WHERE user_id = ? AND expires_at IS NOT NULL AND expires_at < ?
    `).bind(userId, nowSeconds).run();
    totalDeleted += expired?.meta?.changes || 0;

    // Delete old memories
    const old = await db.prepare(`
      DELETE FROM user_memories
      WHERE user_id = ? AND scope = 'global' AND created_at < ?
    `).bind(userId, cutoffSeconds).run();
    totalDeleted += old?.meta?.changes || 0;

    // Delete low-confidence memories (but keep at least some)
    const lowConf = await db.prepare(`
      DELETE FROM user_memories
      WHERE user_id = ? AND scope = 'global' AND confidence < ?
        AND (SELECT COUNT(*) FROM user_memories WHERE user_id = ?) > 10
    `).bind(userId, minConfidence, userId).run();
    totalDeleted += lowConf?.meta?.changes || 0;

    // Trim to max count (keep most recent)
    const count = await db.prepare(`
      SELECT COUNT(*) as cnt FROM user_memories WHERE user_id = ?
    `).bind(userId).first();

    if (count?.cnt > maxCount) {
      const excess = count.cnt - maxCount;
      const oldest = await db.prepare(`
        DELETE FROM user_memories
        WHERE id IN (
          SELECT id FROM user_memories
          WHERE user_id = ?
          ORDER BY created_at ASC
          LIMIT ?
        )
      `).bind(userId, excess).run();
      totalDeleted += oldest?.meta?.changes || 0;
    }

    return { deleted: totalDeleted };
  } catch (error) {
    console.warn('[pruneMemories] Error:', error?.message || error);
    return { deleted: 0 };
  }
}

/**
 * Delete a specific memory
 *
 * @param {D1Database} db
 * @param {string} userId
 * @param {string} memoryId
 * @returns {Promise<{deleted: boolean}>}
 */
export async function deleteMemory(db, userId, memoryId) {
  if (!db || !userId || !memoryId) return { deleted: false };

  try {
    const result = await db.prepare(`
      DELETE FROM user_memories WHERE id = ? AND user_id = ?
    `).bind(memoryId, userId).run();

    return { deleted: (result?.meta?.changes || 0) > 0 };
  } catch (error) {
    console.warn('[deleteMemory] Error:', error?.message || error);
    return { deleted: false };
  }
}

/**
 * Delete all memories for a user
 *
 * @param {D1Database} db
 * @param {string} userId
 * @returns {Promise<{deleted: number}>}
 */
export async function clearAllMemories(db, userId) {
  if (!db || !userId) return { deleted: 0 };

  try {
    const result = await db.prepare(`
      DELETE FROM user_memories WHERE user_id = ?
    `).bind(userId).run();

    return { deleted: result?.meta?.changes || 0 };
  } catch (error) {
    console.warn('[clearAllMemories] Error:', error?.message || error);
    return { deleted: 0 };
  }
}

/**
 * Format memories for prompt injection
 *
 * @param {Array<Memory>} memories
 * @returns {string} Markdown-formatted memory section
 */
export function formatMemoriesForPrompt(memories) {
  if (!Array.isArray(memories) || memories.length === 0) {
    return '';
  }

  // Group by category
  const byCategory = {};
  for (const mem of memories) {
    const cat = mem.category || 'general';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(mem);
  }

  const categoryLabels = {
    theme: 'Recurring Themes',
    card_affinity: 'Card Affinities',
    communication: 'Communication Style',
    life_context: 'Life Context',
    general: 'Other Insights',
  };

  const lines = [];

  for (const [category, items] of Object.entries(byCategory)) {
    const label = categoryLabels[category] || 'Other';
    lines.push(`**${label}:**`);
    for (const item of items) {
      // Sanitize to prevent prompt injection via memory content
      const safeText = sanitizeMemoryTextForPrompt(item.text);
      if (safeText) {
        lines.push(`- ${safeText}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

// Export constants for testing
export const MEMORY_CONSTANTS = {
  MAX_MEMORY_TEXT_LENGTH,
  MAX_KEYWORDS,
  MAX_KEYWORD_LENGTH,
  MAX_MEMORIES_PER_USER,
  VALID_CATEGORIES,
};
