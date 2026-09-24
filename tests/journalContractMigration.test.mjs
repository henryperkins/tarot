import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedEntry, seedUser } from './helpers/journalFixtures.mjs';
import { addJournalReflection } from '../functions/lib/journalReflections.js';

async function setup(entry = {}) {
  const DB = await createD1();
  await seedUser(DB);
  await seedEntry(DB, entry);
  const user = { id: 'user-1', subscription_tier: 'plus', subscription_status: 'active' };
  const call = (input, policy = 'mcp') => addJournalReflection({
    env: { DB }, user, entryId: 'entry-1', input, policy
  });
  const notes = () => JSON.parse(DB.rows(
    'SELECT reflections_json FROM journal_entries WHERE id = ?', ['entry-1']
  )[0].reflections_json);
  return { call, notes, DB, user };
}

test('MCP preserves exact reflection text and an identical retry adds nothing', async () => {
  const { call, notes } = await setup();
  const input = { scope: 'reading', text: '  first\r\nsecond  ' };
  assert.equal((await call(input)).status, 200);
  assert.equal(notes().Overall, input.text);
  assert.equal((await call(input)).status, 200);
  assert.equal(notes().Overall, input.text);
  assert.equal((await call({ ...input, mode: 'replace' })).status, 400);
});

test('HTTP replacement remains available without exposing it through MCP', async () => {
  const { call, notes } = await setup();
  await call({ scope: 'reading', text: 'original' }, 'http');
  const input = { scope: 'reading', text: '  replacement  ', mode: 'replace' };
  assert.equal((await call(input, 'http')).status, 200);
  assert.equal(notes().Overall, input.text);
});

test('all eleven distinct concurrent MCP appends survive contention', async () => {
  const { call, notes } = await setup();
  const results = await Promise.all(Array.from({ length: 11 }, (_, index) =>
    call({ scope: 'reading', text: `note-${index};` })
  ));
  assert.deepEqual(results.map(result => result.status), Array(11).fill(200));
  for (let index = 0; index < 11; index++) {
    assert.ok(notes().Overall.includes(`note-${index};`));
  }
});

test('HTTP repeated append remains a new note and preserves its response shape', async () => {
  const { call, notes } = await setup();
  const input = { scope: 'reading', text: '  note\r\n  ' };
  await call(input, 'http');
  const result = await call(input, 'http');
  assert.equal(result.status, 200);
  assert.equal(notes().Overall, '  note\r\n  \n\n  note\r\n  ');
  assert.deepEqual(result.body.entry, { id: 'entry-1' });
  assert.equal(result.body.reflection.key, 'Overall');
  assert.equal(result.body.alreadyPresent, undefined);
});

test('request JSON cannot change MCP into the HTTP replacement policy', async () => {
  const { call, notes } = await setup();
  await call({ scope: 'reading', text: 'original' });
  const result = await call({ scope: 'reading', text: 'replacement', mode: 'replace', policy: 'http' });
  assert.equal(result.status, 400);
  assert.equal(notes().Overall, 'original');
});

test('the MCP cumulative cap does not impose a new limit on HTTP reflections', async () => {
  const { call, notes } = await setup({ reflections: { Overall: 'x'.repeat(20000) } });
  assert.equal((await call({ text: 'next', scope: 'reading' })).status, 400);
  assert.equal((await call({ text: 'next', scope: 'reading' }, 'http')).status, 200);
  assert.equal(notes().Overall, `${'x'.repeat(20000)}\n\nnext`);
});

for (const policy of ['http', 'mcp']) {
  test(`${policy} rejects blank, overlong and foreign-owner input without changing notes`, async () => {
    const { call, notes, DB, user } = await setup();
    assert.equal((await call({ text: ' \r\n ' }, policy)).status, 400);
    assert.equal((await call({ text: 'x'.repeat(2001) }, policy)).status, 400);
    await seedUser(DB, { id: 'other' });
    await seedEntry(DB, { id: 'private', userId: 'other' });
    const foreign = await addJournalReflection({ env: { DB }, user, entryId: 'private', input: { text: 'no' }, policy });
    const missing = await addJournalReflection({ env: { DB }, user, entryId: 'missing', input: { text: 'no' }, policy });
    assert.equal(foreign.status, 404);
    assert.deepEqual(foreign, missing);
    assert.equal(notes(), null);
  });
}

test('HTTP retains stored display-name and canonical-name targeting for Thoth cards', async () => {
  const { call, notes } = await setup({ deckId: 'thoth-a1', cards: [
    { name: 'Knight of Cups', displayName: 'Prince of Cups', position: 'Past' },
    { name: 'King of Cups', displayName: 'Knight of Cups', position: 'Future' }
  ] });
  assert.equal((await call({ card: 'Knight of Cups', text: 'ambiguous' }, 'http')).status, 400);
  assert.equal((await call({ card: 'King of Cups', text: 'canonical' }, 'http')).status, 200);
  const displayed = await call({ card: 'Prince of Cups', text: 'displayed' }, 'http');
  assert.equal(displayed.status, 200);
  assert.equal(displayed.body.reflection.card, 'Prince of Cups');
  assert.deepEqual(notes(), { 0: 'displayed', 1: 'canonical' });
});
