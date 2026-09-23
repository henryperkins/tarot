import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('identity check compares the personal bearer to the app session and never writes or prints credentials', async t => {
  let appUserId = 'owner';
  let authProvider = 'api_key';
  const requests = [];
  const server = createServer((req, res) => {
    requests.push([req.method, req.url]);
    const cookieRequest = req.headers.cookie === 'session=private-session-fixture';
    assert.ok(cookieRequest || req.headers.authorization === 'Bearer private-key-fixture');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ user: { id: cookieRequest ? appUserId : 'owner', auth_provider: cookieRequest ? 'password' : authProvider } }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  for (const scenario of ['matching', 'wrong-app-account', 'synthetic']) {
    appUserId = scenario === 'wrong-app-account' ? 'someone-else' : 'owner';
    authProvider = scenario === 'synthetic' ? 'service' : 'api_key';
    const proc = spawn(process.execPath, ['scripts/verify-identity.js'], {
      cwd: new URL('..', import.meta.url), windowsHide: true,
      env: { ...process.env, TABLEAU_BASE_URL: `http://127.0.0.1:${server.address().port}`,
        TABLEAU_API_KEY: 'private-key-fixture', TABLEAU_OWNER_USER_ID: 'owner',
        TABLEAU_APP_SESSION_TOKEN: 'private-session-fixture' }
    });
    let output = '';
    proc.stdout.on('data', chunk => { output += chunk; });
    proc.stderr.on('data', chunk => { output += chunk; });
    const [exitCode] = await once(proc, 'close');
    assert.equal(exitCode, scenario === 'matching' ? 0 : 1, output);
    assert.doesNotMatch(output, /private-(key|session)-fixture/);
    if (scenario === 'matching') assert.equal(JSON.parse(output).sameUserId, true);
    else assert.match(output, /Identity verification failed/);
  }
  assert.ok(requests.length >= 5);
  assert.ok(requests.every(([method, url]) => method === 'GET' && url === '/api/auth/me'));
});
