#!/usr/bin/env node
/**
 * Migrate eval_metrics payloads from v1 to v2 schema.
 *
 * This script reads existing metrics records, transforms them to the new
 * deduplicated schema (v2), and updates them in place.
 *
 * Usage:
 *   node scripts/migrations/migrateMetricsSchema.js [options]
 *
 * Options:
 *   --dry-run       Preview changes without writing (default: true)
 *   --apply         Actually apply the migration
 *   --batch-size=N  Number of records per batch (default: 100)
 *   --limit=N       Maximum records to migrate (default: all)
 *   --local         Use local D1 database
 *   --remote        Use remote D1 database (default)
 *
 * Environment:
 *   Requires wrangler CLI to be configured with access to the D1 database.
 */

import { executeD1Query } from '../lib/dataAccess.js';

// Import the migration function from telemetry schema
// We'll inline the migration logic here to avoid import issues with Workers modules
const SCHEMA_VERSION = 2;

/**
 * Build prompt telemetry from v1 promptMeta.
 */
function buildPromptTelemetry(promptMeta) {
  if (!promptMeta) return null;

  return {
    version: promptMeta.readingPromptVersion || null,
    tokens: promptMeta.estimatedTokens ? {
      system: promptMeta.estimatedTokens.system,
      user: promptMeta.estimatedTokens.user,
      total: promptMeta.estimatedTokens.total,
      budget: promptMeta.estimatedTokens.budget,
      hardCap: promptMeta.estimatedTokens.hardCap,
      budgetTarget: promptMeta.estimatedTokens.budgetTarget,
      overBudget: promptMeta.estimatedTokens.overBudget || false,
      truncated: promptMeta.estimatedTokens.truncated || false
    } : null,
    slimming: {
      enabled: promptMeta.slimmingEnabled || false,
      steps: promptMeta.slimmingSteps || []
    },
    options: promptMeta.appliedOptions ? {
      omitLowWeightImagery: promptMeta.appliedOptions.omitLowWeightImagery || false,
      includeForecast: promptMeta.appliedOptions.includeForecast || false,
      includeEphemeris: promptMeta.appliedOptions.includeEphemeris || false,
      // Note: includeGraphRAG removed - use graphRAG.includedInPrompt instead
      includeDeckContext: promptMeta.appliedOptions.includeDeckContext || false,
      includeDiagnostics: promptMeta.appliedOptions.includeDiagnostics || false
    } : null,
    truncation: promptMeta.truncation || null,
    hardCap: promptMeta.hardCap || null,
    context: promptMeta.context || null,
    ephemeris: promptMeta.ephemeris || null,
    forecast: promptMeta.forecast || null
  };
}

/**
 * Build GraphRAG telemetry from v1 stats.
 */
function buildGraphRAGTelemetry(graphRAGStats) {
  if (!graphRAGStats) return null;

  return {
    includedInPrompt: graphRAGStats.includedInPrompt || false,
    disabledByEnv: graphRAGStats.disabledByEnv || false,
    passagesProvided: graphRAGStats.passagesProvided || 0,
    passagesUsedInPrompt: graphRAGStats.passagesUsedInPrompt || 0,
    truncatedPassages: graphRAGStats.truncatedPassages || 0,
    skippedReason: graphRAGStats.skippedReason || null,
    semanticScoring: {
      requested: graphRAGStats.semanticScoringRequested || false,
      used: graphRAGStats.semanticScoringUsed || false,
      attempted: graphRAGStats.semanticScoringAttempted || false,
      fallback: graphRAGStats.semanticScoringFallback || false
    },
    patterns: graphRAGStats.patternsDetected ? {
      completeTriads: graphRAGStats.patternsDetected.completeTriads || 0,
      partialTriads: graphRAGStats.patternsDetected.partialTriads || 0,
      foolsJourneyStage: graphRAGStats.patternsDetected.foolsJourneyStage || null,
      totalMajors: graphRAGStats.patternsDetected.totalMajors || 0,
      highDyads: graphRAGStats.patternsDetected.highDyads || 0,
      mediumHighDyads: graphRAGStats.patternsDetected.mediumHighDyads || 0,
      strongSuitProgressions: graphRAGStats.patternsDetected.strongSuitProgressions || 0,
      emergingSuitProgressions: graphRAGStats.patternsDetected.emergingSuitProgressions || 0
    } : null,
    budgetTrimming: graphRAGStats.truncatedForBudget ? {
      trimmed: true,
      from: graphRAGStats.budgetTrimmedFrom,
      to: graphRAGStats.budgetTrimmedTo,
      strategy: graphRAGStats.budgetTrimmedStrategy || null
    } : null
  };
}

/**
 * Build narrative telemetry from v1 metrics.
 */
function buildNarrativeTelemetry(narrativeMetrics) {
  if (!narrativeMetrics) {
    return { spine: null, coverage: null };
  }

  return {
    spine: narrativeMetrics.spine ? {
      isValid: narrativeMetrics.spine.isValid,
      totalSections: narrativeMetrics.spine.totalSections || 0,
      completeSections: narrativeMetrics.spine.completeSections || 0,
      incompleteSections: narrativeMetrics.spine.incompleteSections || 0,
      cardSections: narrativeMetrics.spine.cardSections || 0,
      cardComplete: narrativeMetrics.spine.cardComplete || 0,
      cardIncomplete: narrativeMetrics.spine.cardIncomplete || 0,
      structuralSections: narrativeMetrics.spine.structuralSections || 0,
      suggestions: narrativeMetrics.spine.suggestions || []
    } : null,
    coverage: {
      cardCount: narrativeMetrics.cardCount || 0,
      percentage: narrativeMetrics.cardCoverage || 0,
      missingCards: narrativeMetrics.missingCards || [],
      hallucinatedCards: narrativeMetrics.hallucinatedCards || []
    }
  };
}

/**
 * Transform a v1 payload to v2 schema.
 */
function migratePayloadToV2(v1Payload) {
  if (!v1Payload) return null;

  // Already v2
  if (v1Payload.schemaVersion >= 2) {
    return v1Payload;
  }

  // Extract data from v1 locations
  const promptMeta = v1Payload.promptMeta || {};
  const graphRAGStats = v1Payload.promptMeta?.graphRAG ||
    v1Payload.graphRAG ||
    v1Payload.narrative?.graphRAG ||
    null;
  const narrativeMetrics = v1Payload.narrativeOriginal || v1Payload.narrative || {};

  return {
    schemaVersion: SCHEMA_VERSION,
    requestId: v1Payload.requestId,
    timestamp: v1Payload.timestamp,

    // Routing
    provider: v1Payload.provider,
    spreadKey: v1Payload.spreadKey,
    deckStyle: v1Payload.deckStyle,

    // Experiment
    experiment: {
      promptVersion: v1Payload.readingPromptVersion || promptMeta.readingPromptVersion || null,
      variantId: v1Payload.variantId || null,
      experimentId: v1Payload.experimentId || null
    },

    // Prompt
    prompt: buildPromptTelemetry(promptMeta),

    // GraphRAG (deduplicated)
    graphRAG: buildGraphRAGTelemetry(graphRAGStats),

    // Narrative (cleaned)
    narrative: buildNarrativeTelemetry(narrativeMetrics),

    // Vision (passthrough)
    vision: v1Payload.vision || null,

    // LLM Usage
    llmUsage: v1Payload.llmUsage || (v1Payload.tokens ? {
      inputTokens: v1Payload.tokens.input,
      outputTokens: v1Payload.tokens.output,
      totalTokens: v1Payload.tokens.total,
      source: v1Payload.tokens.source || 'api'
    } : null),

    // Diagnostics
    diagnostics: v1Payload.contextDiagnostics || null,

    // Eval gate
    evalGate: v1Payload.evalGate || { ran: false },

    // Conditional fields
    ...(v1Payload.backendErrors?.length > 0 ? { backendErrors: v1Payload.backendErrors } : {}),
    ...(v1Payload.enhancementTelemetry ? { enhancementTelemetry: v1Payload.enhancementTelemetry } : {}),
    ...(v1Payload.promptEngineering ? { promptEngineering: v1Payload.promptEngineering } : {})
  };
}

/**
 * Calculate approximate size reduction.
 */
function calculateSizeReduction(v1Payload, v2Payload) {
  const v1Size = JSON.stringify(v1Payload).length;
  const v2Size = JSON.stringify(v2Payload).length;
  return {
    v1Size,
    v2Size,
    reduction: v1Size - v2Size,
    percentReduction: ((v1Size - v2Size) / v1Size * 100).toFixed(1)
  };
}

function parseArgs(rawArgs = []) {
  const options = {
    dryRun: true,
    batchSize: 100,
    limit: null,
    target: 'remote',
    d1Name: 'mystic-tarot-db'
  };

  rawArgs.forEach((arg, index) => {
    if (arg === '--apply') {
      options.dryRun = false;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--batch-size=')) {
      options.batchSize = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--batch-size') {
      options.batchSize = parseInt(rawArgs[index + 1], 10);
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--limit') {
      options.limit = parseInt(rawArgs[index + 1], 10);
    } else if (arg === '--local') {
      options.target = 'local';
    } else if (arg === '--remote') {
      options.target = 'remote';
    } else if (arg.startsWith('--d1-name=')) {
      options.d1Name = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/migrations/migrateMetricsSchema.js [options]

Options:
  --dry-run       Preview changes without writing (default)
  --apply         Actually apply the migration
  --batch-size=N  Number of records per batch (default: 100)
  --limit=N       Maximum records to migrate (default: all)
  --local         Use local D1 database
  --remote        Use remote D1 database (default)
  --d1-name=NAME  D1 database name (default: mystic-tarot-db)
`);
      process.exit(0);
    }
  });

  return options;
}

async function countV1Records(options) {
  const query = `
    SELECT COUNT(*) as count
    FROM eval_metrics
    WHERE json_extract(payload, '$.schemaVersion') IS NULL
       OR json_extract(payload, '$.schemaVersion') < 2
  `;

  const result = await executeD1Query(query, [], {
    d1Name: options.d1Name,
    target: options.target
  });

  return result[0]?.count || 0;
}

async function fetchBatch(offset, batchSize, options) {
  const query = `
    SELECT request_id, payload
    FROM eval_metrics
    WHERE json_extract(payload, '$.schemaVersion') IS NULL
       OR json_extract(payload, '$.schemaVersion') < 2
    ORDER BY created_at ASC
    LIMIT ? OFFSET ?
  `;

  return executeD1Query(query, [batchSize, offset], {
    d1Name: options.d1Name,
    target: options.target
  });
}

async function updateRecord(requestId, newPayload, options) {
  const query = `
    UPDATE eval_metrics
    SET payload = ?,
        updated_at = datetime('now')
    WHERE request_id = ?
  `;

  return executeD1Query(query, [JSON.stringify(newPayload), requestId], {
    d1Name: options.d1Name,
    target: options.target
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log('=== Metrics Schema Migration ===\n');
  console.log(`Mode: ${options.dryRun ? 'DRY RUN (no changes)' : 'APPLY CHANGES'}`);
  console.log(`Target: ${options.target}`);
  console.log(`Batch size: ${options.batchSize}`);
  console.log(`Limit: ${options.limit || 'none'}\n`);

  // Count records to migrate
  const totalV1 = await countV1Records(options);
  console.log(`Found ${totalV1} records with v1 schema\n`);

  if (totalV1 === 0) {
    console.log('No records to migrate!');
    return;
  }

  const recordsToProcess = options.limit ? Math.min(totalV1, options.limit) : totalV1;

  let processed = 0;
  let migrated = 0;
  let errors = 0;
  let totalSizeReduction = 0;

  while (processed < recordsToProcess) {
    const batch = await fetchBatch(processed, options.batchSize, options);

    if (batch.length === 0) break;

    for (const row of batch) {
      try {
        const v1Payload = JSON.parse(row.payload);
        const v2Payload = migratePayloadToV2(v1Payload);

        if (!v2Payload) {
          console.warn(`  Skip ${row.request_id}: migration returned null`);
          errors++;
          continue;
        }

        const sizes = calculateSizeReduction(v1Payload, v2Payload);
        totalSizeReduction += sizes.reduction;

        if (!options.dryRun) {
          await updateRecord(row.request_id, v2Payload, options);
        }

        migrated++;

        if (migrated % 50 === 0) {
          console.log(`  Processed ${migrated}/${recordsToProcess} (${(migrated/recordsToProcess*100).toFixed(1)}%)`);
        }
      } catch (err) {
        console.error(`  Error migrating ${row.request_id}: ${err.message}`);
        errors++;
      }
    }

    processed += batch.length;
  }

  console.log('\n=== Migration Summary ===\n');
  console.log(`Total processed: ${processed}`);
  console.log(`Successfully migrated: ${migrated}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total size reduction: ${(totalSizeReduction / 1024).toFixed(2)} KB`);
  console.log(`Average reduction per record: ${migrated > 0 ? (totalSizeReduction / migrated).toFixed(0) : 0} bytes`);

  if (options.dryRun) {
    console.log('\n⚠️  This was a DRY RUN. No changes were made.');
    console.log('    Run with --apply to perform the actual migration.');
  } else {
    console.log('\n✅ Migration complete!');
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
