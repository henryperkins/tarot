import assert from 'node:assert/strict';
import { test } from 'node:test';
import { main } from '../scripts/evaluation/qualifyEvaluators.js';

test('qualification CLI imports without side effects and defaults to offline planning', async () => {
  const result = await main([], {});
  assert.equal(result.mode, 'dry-run');
  assert.equal(result.requestsUsed, 0);
  assert.equal(result.qualified, false);
  assert.ok(result.plannedRequests > result.hardRequestCap); // full corpus requires explicit bounded batches.
});

test('CLI rejects unbounded live runs and invalid corpus IDs before credential access', async () => {
  const environment = new Proxy({}, { get() { throw new Error('Credentials must not be accessed'); } });
  await assert.rejects(main(['--live'], environment), /request cap/);
  await assert.rejects(main(['--live', '--max-requests', '100'], environment), /request cap/);
  await assert.rejects(main(['--cases', 'missing'], environment), /corpus case/);
});
