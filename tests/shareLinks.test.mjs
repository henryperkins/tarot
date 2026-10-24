// Share-link management: the journal finds, renames and revokes links through
// GET /api/share, PATCH and DELETE /api/share/:token, against real SQLite.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedEntry, seedSession, seedUser } from './helpers/journalFixtures.mjs';
import { onRequestGet as listShares, onRequestPost as createShare } from '../functions/api/share.js';
import {
  onRequestDelete as deleteShare,
  onRequestGet as openShare,
  onRequestPatch as renameShare
} from '../functions/api/share/[token].js';
import { normalizeShareTitle } from '../functions/lib/shareUtils.js';

function request(path, { method = 'GET', session = 'session-owner', body } = {}) {
  return new Request(`https://example.test${path}`, {
    method,
    headers: {
      ...(session ? { Cookie: `session=${session}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) })
  });
}

async function fixture(t) {
  const db = await createD1();
  t.after(() => db.sqlite.close());
  await seedUser(db, { id: 'owner', tier: 'plus' });
  await seedUser(db, { id: 'other', tier: 'plus' });
  await seedSession(db, { id: 'session-owner', userId: 'owner' });
  await seedSession(db, { id: 'session-other', userId: 'other' });
  for (const id of ['entry-a', 'entry-b', 'entry-c']) await seedEntry(db, { id, userId: 'owner' });
  const env = { DB: db };
  const create = async (body, session = 'session-owner') => {
    const response = await createShare({ request: request('/api/share', { method: 'POST', body, session }), env });
    assert.equal(response.status, 201);
    return response.json();
  };
  const list = async (session = 'session-owner') => {
    const response = await listShares({ request: request('/api/share', { session }), env });
    assert.equal(response.status, 200);
    return (await response.json()).shares;
  };
  return { db, env, create, list };
}

test('the share list names the readings each link shares, in link order', async (t) => {
  const { create, list } = await fixture(t);
  const single = await create({ scope: 'entry', entryIds: ['entry-b'] });
  const snapshot = await create({ scope: 'journal', entryIds: ['entry-c', 'entry-a'], title: 'Autumn readings' });

  const shares = await list();
  const byToken = new Map(shares.map((share) => [share.token, share]));
  assert.deepEqual(byToken.get(single.token).entryIds, ['entry-b']);
  assert.equal(byToken.get(single.token).title, 'Shared reading');
  assert.equal(byToken.get(single.token).hasCustomTitle, false);
  assert.deepEqual(byToken.get(snapshot.token).entryIds, ['entry-c', 'entry-a']);
  assert.equal(byToken.get(snapshot.token).title, 'Autumn readings');
  assert.equal(byToken.get(snapshot.token).hasCustomTitle, true);

  // The entry menu's filter (ShareLinksPanel) now finds the single-reading link.
  const forEntry = shares.filter((link) => link.scope === 'entry' && link.entryIds.includes('entry-b'));
  assert.deepEqual(forEntry.map((link) => link.token), [single.token]);
});

test('another account sees none of the owner’s links', async (t) => {
  const { create, list } = await fixture(t);
  await create({ scope: 'entry', entryIds: ['entry-a'] });
  assert.deepEqual(await list('session-other'), []);
});

test('every owner link remains reachable across pages, including tied timestamps', async (t) => {
  const { db, env } = await fixture(t);
  for (let index = 0; index < 55; index += 1) {
    const token = `share-${String(index).padStart(3, '0')}`;
    await db.prepare("INSERT INTO share_tokens (token, user_id, scope, created_at) VALUES (?, 'owner', 'entry', 1790000000)")
      .bind(token).run();
    await db.prepare("INSERT INTO share_token_entries (token, entry_id, sort_index) VALUES (?, 'entry-a', 0)")
      .bind(token).run();
  }
  const all = [];
  let cursor = null;
  do {
    const response = await listShares({ request: request(cursor ? `/api/share?${new URLSearchParams({ cursor })}` : '/api/share'), env });
    assert.equal(response.status, 200);
    const page = await response.json();
    assert.ok(page.shares.length <= 50);
    all.push(...page.shares);
    cursor = page.nextCursor;
  } while (cursor != null);
  assert.equal(all.length, 55);
  assert.equal(new Set(all.map(link => link.token)).size, 55);
  assert.ok(all.every(link => link.entryIds[0] === 'entry-a'));
});

test('deleting a first-page link between page requests does not hide an older link', async (t) => {
  const { db, env } = await fixture(t);
  for (let index = 0; index < 51; index += 1) {
    const token = `concurrent-${String(index).padStart(3, '0')}`;
    await db.prepare("INSERT INTO share_tokens (token, user_id, scope, created_at) VALUES (?, 'owner', 'entry', 1790000000)")
      .bind(token).run();
    await db.prepare("INSERT INTO share_token_entries (token, entry_id, sort_index) VALUES (?, 'entry-a', 0)").bind(token).run();
  }
  const first = await (await listShares({ request: request('/api/share'), env })).json();
  await db.prepare("DELETE FROM share_tokens WHERE token = 'concurrent-050'").run();
  const second = await (await listShares({ request: request(`/api/share?${new URLSearchParams({ cursor: first.nextCursor })}`), env })).json();
  assert.deepEqual(second.shares.map(link => link.token), ['concurrent-000']);
});

test('the owner renames a link; a blank title restores the default', async (t) => {
  const { env, create, list } = await fixture(t);
  const { token } = await create({ scope: 'entry', entryIds: ['entry-a'] });
  const rename = (body, session = 'session-owner') => renameShare({
    request: request(`/api/share/${token}`, { method: 'PATCH', body, session }),
    env,
    params: { token }
  });

  const renamed = await rename({ title: '  For   Sam\non Sunday  ' });
  assert.equal(renamed.status, 200);
  assert.deepEqual(await renamed.json(), { token, title: 'For Sam on Sunday', hasCustomTitle: true });
  assert.equal((await list())[0].title, 'For Sam on Sunday');

  // Link previews and the shared page use the new title.
  const opened = await openShare({ request: request(`/api/share/${token}`, { session: null }), env, params: { token } });
  assert.equal((await opened.json()).title, 'For Sam on Sunday');

  const cleared = await rename({ title: '   ' });
  assert.deepEqual(await cleared.json(), { token, title: 'Shared reading', hasCustomTitle: false });
  const reset = await rename({ title: null });
  assert.equal(reset.status, 200);
  assert.equal((await list())[0].hasCustomTitle, false);
});

test('renaming rejects other accounts, missing links, bad bodies and signed-out callers', async (t) => {
  const { env, create, list } = await fixture(t);
  const { token } = await create({ scope: 'entry', entryIds: ['entry-a'], title: 'Original' });
  const rename = (body, { session = 'session-owner', target = token } = {}) => renameShare({
    request: request(`/api/share/${target}`, { method: 'PATCH', body, session }),
    env,
    params: { token: target }
  });

  assert.equal((await rename({ title: 'Mine now' }, { session: 'session-other' })).status, 403);
  assert.equal((await rename({ title: 'Ghost' }, { target: 'missing-token' })).status, 404);
  assert.equal((await rename({ title: 'Signed out' }, { session: null })).status, 401);
  for (const body of [{}, { title: 42 }, ['title'], 'not json']) {
    assert.equal((await rename(body)).status, 400, `body ${JSON.stringify(body)}`);
  }
  assert.equal((await list())[0].title, 'Original');
});

test('the owner deletes a link and it stops opening; other accounts cannot', async (t) => {
  const { env, create, list } = await fixture(t);
  const { token } = await create({ scope: 'journal', entryIds: ['entry-a', 'entry-b'] });
  const remove = (session) => deleteShare({
    request: request(`/api/share/${token}`, { method: 'DELETE', session }),
    env,
    params: { token }
  });

  assert.equal((await remove('session-other')).status, 403);
  assert.equal((await list()).length, 1);
  assert.equal((await remove('session-owner')).status, 200);
  assert.deepEqual(await list(), []);
  const opened = await openShare({ request: request(`/api/share/${token}`, { session: null }), env, params: { token } });
  assert.equal(opened.status, 404);
});

test('share titles are one line of at most 80 characters, never splitting a character', () => {
  assert.equal(normalizeShareTitle('  a\n\tb  '), 'a b');
  assert.equal(normalizeShareTitle('   '), null);
  assert.equal(normalizeShareTitle(undefined), null);
  assert.equal(normalizeShareTitle(7), null);
  assert.equal(normalizeShareTitle('x'.repeat(100)).length, 80);
  const emoji = '🌙'.repeat(81);
  assert.equal(Array.from(normalizeShareTitle(emoji)).length, 80);
  assert.ok(!normalizeShareTitle(`${'a'.repeat(79)}🌙`).endsWith('\uD83C'));
});
