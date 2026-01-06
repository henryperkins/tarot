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
  acknowledgeAlert
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
    const includeExperiments = url.searchParams.get('experiments') !== 'false';

    // Get recent quality stats
    const stats = await getRecentStats(env.DB, { days });

    // Get unacknowledged alerts
    const alerts = await getUnacknowledgedAlerts(env.DB, { limit: 50 });

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
      experiments,
      queryParams: { days, includeExperiments },
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

      default:
        return new Response(JSON.stringify({
          error: 'Unknown action',
          validActions: ['acknowledge', 'experiment-results'],
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
  const withOverall = stats.filter((s) => s.avg_overall !== null);
  const avgOverall = withOverall.length > 0
    ? withOverall.reduce((sum, s) => sum + s.avg_overall, 0) / withOverall.length
    : null;

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
