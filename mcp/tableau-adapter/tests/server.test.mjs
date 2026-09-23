import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const OWNER_TOKEN = 'test-owner-access-012345678901234567890123456789';
async function adapter(t, overrides = {}) {
  const backend = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/metadata') {
      res.end(JSON.stringify({ issuer: base, authorization_endpoint: `${base}/authorize`, token_endpoint: `${base}/token`, introspection_endpoint: `${base}/introspect` }));
    } else if (req.url === '/introspect') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const token = new URLSearchParams(body).get('token');
        res.end(JSON.stringify({ active: token !== 'inactive', sub: token === 'owner' ? 'owner-subject' : 'other-subject', aud: 'urn:tableu:test', exp: Math.floor(Date.now() / 1000) + 600 }));
      });
    } else if (req.url === '/api/auth/me') {
      res.end(JSON.stringify({ user: { id: 'owner-user', auth_provider: 'api_key' } }));
    } else if (req.url === '/api/tarot-reading/jobs') {
      res.end(JSON.stringify({ jobId: 'job-1', jobToken: 'private-job-token', status: 'queued' }));
    } else if (req.url.endsWith('/cancel')) {
      res.end(JSON.stringify({ status: 'cancelled', jobId: 'job-1' }));
    } else {
      res.end(JSON.stringify({ status: 'complete', reading: 'A finished narrative' }));
    }
  });
  backend.listen(0, '127.0.0.1');
  await once(backend, 'listening');
  const base = `http://127.0.0.1:${backend.address().port}`;
  const portProbe = createServer();
  portProbe.listen(0, '127.0.0.1');
  await once(portProbe, 'listening');
  const port = portProbe.address().port;
  await new Promise(resolve => portProbe.close(resolve));
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: new URL('..', import.meta.url), windowsHide: true,
    env: { ...process.env, PORT: String(port), ADAPTER_BIND_HOST: '127.0.0.1',
      TABLEAU_BASE_URL: base, TABLEAU_API_KEY: 'personal-key', TABLEAU_OWNER_USER_ID: 'owner-user',
      ADAPTER_OWNER_TOKEN: OWNER_TOKEN, OAUTH_ENABLED: 'false',
      OAUTH_METADATA_URL: `${base}/metadata`, OAUTH_AUDIENCE: 'urn:tableu:test', OAUTH_OWNER_SUBJECT: 'owner-subject', ...overrides }
  });
  let output = '';
  proc.stdout.on('data', chunk => { output += chunk; });
  proc.stderr.on('data', chunk => { output += chunk; });
  t.after(async () => {
    proc.kill();
    if (proc.exitCode === null) await once(proc, 'exit');
    backend.closeAllConnections();
    await new Promise(resolve => backend.close(resolve));
  });
  const url = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (proc.exitCode !== null) return { exited: true, output };
    try { if ((await fetch(url)).ok) return { url, proc }; } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Adapter failed to start: ${output}`);
}

async function client(t, url, token) {
  const client = new Client({ name: 'private-owner', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(`${url}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } });
  await client.connect(transport);
  t.after(() => client.close());
  return { client, transport };
}

test('private HTTP MCP rejects anonymous access and retains all four job tools beside writes', async t => {
  const { url } = await adapter(t);
  for (const method of ['POST', 'GET', 'DELETE']) {
    assert.equal((await fetch(`${url}/mcp`, { method, headers: { Authorization: 'Bearer wrong-owner' } })).status, 401);
  }
  const { client: mcp } = await client(t, url, OWNER_TOKEN);
  const names = (await mcp.listTools()).tools.map(tool => tool.name);
  assert.equal(names.length, 7);
  for (const name of ['start_tarot_reading', 'get_tarot_reading_status', 'wait_for_tarot_reading', 'cancel_tarot_reading', 'drawTarotReading', 'saveReadingToJournal', 'addReflectionToJournalEntry']) assert.ok(names.includes(name), name);
  const started = await mcp.callTool({ name: 'start_tarot_reading', arguments: { spreadInfo: { name: 'Single' }, cardsInfo: [{ position: 'Focus', card: 'The Star', meaning: 'Hope', orientation: 'Upright' }] } });
  assert.equal(started.structuredContent.jobId, 'job-1');
  for (const name of ['get_tarot_reading_status', 'wait_for_tarot_reading']) {
    const result = await mcp.callTool({ name, arguments: { jobId: 'job-1', jobToken: 'private-job-token' } });
    assert.equal(result.structuredContent.status, 'complete');
  }
  assert.equal((await mcp.callTool({ name: 'cancel_tarot_reading', arguments: { jobId: 'job-1', jobToken: 'private-job-token' } })).structuredContent.status, 'cancelled');
});

test('OAuth permits only the pinned owner subject, including access to an existing session', async t => {
  const { url } = await adapter(t, { OAUTH_ENABLED: 'true' });
  const { transport } = await client(t, url, 'owner');
  const response = await fetch(`${url}/mcp`, { headers: { Authorization: 'Bearer another-user', 'Mcp-Session-Id': transport.sessionId } });
  assert.equal(response.status, 403);
});

test('startup fails closed without owner access authentication or matching backend identity', async t => {
  for (const overrides of [{ ADAPTER_OWNER_TOKEN: '' }, { TABLEAU_OWNER_USER_ID: 'synthetic-or-wrong' }, { OAUTH_ENABLED: 'true', OAUTH_OWNER_SUBJECT: '' }]) {
    const result = await adapter(t, overrides);
    assert.equal(result.exited, true);
  }
});
