import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parseEnv } from 'node:util';
import { CLAUDE_CODE_DEFAULT_PORT } from '../services/claude-code/server.mjs';
import { CODEX_SUBSCRIPTION_DEFAULT_PORT } from '../services/codex-subscription/server.mjs';

// Compare the documented defaults without binding them: a live gateway on the
// developer's machine may own either port.
const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');
const gateways = [
  { name: 'claude-code', prefix: 'CLAUDE_CODE', port: CLAUDE_CODE_DEFAULT_PORT, runbook: 'docs/claude-subscription.md' },
  { name: 'codex-subscription', prefix: 'CODEX_SUBSCRIPTION', port: CODEX_SUBSCRIPTION_DEFAULT_PORT, runbook: 'docs/codex-subscription.md' }
];

test('the standalone subscription gateways can start together on their defaults', () => {
  for (const { port } of gateways) assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535);
  assert.notEqual(CLAUDE_CODE_DEFAULT_PORT, CODEX_SUBSCRIPTION_DEFAULT_PORT);
});

for (const { name, prefix, port, runbook } of gateways) {
  test(`${name} example settings and runbook use its default port`, async () => {
    const example = parseEnv(await read(`services/${name}/example.env`));
    assert.equal(example[`${prefix}_PORT`], String(port));
    // The Worker reaches the gateway at the address its runbook gives for .dev.vars.
    const guide = await read(runbook);
    assert.match(guide, new RegExp(`^${prefix}_GATEWAY_URL=http://127\\.0\\.0\\.1:${port}$`, 'm'));
    const loopbackPorts = [...guide.matchAll(/127\.0\.0\.1:(\d+)/g)].map(match => Number(match[1]));
    assert.deepEqual([...new Set(loopbackPorts)], [port]);
  });
}
