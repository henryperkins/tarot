/**
 * Scheduled Tasks Handler
 *
 * Handles cron-triggered tasks for the Mystic Tarot application:
 * - Archive metrics from METRICS_DB KV to R2
 * - Archive feedback from FEEDBACK_KV to R2
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
 * Archive KV data to R2 bucket with full pagination support
 * @param {KVNamespace} kv - Source KV namespace
 * @param {R2Bucket} bucket - Destination R2 bucket
 * @param {string} prefix - KV key prefix to archive
 * @param {string} archiveType - Type identifier for archive path
 * @returns {Promise<{archived: number, deleted: number, errors: number, batches: number}>}
 */
async function archiveKVToR2(kv, bucket, prefix, archiveType) {
  const stats = { archived: 0, deleted: 0, errors: 0, batches: 0 };

  if (!kv || !bucket) {
    console.warn(`Skipping ${archiveType} archival: missing KV or R2 binding`);
    return stats;
  }

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
      const records = [];
      const keysToDelete = [];

      for (const key of keys) {
        try {
          const value = await kv.get(key.name, 'json');
          if (value) {
            records.push({
              key: key.name,
              metadata: key.metadata || {},
              data: value,
              archivedAt: new Date().toISOString()
            });
            keysToDelete.push(key.name);
            stats.archived++;
          }
        } catch (err) {
          console.error(`Failed to read ${key.name}:`, err.message);
          stats.errors++;
        }
      }

      if (records.length === 0) {
        continue;
      }

      // Create archive file in R2 for this batch
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timestamp = now.getTime();
      const batchSuffix = stats.batches > 1 ? `-batch${stats.batches}` : '';
      const archivePath = `archives/${archiveType}/${dateStr}/${timestamp}${batchSuffix}.json`;

      const archiveData = {
        type: archiveType,
        archivedAt: now.toISOString(),
        batch: stats.batches,
        recordCount: records.length,
        records
      };

      await bucket.put(archivePath, JSON.stringify(archiveData, null, 2), {
        httpMetadata: {
          contentType: 'application/json'
        },
        customMetadata: {
          archiveType,
          recordCount: records.length.toString(),
          batch: stats.batches.toString(),
          dateArchived: dateStr
        }
      });

      console.log(`Archived ${records.length} ${archiveType} records to ${archivePath}`);

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
 * Generate daily archival summary
 * @param {R2Bucket} bucket - R2 bucket for storing summary
 * @param {object} results - Archival results
 */
async function storeArchivalSummary(bucket, results) {
  if (!bucket) return;

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const summaryPath = `archives/summaries/${dateStr}.json`;

  const summary = {
    date: dateStr,
    completedAt: now.toISOString(),
    metrics: results.metrics,
    feedback: results.feedback,
    sessions: results.sessions,
    totalArchived: (results.metrics?.archived || 0) + (results.feedback?.archived || 0),
    totalErrors: (results.metrics?.errors || 0) + (results.feedback?.errors || 0)
  };

  try {
    await bucket.put(summaryPath, JSON.stringify(summary, null, 2), {
      httpMetadata: {
        contentType: 'application/json'
      },
      customMetadata: {
        type: 'archival-summary',
        date: dateStr
      }
    });
    console.log(`Stored archival summary at ${summaryPath}`);
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
export async function handleScheduled(controller, env, ctx) {
  const startTime = Date.now();
  const cron = controller.cron;

  console.log(`Scheduled task triggered at ${new Date().toISOString()}`);
  console.log(`Cron pattern: ${cron}`);

  const results = {
    metrics: null,
    feedback: null,
    sessions: null
  };

  try {
    // Run archival tasks in parallel
    const [metricsResult, feedbackResult] = await Promise.all([
      archiveKVToR2(env.METRICS_DB, env.LOGS_BUCKET, METRICS_PREFIX, 'metrics'),
      archiveKVToR2(env.FEEDBACK_KV, env.LOGS_BUCKET, FEEDBACK_PREFIX, 'feedback')
    ]);

    results.metrics = metricsResult;
    results.feedback = feedbackResult;

    // Clean up expired sessions
    const sessionsDeleted = await cleanupExpiredSessions(env.DB);
    results.sessions = { deleted: sessionsDeleted };

    // Store summary in R2
    await storeArchivalSummary(env.LOGS_BUCKET, results);

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

  // Simple auth check - require admin API key
  const authHeader = request.headers.get('Authorization');
  const adminKey = env.ADMIN_API_KEY;

  if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const startTime = Date.now();

  try {
    const [metricsResult, feedbackResult] = await Promise.all([
      archiveKVToR2(env.METRICS_DB, env.LOGS_BUCKET, METRICS_PREFIX, 'metrics'),
      archiveKVToR2(env.FEEDBACK_KV, env.LOGS_BUCKET, FEEDBACK_PREFIX, 'feedback')
    ]);

    const sessionsDeleted = await cleanupExpiredSessions(env.DB);

    const results = {
      metrics: metricsResult,
      feedback: feedbackResult,
      sessions: { deleted: sessionsDeleted },
      duration: Date.now() - startTime
    };

    await storeArchivalSummary(env.LOGS_BUCKET, results);

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
