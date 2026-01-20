/**
 * User Memories API Endpoint
 *
 * GET    /api/memories       - List user's memories
 * POST   /api/memories       - Create a new memory (manual)
 * DELETE /api/memories/:id   - Delete a specific memory
 * DELETE /api/memories       - Clear all memories
 */

import { validateSession, getSessionFromCookie } from '../lib/auth.js';
import { jsonResponse, readJsonBody } from '../lib/utils.js';
import {
  getMemories,
  saveMemory,
  deleteMemory,
  clearAllMemories,
  MEMORY_CONSTANTS
} from '../lib/userMemory.js';

const DEFAULT_DEPS = {
  validateSession,
  getSessionFromCookie,
  jsonResponse,
  readJsonBody,
  getMemories,
  saveMemory,
  deleteMemory,
  clearAllMemories,
  MEMORY_CONSTANTS
};

export function createMemoriesHandlers(overrides = {}) {
  const deps = { ...DEFAULT_DEPS, ...overrides };

  /**
   * GET /api/memories
   * List user's memories with optional filtering
   *
   * Query params:
   * - scope: 'global' | 'all' (default: 'global')
   *          Note: 'session' scope is only used internally by follow-up API
   * - category: filter by category
   * - limit: max memories to return (default: 50)
   */
  const onRequestGet = async ({ request, env }) => {
    const requestId = crypto.randomUUID();
    try {
      // Auth check
      const cookieHeader = request.headers.get('Cookie');
      const token = deps.getSessionFromCookie(cookieHeader);
      const user = await deps.validateSession(env.DB, token);

      if (!user) {
        return deps.jsonResponse({ error: 'Not authenticated' }, { status: 401 });
      }

      const url = new URL(request.url);
      const rawScope = url.searchParams.get('scope') || 'global';
      const category = url.searchParams.get('category');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);

      // Only allow 'global' or 'all' via API; coerce any other value to 'global'
      // 'session' requires internal sessionId, unknown scopes default to safe option
      const validScopes = ['global', 'all'];
      const scope = validScopes.includes(rawScope) ? rawScope : 'global';

      const options = {
        scope,
        limit
      };

      if (category && deps.MEMORY_CONSTANTS.VALID_CATEGORIES.includes(category)) {
        options.categories = [category];
      }

      const memories = await deps.getMemories(env.DB, user.id, options);

      return deps.jsonResponse({
        memories,
        count: memories.length,
        categories: deps.MEMORY_CONSTANTS.VALID_CATEGORIES
      });
    } catch (error) {
      console.error(`[${requestId}] [memories] GET error:`, error.message);
      return deps.jsonResponse({ error: 'Failed to fetch memories' }, { status: 500 });
    }
  };

  /**
   * POST /api/memories
   * Create a new memory (user-initiated)
   *
   * Body:
   * - text: string (required, max 200 chars)
   * - keywords: string[] (optional, max 5)
   * - category: string (required)
   */
  const onRequestPost = async ({ request, env }) => {
    const requestId = crypto.randomUUID();
    try {
      // Auth check
      const cookieHeader = request.headers.get('Cookie');
      const token = deps.getSessionFromCookie(cookieHeader);
      const user = await deps.validateSession(env.DB, token);

      if (!user) {
        return deps.jsonResponse({ error: 'Not authenticated' }, { status: 401 });
      }

      const body = await deps.readJsonBody(request);
      const { text, keywords, category } = body;

      // Validate required fields
      if (!text || typeof text !== 'string' || text.trim().length < 3) {
        return deps.jsonResponse({ error: 'Memory text is required (min 3 characters)' }, { status: 400 });
      }

      if (!category || !deps.MEMORY_CONSTANTS.VALID_CATEGORIES.includes(category)) {
        return deps.jsonResponse({
          error: `Invalid category. Must be one of: ${deps.MEMORY_CONSTANTS.VALID_CATEGORIES.join(', ')}`
        }, { status: 400 });
      }

      const result = await deps.saveMemory(env.DB, user.id, {
        text,
        keywords: keywords || [],
        category,
        scope: 'global',
        source: 'user',
        confidence: 1.0
      });

      if (!result.saved) {
        const errorMessages = {
          empty_text: 'Memory text is required',
          text_too_short: 'Memory text is required (min 3 characters)',
          sensitive_content: 'Memory contains sensitive content that cannot be stored',
          db_error: 'Failed to save memory'
        };
        return deps.jsonResponse({
          error: errorMessages[result.reason] || 'Failed to save memory'
        }, { status: 400 });
      }

      return deps.jsonResponse({
        success: true,
        id: result.id,
        deduplicated: result.deduplicated || false
      }, { status: 201 });
    } catch (error) {
      console.error(`[${requestId}] [memories] POST error:`, error.message);
      return deps.jsonResponse({ error: 'Failed to create memory' }, { status: 500 });
    }
  };

  /**
   * DELETE /api/memories
   * Delete a specific memory or clear all memories
   *
   * Query params:
   * - id: specific memory ID to delete
   * - all: 'true' to clear all memories (requires confirmation)
   */
  const onRequestDelete = async ({ request, env }) => {
    const requestId = crypto.randomUUID();
    try {
      // Auth check
      const cookieHeader = request.headers.get('Cookie');
      const token = deps.getSessionFromCookie(cookieHeader);
      const user = await deps.validateSession(env.DB, token);

      if (!user) {
        return deps.jsonResponse({ error: 'Not authenticated' }, { status: 401 });
      }

      const url = new URL(request.url);
      const memoryId = url.searchParams.get('id');
      const clearAll = url.searchParams.get('all') === 'true';

      if (clearAll) {
        // Clear all memories for user
        const result = await deps.clearAllMemories(env.DB, user.id);
        return deps.jsonResponse({
          success: true,
          deleted: result.deleted
        });
      }

      if (!memoryId) {
        return deps.jsonResponse({ error: 'Memory ID is required' }, { status: 400 });
      }

      const result = await deps.deleteMemory(env.DB, user.id, memoryId);

      if (!result.deleted) {
        return deps.jsonResponse({ error: 'Memory not found' }, { status: 404 });
      }

      return deps.jsonResponse({
        success: true,
        deleted: true
      });
    } catch (error) {
      console.error(`[${requestId}] [memories] DELETE error:`, error.message);
      return deps.jsonResponse({ error: 'Failed to delete memory' }, { status: 500 });
    }
  };

  return { onRequestGet, onRequestPost, onRequestDelete };
}

export const { onRequestGet, onRequestPost, onRequestDelete } = createMemoriesHandlers();
