/**
 * A/B Testing Module
 *
 * Provides deterministic variant assignment for prompt experiments.
 * Uses hash-based assignment to ensure:
 * - Same request ID always gets same variant
 * - Traffic split is statistically fair
 * - No external dependencies
 */

/**
 * Simple hash function for deterministic assignment.
 * Uses FNV-1a algorithm for good distribution.
 *
 * @param {string} str - String to hash
 * @returns {number} Positive integer hash
 */
function fnv1aHash(str) {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  return Math.abs(hash);
}

/**
 * Load active experiments from D1.
 *
 * @param {D1Database} db - D1 database binding
 * @returns {Promise<Array>} Active experiments
 */
export async function loadActiveExperiments(db) {
  if (!db) return [];

  try {
    const result = await db.prepare(`
      SELECT *
      FROM ab_experiments
      WHERE status = 'running'
      ORDER BY started_at DESC
    `).all();

    return (result.results || []).map((exp) => ({
      ...exp,
      treatment_variants: safeParseJSON(exp.treatment_variants, []),
      spread_keys: safeParseJSON(exp.spread_keys, null),
      providers: safeParseJSON(exp.providers, null),
    }));
  } catch (err) {
    // Table might not exist yet
    if (err.message?.includes('no such table')) {
      return [];
    }
    console.error('[ab] Failed to load experiments:', err.message);
    return [];
  }
}

/**
 * Get A/B test assignment for a request.
 *
 * @param {string} requestId - Unique request identifier
 * @param {Array} experiments - Active experiments
 * @param {Object} context - Request context (spreadKey, provider)
 * @returns {Object|null} Assignment { experimentId, variantId, isControl }
 */
export function getABAssignment(requestId, experiments, context = {}) {
  if (!experiments || experiments.length === 0 || !requestId) {
    return null;
  }

  // Find first matching experiment
  for (const exp of experiments) {
    // Check targeting filters
    if (!matchesTargeting(exp, context)) {
      continue;
    }

    // Check if request falls in experiment traffic
    const hash = fnv1aHash(requestId + exp.experiment_id);
    const bucket = hash % 100;

    if (bucket >= exp.traffic_percentage) {
      continue; // Not in experiment traffic
    }

    // Assign to variant
    const allVariants = [exp.control_variant, ...exp.treatment_variants];
    const variantIndex = hash % allVariants.length;
    const variantId = allVariants[variantIndex];

    return {
      experimentId: exp.experiment_id,
      experimentName: exp.name,
      variantId,
      isControl: variantIndex === 0,
      bucket,
    };
  }

  return null;
}

/**
 * Check if request matches experiment targeting.
 */
function matchesTargeting(experiment, context) {
  // Check spread targeting
  if (experiment.spread_keys) {
    if (!context.spreadKey) {
      return false;
    }
    if (!experiment.spread_keys.includes(context.spreadKey)) {
      return false;
    }
  }

  // Check provider targeting
  if (experiment.providers) {
    if (!context.provider) {
      return false;
    }
    if (!experiment.providers.includes(context.provider)) {
      return false;
    }
  }

  return true;
}

/**
 * Get prompt overrides for a variant.
 *
 * This is where you define what each variant does differently.
 * Extend this as you create new experiments.
 *
 * @param {string} variantId - Variant identifier
 * @returns {Object|null} Prompt overrides or null for control
 */
export function getVariantPromptOverrides(variantId) {
  // Control gets no overrides
  if (!variantId || variantId === 'control') {
    return null;
  }

  // Define variant-specific overrides
  const VARIANT_OVERRIDES = {
    // Example: More concise readings
    'concise': {
      lengthModifier: 0.8, // 20% shorter
      systemPromptAddition: 'Keep your response concise and focused on key insights.',
    },

    // Example: More detailed readings
    'detailed': {
      lengthModifier: 1.2, // 20% longer
      includeMoreEsoteric: true,
      systemPromptAddition: 'Provide rich detail and explore symbolic connections deeply.',
    },

    // Example: More action-oriented
    'action-focused': {
      toneEmphasis: 'action',
      systemPromptAddition: 'Emphasize practical actions and concrete next steps.',
    },

    // Example: More reflective
    'reflective': {
      toneEmphasis: 'reflective',
      systemPromptAddition: 'Encourage deep reflection and introspection.',
    },
  };

  return VARIANT_OVERRIDES[variantId] || null;
}

/**
 * Record experiment assignment for tracking.
 *
 * @param {D1Database} db
 * @param {string} experimentId
 */
export async function recordExperimentAssignment(db, experimentId) {
  if (!db || !experimentId) return;

  try {
    await db.prepare(`
      UPDATE ab_experiments
      SET readings_in_experiment = readings_in_experiment + 1,
          last_reading_at = CURRENT_TIMESTAMP
      WHERE experiment_id = ?
    `).bind(experimentId).run();
  } catch (err) {
    console.warn('[ab] Failed to record assignment:', err.message);
  }
}

/**
 * Create a new experiment.
 *
 * @param {D1Database} db
 * @param {Object} experiment
 */
export async function createExperiment(db, experiment) {
  if (!db) throw new Error('DB binding required');

  const {
    experimentId,
    name,
    description = null,
    hypothesis = null,
    controlVariant = 'control',
    treatmentVariants = [],
    trafficPercentage = 10,
    spreadKeys = null,
    providers = null,
  } = experiment;

  const query = `
    INSERT INTO ab_experiments (
      experiment_id, name, description, hypothesis,
      control_variant, treatment_variants, traffic_percentage,
      spread_keys, providers, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;

  await db.prepare(query).bind(
    experimentId,
    name,
    description,
    hypothesis,
    controlVariant,
    JSON.stringify(treatmentVariants),
    trafficPercentage,
    spreadKeys ? JSON.stringify(spreadKeys) : null,
    providers ? JSON.stringify(providers) : null
  ).run();

  return { experimentId, status: 'draft' };
}

/**
 * Start an experiment.
 */
export async function startExperiment(db, experimentId) {
  if (!db) throw new Error('DB binding required');

  await db.prepare(`
    UPDATE ab_experiments
    SET status = 'running',
        started_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE experiment_id = ? AND status = 'draft'
  `).bind(experimentId).run();
}

/**
 * Stop an experiment.
 */
export async function stopExperiment(db, experimentId, status = 'completed') {
  if (!db) throw new Error('DB binding required');

  await db.prepare(`
    UPDATE ab_experiments
    SET status = ?,
        ended_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE experiment_id = ? AND status = 'running'
  `).bind(status, experimentId).run();
}

/**
 * Get experiment results summary.
 *
 * @param {D1Database} db
 * @param {string} experimentId
 */
export async function getExperimentResults(db, experimentId) {
  if (!db) throw new Error('DB binding required');

  // Get experiment details
  const experiment = await db.prepare(`
    SELECT * FROM ab_experiments WHERE experiment_id = ?
  `).bind(experimentId).first();

  if (!experiment) {
    return null;
  }

  // Get quality stats for this experiment's variants
  const stats = await db.prepare(`
    WITH variants AS (
      SELECT control_variant AS variant_id
      FROM ab_experiments
      WHERE experiment_id = ?
      UNION ALL
      SELECT json_each.value AS variant_id
      FROM ab_experiments, json_each(ab_experiments.treatment_variants)
      WHERE experiment_id = ?
    )
    SELECT
      variant_id,
      SUM(reading_count) as total_readings,
      AVG(avg_overall) as avg_overall,
      AVG(avg_personalization) as avg_personalization,
      AVG(avg_tarot_coherence) as avg_coherence,
      AVG(avg_tone) as avg_tone,
      AVG(avg_safety) as avg_safety,
      SUM(safety_flag_count) as safety_flags
    FROM quality_stats
    WHERE variant_id IN (SELECT variant_id FROM variants)
    GROUP BY variant_id
  `).bind(experimentId, experimentId).all();

  return {
    experiment: {
      ...experiment,
      treatment_variants: safeParseJSON(experiment.treatment_variants, []),
    },
    results: stats.results || [],
  };
}

/**
 * Safe JSON parse with fallback.
 */
function safeParseJSON(str, fallback) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}
