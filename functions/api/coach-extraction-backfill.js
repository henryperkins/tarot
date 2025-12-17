/**
 * /api/coach-extraction-backfill
 *
 * Backfills extracted_steps and step_embeddings for existing journal entries
 * that don't have extraction data. Processes in batches to avoid timeouts.
 *
 * GET  - status/progress overview
 * POST - process a small batch
 *
 * Requires ADMIN_API_KEY in Authorization header.
 *
 * Query params:
 *   - limit: Max entries to attempt per request (default: 2, max: 10)
 *   - dryRun: If "true", only report what would be processed
 *
 * Response:
 *   { processed: number, skipped: number, failed: number, remaining: number }
 *
 * IMPORTANT: Each entry requires 2 AI calls (extraction + embedding) with per-call
 * timeouts. Requests are time-budgeted and may stop early even if `limit` is higher.
 * For large backfills, call this endpoint repeatedly in a loop with delays between calls.
 *
 * Example: while true; do curl -X POST ... && sleep 5; done
 */

import { extractAndEmbed } from '../lib/coachSuggestion.js';
import { timingSafeEqual } from '../lib/crypto.js';

// Keep batch sizes small - each entry can take ~13s worst-case (8s extraction + 5s embedding).
// Requests are time-budgeted and will stop early to avoid HTTP timeouts.
const MAX_BATCH_SIZE = 10;
const DEFAULT_BATCH_SIZE = 2;

// Conservative wall-time budget for the whole request.
const REQUEST_TIME_BUDGET_MS = 25000;
// Conservative estimate for one entry (timeouts + DB write + overhead).
const ENTRY_BUDGET_MS = 14000;

export async function onRequestPost({ request, env }) {
  const requestId = crypto.randomUUID ? crypto.randomUUID() : `backfill_${Date.now()}`;
  const startTime = Date.now();

  // Validate admin key with timing-safe comparison
  const authHeader = request.headers.get('Authorization') || '';
  const providedKey = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!env.ADMIN_API_KEY || !timingSafeEqual(providedKey, env.ADMIN_API_KEY)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check required bindings
  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'Database binding not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!env.AI) {
    return new Response(JSON.stringify({ error: 'AI binding not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Parse query params
  const url = new URL(request.url);
  const parsedLimit = parseInt(url.searchParams.get('limit') || String(DEFAULT_BATCH_SIZE), 10);
  const requestedLimit = Number.isFinite(parsedLimit) ? parsedLimit : DEFAULT_BATCH_SIZE;
  const limit = Math.min(Math.max(1, requestedLimit), MAX_BATCH_SIZE);
  const dryRun = url.searchParams.get('dryRun') === 'true';

  console.log(`[${requestId}] [backfill] Starting backfill (limit: ${limit}, dryRun: ${dryRun})`);

  try {
    // Find entries without extraction data
    const entriesResult = await env.DB.prepare(`
      SELECT id, narrative
      FROM journal_entries
      WHERE extracted_steps IS NULL
        AND narrative IS NOT NULL
        AND length(narrative) > 100
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(limit).all();

    const entries = entriesResult.results || [];

    // Count remaining entries for progress tracking
    const remainingResult = await env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM journal_entries
      WHERE extracted_steps IS NULL
        AND narrative IS NOT NULL
        AND length(narrative) > 100
    `).first();
    const totalRemaining = remainingResult?.count || 0;

    console.log(`[${requestId}] [backfill] Found ${entries.length} entries to process, ${totalRemaining} total remaining`);

    if (dryRun) {
      return new Response(JSON.stringify({
        dryRun: true,
        wouldProcess: entries.length,
        remaining: totalRemaining,
        entries: entries.map(e => ({ id: e.id, narrativeLength: e.narrative?.length || 0 }))
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Process entries
    let processed = 0;
    let skipped = 0;
    let failed = 0;
    let attempted = 0;

    for (const entry of entries) {
      const elapsedMs = Date.now() - startTime;
      const remainingBudgetMs = REQUEST_TIME_BUDGET_MS - elapsedMs;
      if (remainingBudgetMs < ENTRY_BUDGET_MS) {
        console.log(`[${requestId}] [backfill] Stopping early to avoid timeout (elapsed: ${elapsedMs}ms)`);
        break;
      }

      attempted++;
      try {
        const result = await extractAndEmbed(env, entry.narrative, `${requestId}:${entry.id}`);

        if (!result || !result.status) {
          failed++;
          console.error(`[${requestId}] [backfill] Entry ${entry.id}: Extraction returned no status, will retry later`);
          continue;
        }

        if (result.status === 'ok') {
          await env.DB.prepare(`
            UPDATE journal_entries
            SET extracted_steps = ?1, step_embeddings = ?2, extraction_version = ?3
            WHERE id = ?4
          `).bind(
            JSON.stringify(result.steps),
            JSON.stringify(result.embeddings),
            result.version,
            entry.id
          ).run();

          processed++;
          console.log(`[${requestId}] [backfill] Entry ${entry.id}: Extracted ${result.steps.length} steps`);
          continue;
        }

        if (result.status === 'steps_only') {
          await env.DB.prepare(`
            UPDATE journal_entries
            SET extracted_steps = ?1, step_embeddings = NULL, extraction_version = ?2
            WHERE id = ?3
          `).bind(
            JSON.stringify(result.steps),
            result.version || 'v1-steps-only',
            entry.id
          ).run();

          processed++;
          console.log(`[${requestId}] [backfill] Entry ${entry.id}: Stored ${result.steps.length} steps without embeddings`);
          continue;
        }

        if (result.status === 'no_steps') {
          skipped++;
          console.log(`[${requestId}] [backfill] Entry ${entry.id}: No steps extracted, marking as processed`);
          await env.DB.prepare(`
            UPDATE journal_entries
            SET extracted_steps = '[]', step_embeddings = '[]', extraction_version = ?
            WHERE id = ?
          `).bind(result.version || 'v1-empty', entry.id).run();
          continue;
        }

        failed++;
        console.error(`[${requestId}] [backfill] Entry ${entry.id}: Extraction failed with status ${result.status}, will retry later`);

      } catch (err) {
        failed++;
        console.error(`[${requestId}] [backfill] Entry ${entry.id}: Error - ${err.message}`);
      }
    }

    const remaining = Math.max(0, totalRemaining - (processed + skipped));
    const elapsedMs = Date.now() - startTime;
    const stoppedEarly = attempted < entries.length;

    console.log(`[${requestId}] [backfill] Complete: ${processed} processed, ${skipped} skipped, ${failed} failed, ${remaining} remaining`);

    return new Response(JSON.stringify({
      processed,
      skipped,
      failed,
      remaining,
      batchSize: entries.length,
      attempted,
      stoppedEarly,
      elapsedMs,
      timeBudgetMs: REQUEST_TIME_BUDGET_MS
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error(`[${requestId}] [backfill] Fatal error: ${err.message}`);
    return new Response(JSON.stringify({ error: 'Backfill failed', details: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET endpoint for status check
export async function onRequestGet({ request, env }) {
  // Validate admin key with timing-safe comparison
  const authHeader = request.headers.get('Authorization') || '';
  const providedKey = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!env.ADMIN_API_KEY || !timingSafeEqual(providedKey, env.ADMIN_API_KEY)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'Database binding not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get stats
    const stats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN extracted_steps IS NOT NULL THEN 1 ELSE 0 END) as with_extraction,
        SUM(CASE WHEN extracted_steps IS NULL AND narrative IS NOT NULL AND length(narrative) > 100 THEN 1 ELSE 0 END) as needs_extraction,
        SUM(CASE WHEN extraction_version = 'v1-empty' THEN 1 ELSE 0 END) as no_steps_found
      FROM journal_entries
    `).first();

    return new Response(JSON.stringify({
      total: stats?.total || 0,
      withExtraction: stats?.with_extraction || 0,
      needsExtraction: stats?.needs_extraction || 0,
      noStepsFound: stats?.no_steps_found || 0,
      percentComplete: stats?.total > 0
        ? Math.round(((stats.with_extraction || 0) / stats.total) * 100)
        : 0
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Status check failed', details: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
