import { test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { preflightRealProProbes } from '../scripts/lib/readingCueProProbe.mjs';
import { openCueRoundBudget } from '../scripts/evaluation/lib/visualCueEvaluationBudget.mjs';

// Real Pro application corroboration (remediation Task 8): fresh, nonmocked and
// provenance-linked, or explicitly skipped. Controlled fixtures are never
// relabelled as real-provider evidence. The preflight starts no server and makes
// no generation call; any missing requirement keeps every probe skipped.
const preflight = await preflightRealProProbes({ openBudget: openCueRoundBudget });
const skipRecord = process.env.CUE_REAL_PRO_SKIP_RECORD;

test.describe('real Pro application probes', () => {
  // The skip is decided inside the test: a describe-level skip lets Playwright skip
  // the whole job before any worker loads this file, so the record would never be
  // written. The test requests no fixtures, so skipping here launches no browser.
  test('fresh three- and five-card RWS readings stream real cues through the ordinary application', async () => {
    if (!preflight.allowed) {
      if (skipRecord && path.isAbsolute(skipRecord)) {
        await writeFile(skipRecord, `${JSON.stringify({ skipped: true, reasons: preflight.reasons,
          completeStreamingCoverage: false, recordedAt: new Date().toISOString() }, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
          .catch(error => { if (error.code !== 'EEXIST') throw error; });
      }
      test.skip(true, `Skipped before any generation call: ${preflight.reasons.join(', ')}`);
    }
    // Even a complete preflight cannot run an unreviewed live procedure.
    throw new Error('The real Pro probe procedure is not part of this offline revision; implement and independently review it under the explicitly authorized live scope first.');
  });
});
