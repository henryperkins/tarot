import { timingSafeEqual } from './crypto.js';
import { runQualityAnalysis } from './qualityAnalysis.js';
import { dispatchAlerts } from './qualityAlerts.js';

/**
 * Scheduled Tasks Handler
 *
 * Handles cron-triggered tasks for the Mystic Tarot application:
 * - Archive metrics from METRICS_DB KV to D1
 * - Archive feedback from FEEDBACK_KV to D1
 * - Clean up expired sessions from D1
 *
 * Cron schedule (configured in wrangler.jsonc):
 * - Daily at 3 AM UTC for archival
 * - Weekly for session cleanup
 */

const ARCHIVE_BATCH_SIZE = 100;
const METRICS_PREFIX = 'reading:';
const FEEDBACK_PREFIX = 'feedback:';

/**
 * Archive KV data to D1 database with full pagination support
 * @param {KVNamespace} kv - Source KV namespace
 * @param {D1Database} db - Destination D1 database
 * @param {string} prefix - KV key prefix to archive
 * @param {string} archiveType - Type identifier ('metrics' or 'feedback')
 * @returns {Promise<{archived: number, deleted: number, errors: number, batches: number}>}
 */
async function archiveKVToD1(kv, db, prefix, archiveType) {
  const stats = { archived: 0, deleted: 0, errors: 0, batches: 0 };

  if (!kv || !db) {
    console.warn(`Skipping ${archiveType} archival: missing KV or DB binding`);
    return stats;
  }

  const now = Date.now();

  try {
    let cursor = null;
    let totalKeys = 0;

    // Paginate through all keys
    do {
      const listOptions = { prefix, limit: ARCHIVE_BATCH_SIZE };
      if (cursor) {
        listOptions.cursor = cursor;
      }

      const listResult = await kv.list(listOptions);
      const keys = listResult.keys || [];
      cursor = listResult.list_complete ? null : listResult.cursor;

      if (keys.length === 0) {
        if (stats.batches === 0) {
          console.log(`No ${archiveType} keys to archive`);
        }
        break;
      }

      totalKeys += keys.length;
      stats.batches++;
      console.log(`Processing batch ${stats.batches}: ${keys.length} ${archiveType} keys`);

      // Collect records for this batch
      const keysToDelete = [];

      for (const key of keys) {
        try {
          const value = await kv.get(key.name, 'json');
          if (value) {
            // Extract ID from key (e.g., "reading:abc123" -> "abc123")
            const id = key.name.replace(prefix, '');

            if (archiveType === 'metrics') {
              // Insert into metrics_archive
              await db.prepare(`
                INSERT OR REPLACE INTO metrics_archive
                (request_id, kv_key, provider, spread_key, deck_style, data, archived_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `).bind(
                id,
                key.name,
                value.provider || null,
                value.spreadKey || null,
                value.deckStyle || null,
                JSON.stringify(value),
                now
              ).run();
            } else {
              // Insert into feedback_archive
              await db.prepare(`
                INSERT OR REPLACE INTO feedback_archive
                (feedback_id, request_id, data, archived_at)
                VALUES (?, ?, ?, ?)
              `).bind(
                id,
                value.requestId || null,
                JSON.stringify(value),
                now
              ).run();
            }

            keysToDelete.push(key.name);
            stats.archived++;
          }
        } catch (err) {
          console.error(`Failed to archive ${key.name}:`, err.message);
          stats.errors++;
        }
      }

      console.log(`Archived ${keysToDelete.length} ${archiveType} records to D1`);

      // Delete archived keys from KV
      for (const keyName of keysToDelete) {
        try {
          await kv.delete(keyName);
          stats.deleted++;
        } catch (err) {
          console.error(`Failed to delete ${keyName}:`, err.message);
          stats.errors++;
        }
      }
    } while (cursor);

    if (totalKeys > 0) {
      console.log(`Completed ${archiveType} archival: ${stats.archived} archived, ${stats.deleted} deleted across ${stats.batches} batch(es)`);
    }

  } catch (error) {
    console.error(`${archiveType} archival failed:`, error);
    stats.errors++;
  }

  return stats;
}

/**
 * Clean up old webhook events from D1
 * Stripe retries for up to 3 days, so we keep 7 days for safety buffer
 * @param {D1Database} db - D1 database binding
 * @returns {Promise<number>} Number of events deleted
 */
async function cleanupOldWebhookEvents(db) {
  if (!db) {
    console.warn('Skipping webhook event cleanup: missing DB binding');
    return 0;
  }

  try {
    // Delete events older than 7 days
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    const result = await db
      .prepare('DELETE FROM processed_webhook_events WHERE processed_at < ?')
      .bind(sevenDaysAgo)
      .run();

    const deleted = result.meta?.changes || 0;
    if (deleted > 0) {
      console.log(`Cleaned up ${deleted} old webhook events`);
    }
    return deleted;
  } catch (error) {
    // Table might not exist yet if migration hasn't run
    if (error.message?.includes('no such table')) {
      console.log('Webhook events table not yet created, skipping cleanup');
      return 0;
    }
    console.error('Webhook event cleanup failed:', error);
    return 0;
  }
}

/**
 * Clean up expired and stale memories from D1
 * Runs globally to prune memories for all users
 * @param {D1Database} db - D1 database binding
 * @returns {Promise<{deleted: number, usersProcessed: number}>}
 */
async function cleanupStaleMemories(db) {
  if (!db) {
    console.warn('Skipping memory cleanup: missing DB binding');
    return { deleted: 0, usersProcessed: 0 };
  }

  try {
    const nowSeconds = Math.floor(Date.now() / 1000);
    let totalDeleted = 0;

    // 1. Delete expired session memories (TTL passed)
    const expiredResult = await db.prepare(`
      DELETE FROM user_memories
      WHERE expires_at IS NOT NULL AND expires_at < ?
    `).bind(nowSeconds).run();
    totalDeleted += expiredResult?.meta?.changes || 0;

    // 2. Delete very old memories (> 1 year)
    const oneYearAgo = nowSeconds - (365 * 24 * 60 * 60);
    const oldResult = await db.prepare(`
      DELETE FROM user_memories
      WHERE scope = 'global' AND created_at < ?
    `).bind(oneYearAgo).run();
    totalDeleted += oldResult?.meta?.changes || 0;

    // 3. Delete orphaned session memories (session ended > 7 days ago)
    const sevenDaysAgo = nowSeconds - (7 * 24 * 60 * 60);
    const orphanedResult = await db.prepare(`
      DELETE FROM user_memories
      WHERE scope = 'session' AND created_at < ?
    `).bind(sevenDaysAgo).run();
    totalDeleted += orphanedResult?.meta?.changes || 0;

    // 4. Trim users with too many memories (keep max 100 per user)
    let usersWithTooMany = { results: [] };
    try {
      const stmt = db.prepare(`
        SELECT user_id, COUNT(*) as cnt FROM user_memories
        GROUP BY user_id HAVING cnt > 100
      `);
      // D1 returns { results: [...] } from .all()
      usersWithTooMany = await stmt.all();
    } catch (allErr) {
      console.warn('Memory trim query failed:', allErr?.message || allErr);
    }

    let usersProcessed = 0;
    for (const row of (usersWithTooMany?.results || [])) {
      const excess = row.cnt - 100;
      const trimResult = await db.prepare(`
        DELETE FROM user_memories
        WHERE id IN (
          SELECT id FROM user_memories
          WHERE user_id = ?
          ORDER BY created_at ASC
          LIMIT ?
        )
      `).bind(row.user_id, excess).run();
      totalDeleted += trimResult?.meta?.changes || 0;
      usersProcessed++;
    }

    if (totalDeleted > 0) {
      console.log(`Cleaned up ${totalDeleted} stale memories (${usersProcessed} users trimmed)`);
    }

    return { deleted: totalDeleted, usersProcessed };
  } catch (error) {
    // Table might not exist yet
    if (error.message?.includes('no such table')) {
      console.log('User memories table not yet created, skipping cleanup');
      return { deleted: 0, usersProcessed: 0 };
    }
    console.error('Memory cleanup failed:', error);
    return { deleted: 0, usersProcessed: 0 };
  }
}

/**
 * Clean up old guest usage tracking rows from D1
 *
 * Guest usage rows are identified by user_id starting with 'guest:'.
 * These are hashed IP identifiers used for anonymous rate limiting.
 * We prune rows older than 90 days to limit PII retention.
 *
 * @param {D1Database} db - D1 database binding
 * @returns {Promise<number>} Number of rows deleted
 */
async function cleanupOldGuestUsage(db) {
  if (!db) {
    console.warn('Skipping guest usage cleanup: missing DB binding');
    return 0;
  }

  try {
    // Delete guest usage rows older than 90 days
    // This balances rate limiting effectiveness with privacy
    const ninetyDaysAgoMs = Date.now() - (90 * 24 * 60 * 60 * 1000);

    const result = await db
      .prepare(`
        DELETE FROM usage_tracking
        WHERE user_id LIKE 'guest:%'
        AND updated_at < ?
      `)
      .bind(ninetyDaysAgoMs)
      .run();

    const deleted = result.meta?.changes || 0;
    if (deleted > 0) {
      console.log(`Cleaned up ${deleted} old guest usage tracking rows`);
    }
    return deleted;
  } catch (error) {
    // Table might not exist yet if migration hasn't run
    if (error.message?.includes('no such table')) {
      console.log('Usage tracking table not yet created, skipping guest cleanup');
      return 0;
    }
    console.error('Guest usage cleanup failed:', error);
    return 0;
  }
}

/**
 * Clean up expired sessions from D1
 * @param {D1Database} db - D1 database binding
 * @returns {Promise<number>} Number of sessions deleted
 */
async function cleanupExpiredSessions(db) {
  if (!db) {
    console.warn('Skipping session cleanup: missing DB binding');
    return 0;
  }

  try {
    const now = Math.floor(Date.now() / 1000);

    const result = await db
      .prepare('DELETE FROM sessions WHERE expires_at <= ?')
      .bind(now)
      .run();

    const deleted = result.meta?.changes || 0;
    console.log(`Cleaned up ${deleted} expired sessions`);
    return deleted;
  } catch (error) {
    console.error('Session cleanup failed:', error);
    return 0;
  }
}

/**
 * Store daily archival summary in D1
 * @param {D1Database} db - D1 database
 * @param {object} results - Archival results
 */
async function storeArchivalSummary(db, results) {
  if (!db) return;

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  try {
    await db.prepare(`
      INSERT OR REPLACE INTO archival_summaries
      (date, completed_at, metrics_archived, metrics_deleted, metrics_errors,
       feedback_archived, feedback_deleted, feedback_errors,
       sessions_deleted, webhook_events_deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      dateStr,
      now.toISOString(),
      results.metrics?.archived || 0,
      results.metrics?.deleted || 0,
      results.metrics?.errors || 0,
      results.feedback?.archived || 0,
      results.feedback?.deleted || 0,
      results.feedback?.errors || 0,
      results.sessions?.deleted || 0,
      results.webhookEvents?.deleted || 0
    ).run();
    console.log(`Stored archival summary for ${dateStr}`);
  } catch (error) {
    console.error('Failed to store archival summary:', error);
  }
}

/**
 * Main scheduled handler
 * Called by Cloudflare Workers cron trigger
 *
 * @param {ScheduledController} controller - Cron controller with scheduledTime and cron
 * @param {Env} env - Environment bindings
 * @param {ExecutionContext} ctx - Execution context
 */
export async function handleScheduled(controller, env, _ctx) {
  const startTime = Date.now();
  const cron = controller.cron;

  const analysisDateStr = new Date(Date.now() - (24 * 60 * 60 * 1000)).toISOString().split('T')[0];

  console.log(`Scheduled task triggered at ${new Date().toISOString()}`);
  console.log(`Cron pattern: ${cron}`);

  const results = {
    metrics: null,
    feedback: null,
    sessions: null,
    webhookEvents: null,
    memories: null,
    guestUsage: null,
    quality: null,
    alertsDispatched: null
  };

  try {
    // Run archival tasks in parallel (KV -> D1)
    // Note: Metrics now go directly to eval_metrics table; this archives any legacy KV keys
    const [metricsResult, feedbackResult] = await Promise.all([
      archiveKVToD1(env.METRICS_DB, env.DB, METRICS_PREFIX, 'metrics'),
      archiveKVToD1(env.FEEDBACK_KV, env.DB, FEEDBACK_PREFIX, 'feedback')
    ]);

    results.metrics = metricsResult;
    results.feedback = feedbackResult;

    // Clean up expired sessions, old webhook events, stale memories, and old guest usage
    const [sessionsDeleted, webhookEventsDeleted, memoriesResult, guestUsageDeleted] = await Promise.all([
      cleanupExpiredSessions(env.DB),
      cleanupOldWebhookEvents(env.DB),
      cleanupStaleMemories(env.DB),
      cleanupOldGuestUsage(env.DB)
    ]);
    results.sessions = { deleted: sessionsDeleted };
    results.webhookEvents = { deleted: webhookEventsDeleted };
    results.memories = memoriesResult;
    results.guestUsage = { deleted: guestUsageDeleted };

    // Store summary in D1
    await storeArchivalSummary(env.DB, results);

    // Run quality analysis on archived data (detects regressions, creates alerts)
    if (env.QUALITY_ALERT_ENABLED === 'true') {
      try {
        const qualityResults = await runQualityAnalysis(env, analysisDateStr);
        results.quality = qualityResults;

        // Dispatch any alerts that were detected
        if (qualityResults.alerts && qualityResults.alerts.length > 0) {
          const alertResults = await dispatchAlerts(env, qualityResults.alerts, { dateStr: analysisDateStr });
          results.alertsDispatched = alertResults;
          console.log(`[quality] Dispatched ${alertResults.sent} alerts`);
        }
      } catch (qualityErr) {
        console.error('[quality] Quality analysis failed:', qualityErr.message);
        results.quality = { error: qualityErr.message };
      }
    } else {
      console.log('[quality] Quality alerting disabled (QUALITY_ALERT_ENABLED != true)');
    }

    const duration = Date.now() - startTime;
    console.log(`Scheduled tasks completed in ${duration}ms`);
    console.log('Results:', JSON.stringify(results));

  } catch (error) {
    console.error('Scheduled task error:', error);
  }
}

/**
 * Manual trigger endpoint for testing archival
 * POST /api/admin/archive
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  // Simple auth check - require admin API key with timing-safe comparison
  const authHeader = request.headers.get('Authorization') || '';
  const adminKey = env.ADMIN_API_KEY;

  if (!adminKey || !timingSafeEqual(authHeader, `Bearer ${adminKey}`)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const startTime = Date.now();

  try {
    const [metricsResult, feedbackResult] = await Promise.all([
      archiveKVToD1(env.METRICS_DB, env.DB, METRICS_PREFIX, 'metrics'),
      archiveKVToD1(env.FEEDBACK_KV, env.DB, FEEDBACK_PREFIX, 'feedback')
    ]);

    const [sessionsDeleted, webhookEventsDeleted, memoriesResult, guestUsageDeleted] = await Promise.all([
      cleanupExpiredSessions(env.DB),
      cleanupOldWebhookEvents(env.DB),
      cleanupStaleMemories(env.DB),
      cleanupOldGuestUsage(env.DB)
    ]);

    const dateStr = new Date().toISOString().split('T')[0];

    const results = {
      metrics: metricsResult,
      feedback: feedbackResult,
      sessions: { deleted: sessionsDeleted },
      webhookEvents: { deleted: webhookEventsDeleted },
      memories: memoriesResult,
      guestUsage: { deleted: guestUsageDeleted },
      quality: null,
      alertsDispatched: null,
      duration: Date.now() - startTime
    };

    await storeArchivalSummary(env.DB, results);

    // Run quality analysis if enabled
    if (env.QUALITY_ALERT_ENABLED === 'true') {
      try {
        const qualityResults = await runQualityAnalysis(env, dateStr);
        results.quality = qualityResults;

        if (qualityResults.alerts && qualityResults.alerts.length > 0) {
          const alertResults = await dispatchAlerts(env, qualityResults.alerts, { dateStr });
          results.alertsDispatched = alertResults;
        }
      } catch (qualityErr) {
        results.quality = { error: qualityErr.message };
      }
    }

    return new Response(JSON.stringify({
      success: true,
      ...results
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Archival failed',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
