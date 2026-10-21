/**
 * Account Data Export Endpoint
 * GET /api/account/export
 *
 * Exports profile, plan, analytics preferences and Journey history, cloud
 * journal entries, follow-up conversations, reader memories, and owned share
 * links with their notes. The browser adds device readings and preferences.
 *
 * Deliberately excluded: password material, session tokens, provider subject
 * ids, model embeddings, internal diagnostics, and moderation reports.
 */

import { getUserFromRequest } from '../../lib/auth.js';
import { isMachineCredential } from '../../lib/entitlements.js';
import { jsonResponse } from '../../lib/utils.js';

const EXPORT_VERSION = 1;

const JOURNAL_COLUMNS = [
  'id',
  'created_at',
  'updated_at',
  'spread_key',
  'spread_name',
  'question',
  'cards_json',
  'narrative',
  'themes_json',
  'reflections_json',
  'context',
  'provider',
  'session_seed',
  'user_preferences_json',
  'deck_id',
  'request_id',
  'extracted_steps',
  'extraction_version',
  'location_latitude',
  'location_longitude',
  'location_timezone',
  'location_consent',
  'idempotency_key',
  'source_usage_json',
  'extraction_model',
  'embedding_model'
].join(', ');

const MEMORY_COLUMNS = [
  'id',
  'text',
  'keywords',
  'category',
  'scope',
  'session_id',
  'source',
  'confidence',
  'created_at',
  'last_accessed_at',
  'expires_at'
].join(', ');

const FOLLOWUP_COLUMNS = [
  'id',
  'entry_id',
  'reading_request_id',
  'turn_number',
  'question',
  'answer',
  'journal_context_json',
  'created_at'
].join(', ');

/** JSON columns arrive as text; surface them as real JSON when they parse. */
function parseMaybeJson(value) {
  if (typeof value !== 'string') return value ?? null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed[0] !== '{' && trimmed[0] !== '[') return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

const JSON_JOURNAL_FIELDS = [
  'cards_json',
  'themes_json',
  'reflections_json',
  'user_preferences_json',
  'extracted_steps',
  'source_usage_json'
];

function shapeJournalEntry(row) {
  const entry = { ...row };
  JSON_JOURNAL_FIELDS.forEach((field) => {
    if (field in entry) {
      const parsed = parseMaybeJson(entry[field]);
      const cleanKey = field.replace(/_json$/, '');
      entry[cleanKey] = parsed;
      if (cleanKey !== field) delete entry[field];
    }
  });
  return entry;
}

function shapeMemory(row) {
  return {
    ...row,
    keywords: typeof row.keywords === 'string'
      ? row.keywords.split(',').map((word) => word.trim()).filter(Boolean)
      : (row.keywords ?? [])
  };
}

function shapeFollowUp(row) {
  const conversation = { ...row };
  if ('journal_context_json' in conversation) {
    conversation.journal_context = parseMaybeJson(conversation.journal_context_json);
    delete conversation.journal_context_json;
  }
  return conversation;
}

/** Strip credentials and provider-internal identifiers from the user row. */
function shapeAccount(row) {
  if (!row) return null;
  const {
    password_hash: _passwordHash,
    password_salt: _passwordSalt,
    stripe_customer_id: _stripeCustomerId,
    auth_subject: _authSubject,
    ...safe
  } = row;
  return safe;
}

export async function onRequestGet(context) {
  return createAccountExportHandler()(context);
}

const DEFAULT_DEPS = {
  getUserFromRequest,
  isMachineCredential,
  jsonResponse
};

/**
 * Factory with injectable dependencies, matching `createMemoriesHandlers`,
 * so the export contract can be tested without a live Worker.
 */
export function createAccountExportHandler(overrides = {}) {
  const deps = { ...DEFAULT_DEPS, ...overrides };

  return async function accountExportHandler(context) {
    const { request, env } = context;
    const requestId = crypto.randomUUID();

    try {
      const user = await deps.getUserFromRequest(request, env);
      if (!user) {
        return deps.jsonResponse({ error: 'Authentication required' }, { status: 401 });
      }
      if (deps.isMachineCredential(user)) {
        return deps.jsonResponse({ error: 'Session authentication required' }, { status: 401 });
      }

      const accountRow = await env.DB.prepare(
        'SELECT * FROM users WHERE id = ?'
      ).bind(user.id).first();

      const [journalResult, followUpResult, memoryResult, appearancesResult, badgesResult,
        patternsResult, sharesResult, shareEntriesResult, shareNotesResult] = await Promise.all([
        env.DB.prepare(
          `SELECT ${JOURNAL_COLUMNS} FROM journal_entries WHERE user_id = ? ORDER BY created_at ASC`
        ).bind(user.id).all(),
        env.DB.prepare(
          `SELECT ${FOLLOWUP_COLUMNS} FROM journal_followups WHERE user_id = ? ORDER BY created_at ASC`
        ).bind(user.id).all(),
        env.DB.prepare(
          `SELECT ${MEMORY_COLUMNS} FROM user_memories WHERE user_id = ? ORDER BY created_at ASC`
        ).bind(user.id).all(),
        env.DB.prepare(
          'SELECT id, card_name, card_number, year_month, count, first_seen, last_seen FROM card_appearances WHERE user_id = ? ORDER BY first_seen, id'
        ).bind(user.id).all(),
        env.DB.prepare(
          'SELECT id, badge_type, badge_key, card_name, earned_at, metadata_json FROM archetype_badges WHERE user_id = ? ORDER BY earned_at, id'
        ).bind(user.id).all(),
        env.DB.prepare(
          'SELECT id, pattern_type, pattern_id, entry_id, year_month, created_at FROM pattern_occurrences WHERE user_id = ? ORDER BY created_at, id'
        ).bind(user.id).all(),
        env.DB.prepare(
          'SELECT token, scope, title, created_at, expires_at, view_count, meta_json FROM share_tokens WHERE user_id = ? ORDER BY created_at, token'
        ).bind(user.id).all(),
        env.DB.prepare(
          `SELECT e.token, e.entry_id, e.sort_index FROM share_token_entries e
           JOIN share_tokens s ON s.token = e.token WHERE s.user_id = ? ORDER BY e.token, e.sort_index, e.entry_id`
        ).bind(user.id).all(),
        env.DB.prepare(
          `SELECT n.id, n.token, n.author_name, n.body, n.card_position, n.created_at FROM share_notes n
           JOIN share_tokens s ON s.token = n.token WHERE s.user_id = ? ORDER BY n.created_at, n.id`
        ).bind(user.id).all()
      ]);

      // Analytics preferences live in a table added after the first release.
      // A missing table must not block an otherwise complete export.
      let analyticsPreferences = null;
      try {
        const prefs = await env.DB.prepare(
          'SELECT archetype_journey_enabled, show_badges FROM user_analytics_prefs WHERE user_id = ?'
        ).bind(user.id).first();
        analyticsPreferences = prefs
          ? {
            archetypeJourneyEnabled: Boolean(prefs.archetype_journey_enabled),
            showBadges: Boolean(prefs.show_badges)
          }
          : null;
      } catch (prefsError) {
        console.warn(`[${requestId}] [account-export] analytics preferences unavailable:`, prefsError?.message);
      }

      const journalEntries = (journalResult.results || []).map(shapeJournalEntry);
      const followUps = (followUpResult.results || []).map(shapeFollowUp);
      const memories = (memoryResult.results || []).map(shapeMemory);

      const exportedAt = new Date().toISOString();
      const payload = {
        exportVersion: EXPORT_VERSION,
        exportedAt,
        account: shapeAccount(accountRow),
        analyticsPreferences,
        journal: {
          count: journalEntries.length,
          entries: journalEntries
        },
        followUpConversations: {
          count: followUps.length,
          conversations: followUps
        },
        readerMemories: {
          count: memories.length,
          memories
        },
        archetypeJourney: {
          cardAppearances: appearancesResult.results || [],
          badges: (badgesResult.results || []).map(({ metadata_json, ...badge }) => ({
            ...badge, metadata: parseMaybeJson(metadata_json)
          })),
          patternOccurrences: patternsResult.results || []
        },
        sharedJournals: {
          links: (sharesResult.results || []).map(({ meta_json, ...link }) => ({
            ...link, meta: parseMaybeJson(meta_json)
          })),
          entries: shareEntriesResult.results || [],
          notes: shareNotesResult.results || []
        }
      };

      return deps.jsonResponse(payload, {
        headers: {
          'content-disposition': `attachment; filename="tableu-export-${exportedAt.slice(0, 10)}.json"`,
          'cache-control': 'no-store'
        }
      });
    } catch (error) {
      console.error(`[${requestId}] [account-export] Export error:`, error);
      return deps.jsonResponse({ error: 'Unable to export account data' }, { status: 500 });
    }
  };
}
