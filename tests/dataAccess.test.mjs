import assert from 'node:assert/strict';
import { test } from 'node:test';

import { runWranglerCommand } from '../scripts/lib/dataAccess.js';

test('runWranglerCommand runs the local wrangler binary', async () => {
  process.env.WRANGLER_SEND_METRICS = 'false';
  // Spawning `npx` directly fails on Windows, where it is a .cmd shim.
  const output = await runWranglerCommand(['wrangler', '--version']);

  assert.match(output, /\d+\.\d+\.\d+/);
});
