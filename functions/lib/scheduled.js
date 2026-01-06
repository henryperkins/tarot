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
 * @param {object} [options]
 * @param {R2Bucket} [options.bucket] - Optional bucket to store raw JSON archives
 * @param {string} [options.dateStr] - Optional YYYY-MM-DD date for archive keys
 * @returns {Promise<{archived: number, deleted: number, errors: number, batches: number}>}
 */
async function archiveKVToD1(kv, db, prefix, archiveType, options = {}) {
  const stats = { archived: 0, deleted: 0, errors: 0, batches: 0 };

  if (!kv || !db) {
    console.warn(`Skipping ${archiveType} archival: missing KV or DB binding`);
    return stats;
  }

  const now = Date.now();
  const bucket = options.bucket || null;
  const dateStr = options.dateStr || new Date().toISOString().split('T')[0];

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
            // Store a raw JSON copy in R2 when available.
            // This is best-effort and should never block D1 archival.
            if (bucket) {
              try {
                await bucket.put(
                  `archives/${archiveType}/${dateStr}/${key.name}.json`,
                  JSON.stringify(value),
                  {
                    httpMetadata: { contentType: 'application/json; charset=utf-8' }
                  }
                );
              } catch (bucketErr) {
                console.warn(`Failed to write ${archiveType} archive to bucket for ${key.name}:`, bucketErr?.message || bucketErr);
              }
            }

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

  const dateStr = new Date().toISOString().split('T')[0];
  const analysisDateStr = new Date(Date.now() - (24 * 60 * 60 * 1000)).toISOString().split('T')[0];

  console.log(`Scheduled task triggered at ${new Date().toISOString()}`);
  console.log(`Cron pattern: ${cron}`);

  const results = {
    metrics: null,
    feedback: null,
    sessions: null,
    webhookEvents: null,
    quality: null,
    alertsDispatched: null
  };

  try {
    // Run archival tasks in parallel (KV -> D1)
    const [metricsResult, feedbackResult] = await Promise.all([
      archiveKVToD1(env.METRICS_DB, env.DB, METRICS_PREFIX, 'metrics', {
        bucket: env.LOGS_BUCKET,
        dateStr
      }),
      archiveKVToD1(env.FEEDBACK_KV, env.DB, FEEDBACK_PREFIX, 'feedback', {
        bucket: env.LOGS_BUCKET,
        dateStr
      })
    ]);

    results.metrics = metricsResult;
    results.feedback = feedbackResult;

    // Clean up expired sessions and old webhook events
    const [sessionsDeleted, webhookEventsDeleted] = await Promise.all([
      cleanupExpiredSessions(env.DB),
      cleanupOldWebhookEvents(env.DB)
    ]);
    results.sessions = { deleted: sessionsDeleted };
    results.webhookEvents = { deleted: webhookEventsDeleted };

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

    // Store daily summary JSON in R2 when available.
    if (env.LOGS_BUCKET) {
      try {
        const totalArchived = (results.metrics?.archived || 0) + (results.feedback?.archived || 0);
        await env.LOGS_BUCKET.put(
          `archives/summaries/${dateStr}.json`,
          JSON.stringify({
            date: dateStr,
            totalArchived,
            ...results
          }),
          {
            httpMetadata: { contentType: 'application/json; charset=utf-8' }
          }
        );
      } catch (bucketErr) {
        console.warn('Failed to write archival summary to bucket:', bucketErr?.message || bucketErr);
      }
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

    const [sessionsDeleted, webhookEventsDeleted] = await Promise.all([
      cleanupExpiredSessions(env.DB),
      cleanupOldWebhookEvents(env.DB)
    ]);

    const dateStr = new Date().toISOString().split('T')[0];

    const results = {
      metrics: metricsResult,
      feedback: feedbackResult,
      sessions: { deleted: sessionsDeleted },
      webhookEvents: { deleted: webhookEventsDeleted },
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
