/**
 * Test the quality analysis aggregation and storage logic
 */
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';

// Mock D1 database
function createMockDB(aggregates = []) {
  const statements = [];
  return {
    prepare: (sql) => {
      const stmt = {
        sql,
        bindings: [],
        bind: (...args) => {
          stmt.bindings = args;
          return stmt;
        },
        all: async () => {
          statements.push({ type: 'all', sql: stmt.sql, bindings: stmt.bindings });
          return { results: aggregates };
        },
        run: async () => {
          statements.push({ type: 'run', sql: stmt.sql, bindings: stmt.bindings });
          return { meta: { rows_written: 1 } };
        },
        first: async () => {
          statements.push({ type: 'first', sql: stmt.sql, bindings: stmt.bindings });
          return null;
        }
      };
      return stmt;
    },
    _statements: statements
  };
}

// Import the functions (we'll need to handle the import path)
const { 
  computeDailyAggregates,
  DEFAULT_THRESHOLDS,
  storeQualityStats,
  runQualityAnalysis,
  getBaseline,
  detectRegressions
} = await import('../functions/lib/qualityAnalysis.js');

describe('Quality Analysis', () => {
  describe('computeDailyAggregates', () => {
    it('should return aggregates from DB', async () => {
      const mockAggregates = [
        {
          reading_prompt_version: '1.1.0',
          eval_prompt_version: '2.2.0',
          variant_id: null,
          provider: 'azure-gpt5',
          spread_key: 'decision',
          reading_count: 3,
          eval_count: 0,
          heuristic_count: 0,
          error_count: 3,
          avg_overall: null,
          avg_personalization: null,
          avg_tarot_coherence: null,
          avg_tone: null,
          avg_safety: null,
          safety_flag_count: 0,
          low_tone_count: 0,
          low_safety_count: 0,
          avg_card_coverage: 0.95,
          hallucination_count: 0
        }
      ];
      
      const db = createMockDB(mockAggregates);
      const result = await computeDailyAggregates(db, '2026-01-16');
      
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].reading_count, 3);
      assert.strictEqual(result[0].provider, 'azure-gpt5');
    });

    it('should return empty array on error', async () => {
      const db = {
        prepare: () => ({
          bind: () => ({
            all: async () => { throw new Error('DB error'); }
          })
        })
      };
      
      const result = await computeDailyAggregates(db, '2026-01-16');
      assert.deepStrictEqual(result, []);
    });
  });

  describe('storeQualityStats', () => {
    it('should insert aggregate into quality_stats', async () => {
      const db = createMockDB();
      const agg = {
        reading_prompt_version: '1.1.0',
        eval_prompt_version: '2.2.0',
        variant_id: null,
        provider: 'azure-gpt5',
        spread_key: 'decision',
        reading_count: 3,
        eval_count: 0,
        heuristic_count: 0,
        error_count: 3,
        avg_overall: 4.2,
        avg_personalization: 4.0,
        avg_tarot_coherence: 4.5,
        avg_tone: 4.3,
        avg_safety: 4.8,
        safety_flag_count: 0,
        low_tone_count: 0,
        low_safety_count: 0,
        avg_card_coverage: 0.95,
        hallucination_count: 0
      };
      
      await storeQualityStats(db, '2026-01-16', agg, null);
      
      const insertStmt = db._statements.find(s => s.sql.includes('INSERT'));
      assert.ok(insertStmt, 'Should have an INSERT statement');
      assert.ok(insertStmt.bindings.includes('2026-01-16'), 'Should include date');
      assert.ok(insertStmt.bindings.includes('azure-gpt5'), 'Should include provider');
    });
  });

  describe('runQualityAnalysis', () => {
    it('should skip if no DB', async () => {
      const env = { DB: null };
      const result = await runQualityAnalysis(env, '2026-01-16');
      
      assert.strictEqual(result.skipped, true);
      assert.strictEqual(result.reason, 'no_db');
    });

    it('should return empty results if no aggregates', async () => {
      const db = createMockDB([]);
      const env = { 
        DB: db,
        QUALITY_REGRESSION_THRESHOLD: '-0.3',
        QUALITY_SAFETY_SPIKE_THRESHOLD: '0.02',
        QUALITY_ALERT_MIN_READINGS: '20'
      };
      
      const result = await runQualityAnalysis(env, '2026-01-16');
      
      assert.strictEqual(result.aggregates, 0);
      assert.deepStrictEqual(result.alerts, []);
    });

    it('should process and store aggregates', async () => {
      const mockAggregates = [
        {
          reading_prompt_version: '1.1.0',
          eval_prompt_version: '2.2.0',
          variant_id: null,
          provider: 'azure-gpt5',
          spread_key: 'decision',
          reading_count: 25,
          eval_count: 5,
          heuristic_count: 0,
          error_count: 20,
          avg_overall: 4.2,
          avg_personalization: 4.0,
          avg_tarot_coherence: 4.5,
          avg_tone: 4.3,
          avg_safety: 4.8,
          safety_flag_count: 0,
          low_tone_count: 0,
          low_safety_count: 0,
          avg_card_coverage: 0.95,
          hallucination_count: 0
        }
      ];
      
      const db = createMockDB(mockAggregates);
      const env = { 
        DB: db,
        QUALITY_REGRESSION_THRESHOLD: '-0.3',
        QUALITY_SAFETY_SPIKE_THRESHOLD: '0.02',
        QUALITY_ALERT_MIN_READINGS: '20'
      };
      
      const result = await runQualityAnalysis(env, '2026-01-16');
      
      assert.strictEqual(result.aggregates, 1);
      assert.strictEqual(result.stored, 1);
      
      // Verify INSERT was called
      const insertStmts = db._statements.filter(s => s.sql.includes('INSERT') && s.sql.includes('quality_stats'));
      assert.strictEqual(insertStmts.length, 1, 'Should have one INSERT into quality_stats');
    });
  });

  describe('detectRegressions', () => {
    it('skips eval-based alerts when eval samples are below threshold', () => {
      const aggregates = [{
        reading_prompt_version: '1.0.0',
        eval_prompt_version: '2.0.0',
        variant_id: null,
        provider: 'azure',
        spread_key: 'threeCard',
        reading_count: 50,
        eval_count: 2,
        heuristic_count: 0,
        error_count: 48,
        avg_overall: 2.0,
        avg_personalization: 2.0,
        avg_tarot_coherence: 2.0,
        avg_tone: 2.0,
        avg_safety: 2.0,
        safety_flag_count: 1,
        low_tone_count: 1,
        low_safety_count: 1,
        avg_card_coverage: 0.9,
        hallucination_count: 0
      }];
      const key = '1.0.0:null:threeCard:azure';
      const baselines = new Map([
        [key, { overall: 4.0, coverage: 0.9, safety_flag_rate: 0, low_tone_rate: 0 }]
      ]);

      const alerts = detectRegressions(aggregates, baselines, DEFAULT_THRESHOLDS, { minReadings: 10 });
      assert.strictEqual(alerts.length, 0);
    });

    it('still evaluates coverage alerts using reading_count', () => {
      const aggregates = [{
        reading_prompt_version: '1.0.0',
        eval_prompt_version: '2.0.0',
        variant_id: null,
        provider: 'azure',
        spread_key: 'threeCard',
        reading_count: 50,
        eval_count: 2,
        heuristic_count: 0,
        error_count: 48,
        avg_overall: 2.0,
        avg_personalization: 2.0,
        avg_tarot_coherence: 2.0,
        avg_tone: 2.0,
        avg_safety: 2.0,
        safety_flag_count: 0,
        low_tone_count: 0,
        low_safety_count: 0,
        avg_card_coverage: 0.6,
        hallucination_count: 0
      }];
      const key = '1.0.0:null:threeCard:azure';
      const baselines = new Map([
        [key, { overall: 4.0, coverage: 0.9, safety_flag_rate: 0, low_tone_rate: 0 }]
      ]);

      const alerts = detectRegressions(aggregates, baselines, DEFAULT_THRESHOLDS, { minReadings: 10 });
      assert.ok(alerts.some((alert) => alert.metric === 'card_coverage'));
    });
  });
});
