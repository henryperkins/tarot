import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { createMySqlD1 } from './spacefastDatabaseHarness.mjs';

// Exercise the complete Worker graph in workerd. The test broker uses a real
// isolated MySQL instance; it does not establish Spacefast's broker contract.
async function runtime(t, native) {
  const result = await build({
    stdin: {
      contents: `import worker from './spacefast/entry.js';
        function database(env) {
          async function execute(body) {
            const response = await env.TEST_DATABASE.fetch(new Request('https://database.invalid', {
              method:'POST', body:JSON.stringify(body), headers:{'Content-Type':'application/json'}
            }));
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            return result;
          }
          function prepare(sql, values=[]) {
            return {sql,values,bind(...bound){return prepare(sql,bound)},
              all(){return execute({statements:[{sql,values}],batch:false})},
              run(){return this.all()},
              async first(column){const row=(await this.all()).results[0]??null;return column===undefined||row===null?row:row[column]}
            };
          }
          return {prepare,batch(statements){return execute({statements,batch:true})}};
        }
        export default {fetch(request,env,ctx){return worker.fetch(request,{...env,DB:database(env)},ctx)}};`,
      resolveDir: new URL('../', import.meta.url).pathname,
      sourcefile: 'spacefast-runtime-test-entry.js',
    },
    write: false, bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
    external: ['cloudflare:*', 'node:*'],
    plugins: [{ name: 'test-build', setup(builder) {
      builder.onResolve({ filter: /^tableu:spacefast-build$/ }, () => ({ path: 'build', namespace: 'tableu-test' }));
      builder.onLoad({ filter: /.*/, namespace: 'tableu-test' }, () => ({
        contents: 'export const html="<!doctype html><html><head><title>Tableu runtime test</title></head><body>Tableu runtime test</body></html>";export const defaults={};export const revision="test-build";', loader: 'js',
      }));
    } }],
  });
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: result.outputFiles[0].text,
    compatibilityDate: '2026-07-01', compatibilityFlags: ['nodejs_compat'],
    bindings: { ADMIN_API_KEY: 'test-admin-key', TABLEU_CRON_SECRET: 'test_cron_secret_that_is_at_least_32_chars' },
    serviceBindings: { TEST_DATABASE: async request => {
      try {
        const body = await request.json();
        const statements = body.statements.map(({ sql, values }) => native.prepare(sql).bind(...values));
        return Response.json(body.batch ? await native.batch(statements) : await statements[0].all());
      } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
    } },
  }));
  t.after(() => mf.dispose());
  return (path, options) => mf.dispatchFetch(`https://tableu.example.invalid${path}`, options);
}

test('Spacefast entry preserves route precedence and rejects spoofed cron authentication', async t => {
  const native = { prepare() { return { bind() { return this; }, async all() { return { success: true, results: [{ ok: 1, version: '8.4-test' }], meta: { changes: 0, last_row_id: 0 } }; } }; } };
  const fetch = await runtime(t, native);
  const health = await fetch('/api/health/runtime');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok', runtime: 'spacefast', revision: 'test-build', database: 'ok', dialect: 'mysql', backgroundTasks: true });
  for (const path of ['/', '/journal', '/account']) {
    const response = await fetch(path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('Content-Type'), /text\/html/);
    assert.match(await response.text(), /Tableu runtime test/);
  }
  assert.equal((await fetch('/assets/missing.js')).status, 404);
  const missingApi = await fetch('/api/not-a-route');
  assert.equal(missingApi.status, 404);
  assert.match(missingApi.headers.get('Content-Type'), /json/);
  const oauth = await fetch('/.well-known/oauth-authorization-server');
  assert.equal(oauth.status, 200);
  assert.equal((await oauth.json()).issuer, 'https://tableu.example.invalid');
  const cron = await fetch('/api/maintenance/spacefast/video', { headers: { 'x-spacefast-cron': '1' } });
  assert.equal(cron.status, 401);
  const method = await fetch('/api/maintenance/spacefast/video', { method: 'POST', headers: { Authorization: 'Bearer test-admin-key' } });
  assert.equal(method.status, 405);
  const retired = await fetch('/api/maintenance/spacefast/video', { headers: { Authorization: 'Bearer test-admin-key' } });
  assert.equal(retired.status, 410);
  assert.equal((await retired.json()).status, 'retired');
});

test('Spacefast full runtime registers, authenticates and isolates journals on MySQL', { skip: !process.env.TABLEU_TEST_MYSQL_PORT }, async t => {
  const native = await createMySqlD1();
  const createdUsers = [];
  t.after(async () => {
    for (const id of createdUsers) await native.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
    await native.close();
  });
  const fetch = await runtime(t, native);
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  const credentials = { email: `sf_runtime_${suffix}@example.com`, username: `sf_runtime_${suffix}`, password: 'runtime-test-password' };
  const json = (body, cookie) => ({ method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) } });
  const registered = await fetch('/api/auth/register', json(credentials));
  const registration = await registered.json();
  assert.equal(registered.status, 201, JSON.stringify(registration));
  createdUsers.push(registration.user.id);
  const cookie = registered.headers.get('Set-Cookie').split(';')[0];
  const me = await fetch('/api/auth/me', { headers: { Cookie: cookie } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.id, registration.user.id);
  const unauthenticated = await fetch('/api/journal');
  assert.equal(unauthenticated.status, 401);
  assert.equal((await fetch('/api/journal', { headers: { Cookie: cookie } })).status, 403);
  // Change only the disposable fixture's tier; the runtime still resolves
  // entitlement from its real database on every authenticated request.
  await native.prepare("UPDATE users SET subscription_tier = 'plus', subscription_status = 'active' WHERE id = ?").bind(registration.user.id).run();
  const journal = await fetch('/api/journal', { headers: { Cookie: cookie } });
  const initial = await journal.json();
  assert.equal(journal.status, 200, JSON.stringify(initial));
  assert.equal(initial.entries.length, 0);
  const saved = await fetch('/api/journal', json({
    spread: 'Single Card', spreadKey: 'single', question: 'Runtime integration fixture',
    cards: [{ name: 'The Fool', position: 'Focus', orientation: 'upright' }],
    sessionSeed: suffix,
  }, cookie));
  const entry = await saved.json();
  assert.equal(saved.status, 201, JSON.stringify(entry));
  const duplicate = await fetch('/api/journal', json({ spread: 'Single Card', spreadKey: 'single', cards: [], sessionSeed: suffix }, cookie));
  assert.equal((await duplicate.json()).entry.id, entry.entry.id);
  const listed = await fetch('/api/journal?includeFollowups=true', { headers: { Cookie: cookie } });
  const entries = await listed.json();
  assert.equal(listed.status, 200, JSON.stringify(entries));
  assert.equal(entries.entries.length, 1);
  assert.equal(entries.entries[0].id, entry.entry.id);
  const shared = await fetch('/api/share', json({ scope: 'entry', entryIds: [entry.entry.id], title: 'Runtime fixture' }, cookie));
  const share = await shared.json();
  assert.equal(shared.status, 201, JSON.stringify(share));
  const sharePage = await fetch(`/share/${share.token}`);
  assert.equal(sharePage.status, 200);
  assert.match(await sharePage.text(), /Runtime fixture/);
  const login = await fetch('/api/auth/login', json({ email: credentials.email, password: credentials.password }));
  assert.equal(login.status, 200, await login.text());
  assert.ok(login.headers.get('Set-Cookie'));
  const logout = await fetch('/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } });
  assert.equal(logout.status, 200);
  const afterLogout = await fetch('/api/auth/me', { headers: { Cookie: cookie } });
  assert.equal(afterLogout.status, 401);
});
