import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { onRequestPost as save } from '../functions/api/journal.js';
import { onRequestPost as reflect } from '../functions/api/journal/reflections.js';
import { onRequestGet as read } from '../functions/api/journal/[id].js';
import { onRequestGet as me } from '../functions/api/auth/me.js';
import { journalFixture, apiRequest, OWNER_KEY, OTHER_KEY, SAVED_READING } from './helpers/journalD1.mjs';

let fixture;
before(async () => { fixture = await journalFixture(); });
after(async () => { await fixture?.close(); });
const env = () => ({ DB: fixture.db });
const saveReading = (body, key) => save({ request: apiRequest('/api/journal', body, key), env: env() });
const reflection = (id, body, key) => reflect({ request: apiRequest(`/api/journal/${id}/reflections`, body, key), env: env(), params: { id } });

test('bearer identity and app cookie resolve to the same app user', async () => {
  const bearer = await me({ request: apiRequest('/api/auth/me'), env: env() });
  const cookie = await me({ request: new Request('https://example.test/api/auth/me', { headers: { Cookie: 'session=session-owner' } }), env: env() });
  assert.equal(bearer.status, 200);
  assert.equal((await bearer.json()).user.id, (await cookie.json()).user.id);
  assert.match(bearer.headers.get('Cache-Control'), /no-store/);
});

test('concurrent seeded saves return one unchanged narrative and preserve every card and metadata field', async () => {
  const responses = await Promise.all(Array.from({ length: 4 }, () => saveReading(SAVED_READING)));
  const bodies = await Promise.all(responses.map(r => r.json()));
  assert.equal(new Set(bodies.map(b => b.entry.id)).size, 1);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 200, 200, 201]);
  const duplicate = await saveReading({ ...SAVED_READING, personalReading: 'Do not replace me' });
  assert.equal((await duplicate.json()).deduplicated, true);
  const id = bodies[0].entry.id;
  const response = await read({ request: apiRequest(`/api/journal/${id}`), env: env(), params: { id } });
  const { entry } = await response.json();
  for (const field of ['personalReading', 'cards', 'themes', 'provider', 'requestId', 'deckId', 'userPreferences', 'sessionSeed']) {
    assert.deepEqual(entry[field], SAVED_READING[field], field);
  }
  const stored = await fixture.db.prepare('SELECT user_id FROM journal_entries WHERE id = ?').bind(id).first();
  assert.equal(stored.user_id, 'owner');
});

test('requestId does not deduplicate unseeded readings; the same seed is scoped to each owner', async () => {
  const unseeded = { ...SAVED_READING, sessionSeed: undefined };
  const a = await (await saveReading(unseeded)).json();
  const b = await (await saveReading(unseeded)).json();
  assert.notEqual(a.entry.id, b.entry.id);
  const other = await (await saveReading(SAVED_READING, OTHER_KEY)).json();
  const own = await (await saveReading(SAVED_READING, OWNER_KEY)).json();
  assert.notEqual(other.entry.id, own.entry.id);
});

test('reflections preserve 2000 characters verbatim, resolve duplicate names and never lose concurrent appends', async () => {
  const { entry } = await (await saveReading({ ...SAVED_READING, sessionSeed: 'reflections' })).json();
  assert.equal((await reflection(entry.id, { scope: 'card', card: 'The Hermit', text: 'ambiguous' })).status, 400);
  assert.equal((await reflection(entry.id, { scope: 'card', card: 'The Tower', text: 'absent' })).status, 400);
  const text = `  ${'x'.repeat(1995)}\n  `;
  const first = await reflection(entry.id, { scope: 'card', card: 'The Hermit', position: 'Future', text });
  assert.equal(first.status, 200);
  assert.equal((await first.json()).reflections['2'], text);
  const responses = await Promise.all(['  first\n', 'second  '].map(text => reflection(entry.id, { scope: 'reading', text })));
  assert.ok(responses.every(r => r.status === 200));
  const row = await fixture.db.prepare('SELECT reflections_json FROM journal_entries WHERE id = ?').bind(entry.id).first();
  const notes = JSON.parse(row.reflections_json);
  assert.equal(notes['2'], text);
  assert.ok(notes.Overall === '  first\n\n\nsecond  ' || notes.Overall === 'second  \n\n  first\n');
  assert.equal((await reflection(entry.id, { scope: 'reading', text: 'x'.repeat(2001) })).status, 400);
  assert.equal((await reflection(entry.id, { scope: 'reading', text: 'private' }, OTHER_KEY)).status, 404);
  const denied = await read({ request: apiRequest(`/api/journal/${entry.id}`, undefined, OTHER_KEY), env: env(), params: { id: entry.id } });
  assert.equal(denied.status, 404);
});
