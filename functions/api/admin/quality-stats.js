/**
 * Quality Stats Admin Endpoint
 *
 * GET /api/admin/quality-stats - Get quality statistics and alerts
 * POST /api/admin/quality-stats/acknowledge - Acknowledge an alert
 *
 * Requires ADMIN_API_KEY authentication.
 */

import { timingSafeEqual } from '../../lib/crypto.js';
import {
  getRecentStats,
  getUnacknowledgedAlerts,
  acknowledgeAlert,
  runQualityAnalysis
} from '../../lib/qualityAnalysis.js';
import {
  getExperimentResults,
  loadActiveExperiments
} from '../../lib/abTesting.js';

/**
 * Verify admin authentication.
 */
function verifyAdmin(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const adminKey = env.ADMIN_API_KEY;

  if (!adminKey) {
    return { valid: false, error: 'Admin API not configured' };
  }

  if (!timingSafeEqual(authHeader, `Bearer ${adminKey}`)) {
    return { valid: false, error: 'Unauthorized' };
  }

  return { valid: true };
}

/**
 * GET /api/admin/quality-stats
 *
 * Returns quality statistics and unacknowledged alerts.
 */
export async function onRequestGet(context) {
  const { request, env } = context;

  const auth = verifyAdmin(request, env);
  if (!auth.valid) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.error === 'Unauthorized' ? 401 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30', 10);
    const reviewDays = parseInt(url.searchParams.get('reviewDays') || String(days), 10);
    const reviewLimit = parseInt(url.searchParams.get('reviewLimit') || '25', 10);
    const includeExperiments = url.searchParams.get('experiments') !== 'false';

    // Get recent quality stats
    const stats = await getRecentStats(env.DB, { days });

    // Get unacknowledged alerts
    const alerts = await getUnacknowledgedAlerts(env.DB, { limit: 50 });

    // Build human review queue
    const reviewQueue = await getReviewQueue(env.DB, {
      days: reviewDays,
      limit: reviewLimit
    });

    // Get active experiments if requested
    let experiments = null;
    if (includeExperiments) {
      experiments = await loadActiveExperiments(env.DB);
    }

    // Compute summary
    const summary = computeSummary(stats);

    return new Response(JSON.stringify({
      success: true,
      summary,
      stats,
      alerts,
      reviewQueue,
      experiments,
      queryParams: { days, reviewDays, reviewLimit, includeExperiments },
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[admin/quality-stats] Error:', err.message);
    return new Response(JSON.stringify({
      error: 'Failed to fetch quality stats',
      message: err.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/admin/quality-stats
 *
 * Actions: acknowledge alert, get experiment results
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  const auth = verifyAdmin(request, env);
  if (!auth.valid) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.error === 'Unauthorized' ? 401 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'acknowledge': {
        const { alertId, by, notes } = body;
        if (!alertId) {
          return new Response(JSON.stringify({ error: 'alertId required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const result = await acknowledgeAlert(env.DB, alertId, { by, notes });
        return new Response(JSON.stringify({
          success: result,
          alertId,
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'experiment-results': {
        const { experimentId } = body;
        if (!experimentId) {
          return new Response(JSON.stringify({ error: 'experimentId required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const results = await getExperimentResults(env.DB, experimentId);
        if (!results) {
          return new Response(JSON.stringify({
            error: 'Experiment not found',
            experimentId,
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({
          success: true,
          ...results,
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'run-analysis': {
        // Manual trigger for quality analysis (debugging)
        const { date } = body;
        const dateStr = date || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        console.log(`[admin] Manually triggering quality analysis for ${dateStr}`);
        
        const analysisResults = await runQualityAnalysis(env, dateStr);
        return new Response(JSON.stringify({
          success: true,
          date: dateStr,
          results: analysisResults,
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({
          error: 'Unknown action',
          validActions: ['acknowledge', 'experiment-results', 'run-analysis'],
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }
  } catch (err) {
    console.error('[admin/quality-stats] POST error:', err.message);
    return new Response(JSON.stringify({
      error: 'Action failed',
      message: err.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Compute summary statistics from quality stats.
 */
function computeSummary(stats) {
  if (!stats || stats.length === 0) {
    return {
      totalReadings: 0,
      avgOverall: null,
      safetyFlagRate: null,
      periodsCovered: 0,
    };
  }

  const totalReadings = stats.reduce((sum, s) => sum + (s.reading_count || 0), 0);

  // Weighted average by reading_count to avoid low-volume slices skewing the result
  const withOverall = stats.filter((s) => s.avg_overall !== null && (s.reading_count || 0) > 0);
  const weightedSum = withOverall.reduce((sum, s) => sum + s.avg_overall * (s.reading_count || 0), 0);
  const weightedCount = withOverall.reduce((sum, s) => sum + (s.reading_count || 0), 0);
  const avgOverall = weightedCount > 0 ? weightedSum / weightedCount : null;

  const totalSafetyFlags = stats.reduce((sum, s) => sum + (s.safety_flag_count || 0), 0);
  const safetyFlagRate = totalReadings > 0 ? totalSafetyFlags / totalReadings : null;

  // Get unique periods
  const periods = new Set(stats.map((s) => s.period_key));

  // Get versions in use
  const versions = [...new Set(stats.map((s) => s.reading_prompt_version).filter(Boolean))];

  // Get variants in use
  const variants = [...new Set(stats.map((s) => s.variant_id).filter(Boolean))];

  return {
    totalReadings,
    avgOverall: avgOverall?.toFixed(2),
    safetyFlagRate: safetyFlagRate?.toFixed(4),
    periodsCovered: periods.size,
    versions,
    variants,
  };
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function coerceNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function coerceBoolean(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') {
    return true;
  }
  return false;
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeTimestamp(primary, fallbackMs) {
  if (primary && typeof primary === 'string') {
    return primary;
  }
  if (primary instanceof Date) {
    return primary.toISOString();
  }
  if (fallbackMs) {
    if (typeof fallbackMs === 'string') {
      const dateFromString = new Date(fallbackMs);
      if (!Number.isNaN(dateFromString.getTime())) {
        return dateFromString.toISOString();
      }
    }
    const date = new Date(Number(fallbackMs));
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return null;
}

function buildExcerpt(value, maxLength = 240) {
  if (!value) return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function normalizeReviewRow(row) {
  const hallucinatedCards = parseJsonArray(row.hallucinated_cards);
  const safetyFlag = coerceBoolean(row.safety_flag);
  const safety = coerceNumber(row.safety);
  const tone = coerceNumber(row.tone);
  const overall = coerceNumber(row.overall);
  const cardCoverage = coerceNumber(row.card_coverage);

  const reasons = [];
  if (safetyFlag) reasons.push('safety-flag');
  if (safety !== null && safety < 3) reasons.push('low-safety');
  if (tone !== null && tone < 3) reasons.push('low-tone');
  if (hallucinatedCards.length > 0) reasons.push('hallucinated-cards');

  return {
    requestId: row.request_id,
    provider: row.provider || null,
    spreadKey: row.spread_key || null,
    deckStyle: row.deck_style || null,
    timestamp: normalizeTimestamp(row.timestamp, row.created_at),
    overall,
    safety,
    tone,
    safetyFlag,
    cardCoverage,
    hallucinatedCards,
    notes: row.notes || null,
    readingExcerpt: buildExcerpt(row.reading_text, 260),
    questionExcerpt: buildExcerpt(row.user_question, 180),
    readingPromptVersion: row.reading_prompt_version || null,
    evalPromptVersion: row.eval_prompt_version || null,
    variantId: row.variant_id || null,
    reasons
  };
}

async function getReviewQueue(db, options = {}) {
  if (!db) {
    return {
      items: [],
      counts: {
        total: 0,
        safetyFlag: 0,
        lowSafety: 0,
        lowTone: 0,
        hallucinations: 0
      },
      query: { days: 0, limit: 0 }
    };
  }

  const days = clampNumber(Number(options.days || 7), 1, 90);
  const limit = clampNumber(Number(options.limit || 25), 1, 100);
  const window = `-${days} days`;

  const hallucinationCountExpr = `
    COALESCE(
      hallucination_count,
      json_array_length(json_extract(payload, '$.narrative.hallucinatedCards')),
      json_array_length(json_extract(payload, '$.narrativeOriginal.hallucinatedCards')),
      0
    )
  `;
  const hasHallucinations = `(${hallucinationCountExpr} > 0)`;

  const baseWhere = `
    date(COALESCE(
      json_extract(payload, '$.timestamp'),
      created_at
    )) >= date('now', ?)
    AND (
      COALESCE(safety_flag, json_extract(payload, '$.eval.scores.safety_flag')) = 1 OR
      json_extract(payload, '$.eval.scores.safety') < 3 OR
      json_extract(payload, '$.eval.scores.tone') < 3 OR
      ${hasHallucinations}
    )
  `;

  const listQuery = `
    SELECT
      request_id,
      COALESCE(provider, json_extract(payload, '$.provider')) as provider,
      COALESCE(spread_key, json_extract(payload, '$.spreadKey')) as spread_key,
      COALESCE(deck_style, json_extract(payload, '$.deckStyle')) as deck_style,
      created_at,
      json_extract(payload, '$.timestamp') as timestamp,
      json_extract(payload, '$.eval.scores.overall') as overall,
      json_extract(payload, '$.eval.scores.safety') as safety,
      json_extract(payload, '$.eval.scores.tone') as tone,
      COALESCE(safety_flag, json_extract(payload, '$.eval.scores.safety_flag')) as safety_flag,
      json_extract(payload, '$.eval.scores.notes') as notes,
      COALESCE(
        card_coverage,
        json_extract(payload, '$.narrative.cardCoverage'),
        json_extract(payload, '$.narrativeOriginal.cardCoverage')
      ) as card_coverage,
      COALESCE(
        hallucinated_cards,
        json_extract(payload, '$.narrative.hallucinatedCards'),
        json_extract(payload, '$.narrativeOriginal.hallucinatedCards')
      ) as hallucinated_cards,
      json_extract(payload, '$.readingText') as reading_text,
      json_extract(payload, '$.userQuestion') as user_question,
      COALESCE(
        reading_prompt_version,
        json_extract(payload, '$.readingPromptVersion'),
        json_extract(payload, '$.promptMeta.readingPromptVersion')
      ) as reading_prompt_version,
      json_extract(payload, '$.eval.promptVersion') as eval_prompt_version,
      COALESCE(variant_id, json_extract(payload, '$.variantId')) as variant_id
    FROM eval_metrics
    WHERE ${baseWhere}
    ORDER BY COALESCE(json_extract(payload, '$.timestamp'), created_at) DESC
    LIMIT ?
  `;

  const countQuery = `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN COALESCE(safety_flag, json_extract(payload, '$.eval.scores.safety_flag')) = 1 THEN 1 ELSE 0 END) as safety_flag_count,
      SUM(CASE WHEN json_extract(payload, '$.eval.scores.safety') < 3 THEN 1 ELSE 0 END) as low_safety_count,
      SUM(CASE WHEN json_extract(payload, '$.eval.scores.tone') < 3 THEN 1 ELSE 0 END) as low_tone_count,
      SUM(CASE WHEN ${hasHallucinations} THEN 1 ELSE 0 END) as hallucination_count
    FROM eval_metrics
    WHERE ${baseWhere}
  `;

  try {
    const [listResult, countResult] = await Promise.all([
      db.prepare(listQuery).bind(window, limit).all(),
      db.prepare(countQuery).bind(window).first()
    ]);

    const items = (listResult.results || []).map(normalizeReviewRow);

    return {
      items,
      counts: {
        total: countResult?.total || 0,
        safetyFlag: countResult?.safety_flag_count || 0,
        lowSafety: countResult?.low_safety_count || 0,
        lowTone: countResult?.low_tone_count || 0,
        hallucinations: countResult?.hallucination_count || 0
      },
      query: { days, limit }
    };
  } catch (err) {
    if (err.message?.includes('no such table')) {
      return {
        items: [],
        counts: {
          total: 0,
          safetyFlag: 0,
          lowSafety: 0,
          lowTone: 0,
          hallucinations: 0
        },
        query: { days, limit }
      };
    }
    console.error('[admin/quality-stats] Review queue error:', err.message);
    return {
      items: [],
      counts: {
        total: 0,
        safetyFlag: 0,
        lowSafety: 0,
        lowTone: 0,
        hallucinations: 0
      },
      query: { days, limit },
      error: err.message
    };
  }
}
