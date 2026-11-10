import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { createAccountExportHandler } from '../functions/api/account/export.js';
import { createD1 } from './helpers/d1Sqlite.mjs';

const USER_ID = 'export-reader';
const databases = [];
afterEach(() => { for (const db of databases.splice(0)) db.sqlite.close(); });

async function database() {
  const db = await createD1();
  databases.push(db);
  for (const id of [USER_ID, 'other-reader']) {
    await db.prepare(`INSERT INTO users (id, email, username, password_hash, password_salt, created_at, updated_at,
      stripe_customer_id, auth_subject) VALUES (?, ?, ?, 'private-hash', 'private-salt', 1, 1, ?, ?)`)
      .bind(id, `${id}@example.invalid`, id, `cus_${id}`, `subject-${id}`).run();
  }
  return db;
}

async function seed(db, userId) {
  await db.prepare(`INSERT INTO journal_entries (id, user_id, created_at, updated_at, spread_key, spread_name, cards_json,
    narrative, themes_json, step_embeddings) VALUES (?, ?, 1, 1, 'single', 'Single Card', '[{"name":"The Star"}]',
    'A reading.', '{"suitFocus":"major"}', '[0.1,0.2]')`).bind(`${userId}-entry`, userId).run();
  await db.prepare(`INSERT INTO journal_followups (id, user_id, entry_id, created_at, question, answer, journal_context_json)
    VALUES (?, ?, ?, 1, 'Next?', 'A small step.', '{"tone":"warm"}')`).bind(`${userId}-followup`, userId, `${userId}-entry`).run();
  await db.prepare(`INSERT INTO user_memories (id, user_id, text, keywords, created_at)
    VALUES (?, ?, 'Concrete steps help.', 'steps, concrete', 1)`).bind(`${userId}-memory`, userId).run();
  await db.prepare(`INSERT INTO card_appearances (user_id, card_name, year_month, count, first_seen, last_seen)
    VALUES (?, 'The Star', '2026-10', 2, 1, 2)`).bind(userId).run();
  await db.prepare(`INSERT INTO archetype_badges (user_id, badge_type, badge_key, earned_at, metadata_json)
    VALUES (?, 'frequency', 'star-2', 2, '{"count":2}')`).bind(userId).run();
  await db.prepare(`INSERT INTO pattern_occurrences (user_id, pattern_type, pattern_id, entry_id, year_month, created_at)
    VALUES (?, 'triad', 'death-temperance-star', ?, '2026-10', 2)`).bind(userId, `${userId}-entry`).run();
  await db.prepare(`INSERT INTO share_tokens (token, user_id, scope, title, created_at, meta_json)
    VALUES (?, ?, 'entry', 'A shared reading', 1, '{"theme":"light"}')`).bind(`${userId}-share`, userId).run();
  await db.prepare('INSERT INTO share_token_entries (token, entry_id) VALUES (?, ?)')
    .bind(`${userId}-share`, `${userId}-entry`).run();
  await db.prepare(`INSERT INTO share_notes (id, token, author_name, body, created_at)
    VALUES (?, ?, 'Guest reader', 'Keep this note.', 2)`).bind(`${userId}-note`, `${userId}-share`).run();
}

function run(db, overrides = {}) {
  const handler = createAccountExportHandler({
    getUserFromRequest: async () => ({ id: USER_ID }),
    isMachineCredential: () => false,
    ...overrides
  });
  return handler({ request: new Request('https://example.com/api/account/export'), env: { DB: db } });
}

describe('GET /api/account/export with migrated SQLite', () => {
  it('requires an authenticated session and rejects API keys and service tokens', async () => {
    for (const user of [null, { id: USER_ID, auth_provider: 'api_key' }, { id: USER_ID, auth_provider: 'service_token' }]) {
      const response = await run(null, { getUserFromRequest: async () => user,
        isMachineCredential: value => ['api_key', 'service_token'].includes(value?.auth_provider) });
      assert.equal(response.status, 401);
    }
  });

  it('exports content with real SQL columns and excludes credentials and embeddings', async () => {
    const db = await database();
    await seed(db, USER_ID);
    await db.prepare('INSERT INTO user_analytics_prefs (user_id, archetype_journey_enabled, show_badges, updated_at) VALUES (?, 1, 0, 1)').bind(USER_ID).run();
    const response = await run(db);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(response.headers.get('content-disposition'), /attachment; filename="tableu-export-\d{4}-\d{2}-\d{2}\.json"/);
    const body = await response.json();
    assert.equal(body.exportVersion, 1);
    assert.ok(body.exportedAt);
    for (const key of ['password_hash', 'password_salt', 'stripe_customer_id', 'auth_subject']) assert.equal(body.account[key], undefined);
    assert.deepEqual(body.journal.entries[0].cards, [{ name: 'The Star' }]);
    assert.deepEqual(body.journal.entries[0].themes, { suitFocus: 'major' });
    assert.equal(body.journal.entries[0].step_embeddings, undefined);
    assert.equal(body.journal.entries[0].cards_json, undefined);
    assert.deepEqual(body.followUpConversations.conversations[0].journal_context, { tone: 'warm' });
    assert.deepEqual(body.readerMemories.memories[0].keywords, ['steps', 'concrete']);
    assert.deepEqual(body.analyticsPreferences, { archetypeJourneyEnabled: true, showBadges: false });
  });

  it('preserves parsed extracted steps in the exported journal entry', async () => {
    const db = await database();
    await seed(db, USER_ID);
    await db.prepare('UPDATE journal_entries SET extracted_steps = ? WHERE id = ?')
      .bind('["Keep this saved action."]', `${USER_ID}-entry`).run();
    const response = await run(db);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.journal.entries[0].extracted_steps, ['Keep this saved action.']);
  });

  it('includes Journey and share content only for the current owner', async () => {
    const db = await database();
    await seed(db, USER_ID);
    await seed(db, 'other-reader');
    const response = await run(db);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.journal.count, 1);
    assert.equal(body.followUpConversations.count, 1);
    assert.equal(body.readerMemories.count, 1);
    assert.equal(body.archetypeJourney.cardAppearances.length, 1);
    assert.deepEqual(body.archetypeJourney.badges[0].metadata, { count: 2 });
    assert.equal(body.archetypeJourney.patternOccurrences[0].entry_id, `${USER_ID}-entry`);
    assert.equal(body.sharedJournals.links.length, 1);
    assert.deepEqual(body.sharedJournals.links[0].meta, { theme: 'light' });
    assert.equal(body.sharedJournals.entries[0].entry_id, `${USER_ID}-entry`);
    assert.equal(body.sharedJournals.notes[0].body, 'Keep this note.');
    assert.equal(JSON.stringify(body).includes('other-reader'), false);
  });

  it('returns a complete empty bundle for a new account', async () => {
    const response = await run(await database());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.journal, { count: 0, entries: [] });
    assert.deepEqual(body.readerMemories, { count: 0, memories: [] });
    assert.deepEqual(body.archetypeJourney, { cardAppearances: [], badges: [], patternOccurrences: [] });
    assert.deepEqual(body.sharedJournals, { links: [], entries: [], notes: [] });
  });

  it('still exports when the optional analytics preferences table is missing', async () => {
    const db = await database();
    db.sqlite.exec('DROP TABLE user_analytics_prefs');
    const response = await run(db);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).analyticsPreferences, null);
  });

  it('fails instead of serving a partial export if a content query fails', async () => {
    const db = await database();
    db.sqlite.exec('DROP TABLE share_notes');
    const response = await run(db);
    assert.equal(response.status, 500);
    assert.match((await response.json()).error, /Unable to export/);
  });
});
