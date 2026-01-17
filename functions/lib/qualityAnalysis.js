/**
 * Quality Analysis Module
 *
 * Computes daily aggregates from eval_metrics and detects quality regressions
 * by comparing against rolling baselines.
 *
 * Run as part of the daily cron job against eval_metrics.
 */

/**
 * Regression detection thresholds.
 * Override via environment variables.
 */
export const DEFAULT_THRESHOLDS = {
  overall: {
    warning: -0.3,   // Score drop >= 0.3 triggers warning
    critical: -0.5,  // Score drop >= 0.5 triggers critical
  },
  safety_flag_rate: {
    warning: 0.02,   // 2% safety flag rate triggers warning
    critical: 0.05,  // 5% triggers critical
  },
  low_tone_rate: {
    warning: 0.10,   // 10% low tone (< 3) triggers warning
    critical: 0.20,  // 20% triggers critical
  },
  card_coverage: {
    warning: -0.10,  // 10% coverage drop triggers warning
    critical: -0.20, // 20% drop triggers critical
  },
};

const DEFAULT_MIN_READINGS = 20;

/**
 * Get thresholds from environment or use defaults.
 */
export function getThresholds(env = {}) {
  return {
    overall: {
      warning: parseFloat(env.QUALITY_REGRESSION_THRESHOLD) || DEFAULT_THRESHOLDS.overall.warning,
      critical: parseFloat(env.QUALITY_CRITICAL_THRESHOLD) || DEFAULT_THRESHOLDS.overall.critical,
    },
    safety_flag_rate: {
      warning: parseFloat(env.QUALITY_SAFETY_SPIKE_THRESHOLD) || DEFAULT_THRESHOLDS.safety_flag_rate.warning,
      critical: DEFAULT_THRESHOLDS.safety_flag_rate.critical,
    },
    low_tone_rate: DEFAULT_THRESHOLDS.low_tone_rate,
    card_coverage: DEFAULT_THRESHOLDS.card_coverage,
  };
}

/**
 * Get alert sampling configuration.
 */
export function getAlertConfig(env = {}) {
  const minReadingsRaw = parseInt(env.QUALITY_ALERT_MIN_READINGS, 10);
  const minReadings = Number.isFinite(minReadingsRaw) ? minReadingsRaw : DEFAULT_MIN_READINGS;
  return { minReadings };
}

/**
 * Compute daily aggregates from eval_metrics for a specific date.
 *
 * @param {D1Database} db - D1 database binding
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @returns {Promise<Array>} Array of aggregate objects
 */
export async function computeDailyAggregates(db, dateStr) {
  const query = `
    SELECT
      COALESCE(
        reading_prompt_version,
        json_extract(payload, '$.readingPromptVersion'),
        json_extract(payload, '$.promptMeta.readingPromptVersion')
      ) as reading_prompt_version,
      json_extract(payload, '$.eval.promptVersion') as eval_prompt_version,
      COALESCE(variant_id, json_extract(payload, '$.variantId')) as variant_id,
      COALESCE(provider, json_extract(payload, '$.provider')) as provider,
      COALESCE(spread_key, json_extract(payload, '$.spreadKey')) as spread_key,
      COUNT(*) as reading_count,
      SUM(CASE WHEN eval_mode = 'model' THEN 1 ELSE 0 END) as eval_count,
      SUM(CASE WHEN eval_mode = 'heuristic' THEN 1 ELSE 0 END) as heuristic_count,
      SUM(CASE WHEN eval_mode = 'error' OR json_extract(payload, '$.eval.error') IS NOT NULL THEN 1 ELSE 0 END) as error_count,
      AVG(COALESCE(overall_score, json_extract(payload, '$.eval.scores.overall'))) as avg_overall,
      AVG(json_extract(payload, '$.eval.scores.personalization')) as avg_personalization,
      AVG(json_extract(payload, '$.eval.scores.tarot_coherence')) as avg_tarot_coherence,
      AVG(json_extract(payload, '$.eval.scores.tone')) as avg_tone,
      AVG(json_extract(payload, '$.eval.scores.safety')) as avg_safety,
      SUM(CASE WHEN COALESCE(safety_flag, json_extract(payload, '$.eval.scores.safety_flag')) = 1 THEN 1 ELSE 0 END) as safety_flag_count,
      SUM(CASE WHEN json_extract(payload, '$.eval.scores.tone') < 3 THEN 1 ELSE 0 END) as low_tone_count,
      SUM(CASE WHEN json_extract(payload, '$.eval.scores.safety') < 3 THEN 1 ELSE 0 END) as low_safety_count,
      AVG(COALESCE(card_coverage, json_extract(payload, '$.narrative.cardCoverage'))) as avg_card_coverage,
      SUM(CASE WHEN COALESCE(json_array_length(json_extract(payload, '$.narrative.hallucinatedCards')), 0) > 0 THEN 1 ELSE 0 END) as hallucination_count
    FROM eval_metrics
    WHERE date(COALESCE(
      json_extract(payload, '$.timestamp'),
      created_at
    )) = ?
    GROUP BY
      COALESCE(
        reading_prompt_version,
        json_extract(payload, '$.readingPromptVersion'),
        json_extract(payload, '$.promptMeta.readingPromptVersion')
      ),
      json_extract(payload, '$.eval.promptVersion'),
      COALESCE(variant_id, json_extract(payload, '$.variantId')),
      COALESCE(provider, json_extract(payload, '$.provider')),
      COALESCE(spread_key, json_extract(payload, '$.spreadKey'))
  `;

  try {
    const result = await db.prepare(query).bind(dateStr).all();
    return (result.results || []).map((row) => ({
      ...row,
      reading_prompt_version: row.reading_prompt_version || null,
    }));
  } catch (err) {
    console.error(`[quality] computeDailyAggregates failed: ${err.message}`);
    return [];
  }
}

/**
 * Get rolling baseline (last 7 days, excluding the current day).
 *
 * @param {D1Database} db
 * @param {string} dateStr - Current date (YYYY-MM-DD)
 * @param {Object} dimensions - Dimension filters
 * @returns {Promise<Object|null>} Baseline metrics or null
 */
export async function getBaseline(db, dateStr, dimensions) {
  const query = `
    SELECT
      AVG(avg_overall) as baseline_overall,
      AVG(avg_personalization) as baseline_personalization,
      AVG(avg_tarot_coherence) as baseline_coherence,
      AVG(avg_tone) as baseline_tone,
      AVG(avg_safety) as baseline_safety,
      AVG(avg_card_coverage) as baseline_coverage,
      SUM(reading_count) as total_readings,
      SUM(safety_flag_count) as total_safety_flags,
      SUM(low_tone_count) as total_low_tone
    FROM quality_stats
    WHERE period_type = 'daily'
      AND period_key < ?
      AND period_key >= date(?, '-7 days')
      AND (reading_prompt_version = ? OR (reading_prompt_version IS NULL AND ? IS NULL))
      AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL))
      AND (spread_key = ? OR ? IS NULL)
      AND (provider = ? OR (provider IS NULL AND ? IS NULL))
  `;

  try {
    const result = await db.prepare(query).bind(
      dateStr,
      dateStr,
      dimensions.reading_prompt_version,
      dimensions.reading_prompt_version,
      dimensions.variant_id,
      dimensions.variant_id,
      dimensions.spread_key,
      dimensions.spread_key,
      dimensions.provider,
      dimensions.provider
    ).first();

    if (!result || result.total_readings === 0) {
      return null;
    }

    return {
      overall: result.baseline_overall,
      personalization: result.baseline_personalization,
      coherence: result.baseline_coherence,
      tone: result.baseline_tone,
      safety: result.baseline_safety,
      coverage: result.baseline_coverage,
      readings: result.total_readings,
      safety_flag_rate: result.total_readings > 0
        ? result.total_safety_flags / result.total_readings
        : 0,
      low_tone_rate: result.total_readings > 0
        ? result.total_low_tone / result.total_readings
        : 0,
    };
  } catch (err) {
    console.error(`[quality] getBaseline failed: ${err.message}`);
    return null;
  }
}

/**
 * Build a unique key for an aggregate row (for baseline lookup).
 */
function buildDimensionKey(agg) {
  return [
    agg.reading_prompt_version || 'null',
    agg.variant_id || 'null',
    agg.spread_key || 'all',
    agg.provider || 'all',
  ].join(':');
}

/**
 * Detect regressions by comparing aggregates against baselines.
 *
 * @param {Array} aggregates - Daily aggregates
 * @param {Map} baselines - Map of dimension key → baseline
 * @param {Object} thresholds - Threshold configuration
 * @returns {Array} Array of alert objects
 */
export function detectRegressions(aggregates, baselines, thresholds = DEFAULT_THRESHOLDS, options = {}) {
  const alerts = [];
  const minReadings = Number.isFinite(options.minReadings) ? options.minReadings : 0;

  for (const agg of aggregates) {
    // Skip if no readings or insufficient sample size
    if (!agg.reading_count || agg.reading_count < minReadings) continue;

    const key = buildDimensionKey(agg);
    const baseline = baselines.get(key);

    // Overall score regression
    if (baseline?.overall && agg.avg_overall !== null) {
      const delta = agg.avg_overall - baseline.overall;

      if (delta <= thresholds.overall.critical) {
        alerts.push({
          type: 'regression',
          severity: 'critical',
          metric: 'overall',
          observed: agg.avg_overall,
          baseline: baseline.overall,
          delta,
          threshold: thresholds.overall.critical,
          dimensions: agg,
        });
      } else if (delta <= thresholds.overall.warning) {
        alerts.push({
          type: 'regression',
          severity: 'warning',
          metric: 'overall',
          observed: agg.avg_overall,
          baseline: baseline.overall,
          delta,
          threshold: thresholds.overall.warning,
          dimensions: agg,
        });
      }
    }

    // Safety flag spike
    const safetyRate = agg.reading_count > 0
      ? agg.safety_flag_count / agg.reading_count
      : 0;

    if (safetyRate >= thresholds.safety_flag_rate.critical) {
      alerts.push({
        type: 'safety_spike',
        severity: 'critical',
        metric: 'safety_flag_rate',
        observed: safetyRate,
        baseline: baseline?.safety_flag_rate || 0,
        delta: safetyRate - (baseline?.safety_flag_rate || 0),
        threshold: thresholds.safety_flag_rate.critical,
        dimensions: agg,
      });
    } else if (safetyRate >= thresholds.safety_flag_rate.warning) {
      alerts.push({
        type: 'safety_spike',
        severity: 'warning',
        metric: 'safety_flag_rate',
        observed: safetyRate,
        baseline: baseline?.safety_flag_rate || 0,
        delta: safetyRate - (baseline?.safety_flag_rate || 0),
        threshold: thresholds.safety_flag_rate.warning,
        dimensions: agg,
      });
    }

    // Low tone spike
    const lowToneRate = agg.reading_count > 0
      ? agg.low_tone_count / agg.reading_count
      : 0;

    if (lowToneRate >= thresholds.low_tone_rate.critical) {
      alerts.push({
        type: 'tone_spike',
        severity: 'critical',
        metric: 'low_tone_rate',
        observed: lowToneRate,
        baseline: baseline?.low_tone_rate || 0,
        delta: lowToneRate - (baseline?.low_tone_rate || 0),
        threshold: thresholds.low_tone_rate.critical,
        dimensions: agg,
      });
    } else if (lowToneRate >= thresholds.low_tone_rate.warning) {
      alerts.push({
        type: 'tone_spike',
        severity: 'warning',
        metric: 'low_tone_rate',
        observed: lowToneRate,
        baseline: baseline?.low_tone_rate || 0,
        delta: lowToneRate - (baseline?.low_tone_rate || 0),
        threshold: thresholds.low_tone_rate.warning,
        dimensions: agg,
      });
    }

    // Card coverage drop
    if (baseline?.coverage && agg.avg_card_coverage !== null) {
      const coverageDelta = agg.avg_card_coverage - baseline.coverage;

      if (coverageDelta <= thresholds.card_coverage.critical) {
        alerts.push({
          type: 'coverage_drop',
          severity: 'critical',
          metric: 'card_coverage',
          observed: agg.avg_card_coverage,
          baseline: baseline.coverage,
          delta: coverageDelta,
          threshold: thresholds.card_coverage.critical,
          dimensions: agg,
        });
      } else if (coverageDelta <= thresholds.card_coverage.warning) {
        alerts.push({
          type: 'coverage_drop',
          severity: 'warning',
          metric: 'card_coverage',
          observed: agg.avg_card_coverage,
          baseline: baseline.coverage,
          delta: coverageDelta,
          threshold: thresholds.card_coverage.warning,
          dimensions: agg,
        });
      }
    }
  }

  return alerts;
}

/**
 * Store daily aggregates in quality_stats table.
 *
 * @param {D1Database} db
 * @param {string} periodKey - Date string (YYYY-MM-DD)
 * @param {Object} agg - Aggregate row
 * @param {Object} baseline - Baseline metrics (optional)
 */
export async function storeQualityStats(db, periodKey, agg, baseline = null) {
  const query = `
    INSERT OR REPLACE INTO quality_stats (
      period_type, period_key, reading_prompt_version, eval_prompt_version,
      variant_id, provider, spread_key, reading_count, eval_count,
      heuristic_count, error_count, avg_overall, avg_personalization,
      avg_tarot_coherence, avg_tone, avg_safety, safety_flag_count,
      low_tone_count, low_safety_count, avg_card_coverage, hallucination_count,
      baseline_overall, delta_overall, created_at
    ) VALUES (
      'daily', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, CURRENT_TIMESTAMP
    )
  `;

  const delta = baseline?.overall && agg.avg_overall !== null
    ? agg.avg_overall - baseline.overall
    : null;

  try {
    await db.prepare(query).bind(
      periodKey,
      agg.reading_prompt_version,
      agg.eval_prompt_version,
      agg.variant_id,
      agg.provider,
      agg.spread_key,
      agg.reading_count,
      agg.eval_count || 0,
      agg.heuristic_count || 0,
      agg.error_count || 0,
      agg.avg_overall,
      agg.avg_personalization,
      agg.avg_tarot_coherence,
      agg.avg_tone,
      agg.avg_safety,
      agg.safety_flag_count || 0,
      agg.low_tone_count || 0,
      agg.low_safety_count || 0,
      agg.avg_card_coverage,
      agg.hallucination_count || 0,
      baseline?.overall || null,
      delta
    ).run();
  } catch (err) {
    console.error(`[quality] storeQualityStats failed: ${err.message}`);
  }
}

/**
 * Store an alert in the quality_alerts table.
 *
 * @param {D1Database} db
 * @param {string} periodKey
 * @param {Object} alert
 */
export async function storeAlert(db, periodKey, alert) {
  const existingId = await findExistingAlertId(db, periodKey, alert);
  if (existingId) {
    return { id: existingId, created: false };
  }

  const query = `
    INSERT INTO quality_alerts (
      alert_type, severity, period_key, reading_prompt_version,
      eval_prompt_version, variant_id, spread_key, provider,
      metric_name, observed_value, threshold_value, baseline_value,
      delta, reading_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `;

  try {
    const result = await db.prepare(query).bind(
      alert.type,
      alert.severity,
      periodKey,
      alert.dimensions?.reading_prompt_version || null,
      alert.dimensions?.eval_prompt_version || null,
      alert.dimensions?.variant_id || null,
      alert.dimensions?.spread_key || null,
      alert.dimensions?.provider || null,
      alert.metric,
      alert.observed,
      alert.threshold,
      alert.baseline,
      alert.delta,
      alert.dimensions?.reading_count || null
    ).run();

    return { id: result?.meta?.last_row_id ?? null, created: true };
  } catch (err) {
    console.error(`[quality] storeAlert failed: ${err.message}`);
    return { id: null, created: false };
  }
}

async function findExistingAlertId(db, periodKey, alert) {
  if (!db) return null;

  try {
    const result = await db.prepare(`
      SELECT id
      FROM quality_alerts
      WHERE period_key = ?
        AND alert_type = ?
        AND severity = ?
        AND metric_name = ?
        AND (reading_prompt_version = ? OR (reading_prompt_version IS NULL AND ? IS NULL))
        AND (eval_prompt_version = ? OR (eval_prompt_version IS NULL AND ? IS NULL))
        AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL))
        AND (spread_key = ? OR (spread_key IS NULL AND ? IS NULL))
        AND (provider = ? OR (provider IS NULL AND ? IS NULL))
      LIMIT 1
    `).bind(
      periodKey,
      alert.type,
      alert.severity,
      alert.metric,
      alert.dimensions?.reading_prompt_version || null,
      alert.dimensions?.reading_prompt_version || null,
      alert.dimensions?.eval_prompt_version || null,
      alert.dimensions?.eval_prompt_version || null,
      alert.dimensions?.variant_id || null,
      alert.dimensions?.variant_id || null,
      alert.dimensions?.spread_key || null,
      alert.dimensions?.spread_key || null,
      alert.dimensions?.provider || null,
      alert.dimensions?.provider || null
    ).first();

    return result?.id ?? null;
  } catch (err) {
    console.warn(`[quality] findExistingAlertId failed: ${err.message}`);
    return null;
  }
}

/**
 * Main entry point: run quality analysis for a date.
 *
 * @param {Object} env - Worker environment (DB, METRICS_DB, etc.)
 * @param {string} dateStr - Date to analyze (YYYY-MM-DD)
 * @param {Object} options - Options
 * @returns {Promise<Object>} Analysis results
 */
export async function runQualityAnalysis(env, dateStr, _options = {}) {
  const db = env.DB;
  if (!db) {
    console.warn('[quality] No DB binding, skipping quality analysis');
    return { skipped: true, reason: 'no_db' };
  }

  const thresholds = getThresholds(env);
  const alertConfig = getAlertConfig(env);
  const results = {
    date: dateStr,
    aggregates: 0,
    alerts: [],
    detected: 0,
    stored: 0,
    errors: [],
  };

  try {
    // 1. Compute daily aggregates
    const aggregates = await computeDailyAggregates(db, dateStr);
    results.aggregates = aggregates.length;

    if (aggregates.length === 0) {
      console.log(`[quality] No metrics to aggregate for ${dateStr}`);
      return results;
    }

    // 2. Get baselines for each aggregate dimension
    const baselines = new Map();
    for (const agg of aggregates) {
      const key = buildDimensionKey(agg);
      if (!baselines.has(key)) {
        const baseline = await getBaseline(db, dateStr, {
          reading_prompt_version: agg.reading_prompt_version,
          variant_id: agg.variant_id,
          spread_key: agg.spread_key,
          provider: agg.provider,
        });
        baselines.set(key, baseline);
      }
    }

    // 3. Detect regressions
    const alerts = detectRegressions(aggregates, baselines, thresholds, alertConfig);
    results.detected = alerts.length;

    // 4. Store aggregates
    for (const agg of aggregates) {
      const key = buildDimensionKey(agg);
      const baseline = baselines.get(key);
      await storeQualityStats(db, dateStr, agg, baseline);
      results.stored++;
    }

    // 5. Store alerts (dedupe on period + dimensions)
    const newAlerts = [];
    for (const alert of alerts) {
      const stored = await storeAlert(db, dateStr, alert);
      if (stored?.id) {
        alert.id = stored.id;
      }
      if (stored?.created) {
        newAlerts.push(alert);
      }
    }
    results.alerts = newAlerts;

    console.log(`[quality] Analysis complete for ${dateStr}: ${aggregates.length} aggregates, ${alerts.length} alerts detected, ${newAlerts.length} new alerts`);

    return results;
  } catch (err) {
    console.error(`[quality] runQualityAnalysis failed: ${err.message}`);
    results.errors.push(err.message);
    return results;
  }
}

/**
 * Get unacknowledged alerts.
 *
 * @param {D1Database} db
 * @param {Object} options
 * @returns {Promise<Array>}
 */
export async function getUnacknowledgedAlerts(db, options = {}) {
  const limit = options.limit || 50;
  const query = `
    SELECT * FROM quality_alerts
    WHERE acknowledged_at IS NULL
    ORDER BY
      CASE severity WHEN 'critical' THEN 0 ELSE 1 END,
      created_at DESC
    LIMIT ?
  `;

  try {
    const result = await db.prepare(query).bind(limit).all();
    return result.results || [];
  } catch (err) {
    console.error(`[quality] getUnacknowledgedAlerts failed: ${err.message}`);
    return [];
  }
}

/**
 * Acknowledge an alert.
 *
 * @param {D1Database} db
 * @param {number} alertId
 * @param {Object} options
 */
export async function acknowledgeAlert(db, alertId, options = {}) {
  const query = `
    UPDATE quality_alerts
    SET acknowledged_at = CURRENT_TIMESTAMP,
        acknowledged_by = ?,
        resolution_notes = ?
    WHERE id = ?
  `;

  try {
    await db.prepare(query).bind(
      options.by || 'system',
      options.notes || null,
      alertId
    ).run();
    return true;
  } catch (err) {
    console.error(`[quality] acknowledgeAlert failed: ${err.message}`);
    return false;
  }
}

/**
 * Get recent quality stats for dashboard.
 *
 * @param {D1Database} db
 * @param {Object} options
 */
export async function getRecentStats(db, options = {}) {
  const days = options.days || 30;
  const dayWindow = `-${Math.max(1, days)} days`;
  const query = `
    SELECT * FROM quality_stats
    WHERE period_type = 'daily'
      AND period_key >= date('now', ?)
    ORDER BY period_key DESC
    LIMIT ?
  `;

  try {
    const result = await db.prepare(query).bind(dayWindow, days * 10).all(); // Allow for multiple dimensions
    return result.results || [];
  } catch (err) {
    console.error(`[quality] getRecentStats failed: ${err.message}`);
    return [];
  }
}
