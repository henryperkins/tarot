import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { createD1 } from './helpers/d1Sqlite.mjs';
import { connectMcpClient } from './helpers/mcpClient.mjs';
import { createFakeReadingJobs, hangingRunner, readingRunner } from './helpers/fakeReadingJobs.mjs';
import { seedEntry, seedUser } from './helpers/journalFixtures.mjs';
import { SPREADS } from '../src/data/spreads.js';

const OWNER = Object.freeze({
  id: 'user-1', username: 'henry', subscription_tier: 'plus', subscription_status: 'active', auth_provider: 'session'
});
const THREE = { name: SPREADS.threeCard.name, key: 'threeCard' };
const NARRATIVE = '  The Hermit asks for patience ✨\r\n\r\nThen momentum.  ';

const open = [];
after(async () => {
  await Promise.all(open.map((connection) => connection.close()));
});

async function session({ user = OWNER, runReading = readingRunner({ reading: NARRATIVE, requestId: 'req-save-1' }) } = {}) {
  const d1 = await createD1();
  await seedUser(d1, { id: 'user-1', username: 'henry' });
  await seedUser(d1, { id: 'user-2' });
  const jobs = createFakeReadingJobs({ runReading });
  const env = { DB: d1, READING_JOBS: jobs.namespace };
  const connection = await connectMcpClient({ env, user, waitUntil: () => {} });
  open.push(connection);
  const call = (name, args) => connection.client.callTool({ name, arguments: args });
  return { d1, jobs, call };
}

async function drawAndFinish(ctx, extra = {}) {
  const drawn = await ctx.call('draw_tarot_reading', { spreadInfo: THREE, seed: 'rose', ...extra });
  await ctx.jobs.settle();
  return drawn.structuredContent;
}

function entries(d1) {
  return d1.rows('SELECT * FROM journal_entries ORDER BY created_at');
}

/** The audited payload for a drawn reading: labels plus catalog metadata. */
function payloadFor(drawn, overrides = {}) {
  return {
    spread: drawn.spreadInfo.name,
    spreadKey: drawn.spreadInfo.key,
    cards: drawn.cardsInfo.map(({ position, card, orientation, number, suit, rankValue }) => ({
      position,
      name: card,
      orientation,
      ...(number !== null ? { number } : { suit, rankValue })
    })),
    personalReading: NARRATIVE,
    requestId: 'req-save-1',
    sessionSeed: drawn.seed,
    deckId: drawn.deckStyle,
    ...overrides
  };
}

describe('save_reading_to_journal', () => {
  it('saves a finished reading from its job, verbatim, under the signed-in user', async () => {
    const ctx = await session();
    const drawn = await drawAndFinish(ctx);

    const saved = await ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken, context: 'self' });

    assert.equal(saved.isError, undefined);
    assert.equal(saved.structuredContent.outcome, 'saved');
    const [row] = entries(ctx.d1);
    assert.equal(row.id, saved.structuredContent.entry.id);
    assert.equal(row.user_id, 'user-1');
    assert.equal(row.narrative, NARRATIVE);
    assert.equal(row.request_id, 'req-save-1');
    assert.equal(row.idempotency_key, 'reading:req-save-1');
    assert.equal(row.session_seed, drawn.seed);
    assert.equal(row.context, 'self');
    assert.equal(row.spread_key, 'threeCard');
    const cards = JSON.parse(row.cards_json);
    assert.deepEqual(cards.map((card) => [card.position, card.orientation]), drawn.cardsInfo.map((card) => [card.position, card.orientation]));
    assert.ok(cards.every((card) => typeof card.name === 'string' && !('meaning' in card) && !('card' in card)));
  });

  it('answers already_saved when the same job is saved again', async () => {
    const ctx = await session();
    const drawn = await drawAndFinish(ctx);
    const first = await ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken });
    const second = await ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken });

    assert.equal(second.structuredContent.outcome, 'already_saved');
    assert.equal(second.structuredContent.entry.id, first.structuredContent.entry.id);
    assert.equal(entries(ctx.d1).length, 1);
  });

  it('keeps one row when two saves of one job race', async () => {
    const ctx = await session();
    const drawn = await drawAndFinish(ctx);
    const [a, b] = await Promise.all([
      ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken }),
      ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken })
    ]);
    assert.deepEqual([a.structuredContent.outcome, b.structuredContent.outcome].sort(), ['already_saved', 'saved']);
    assert.equal(entries(ctx.d1).length, 1);
  });

  it('recognises a payload save of a reading already saved from its job', async () => {
    const ctx = await session();
    const drawn = await drawAndFinish(ctx);
    const fromJob = await ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken });
    const fromPayload = await ctx.call('save_reading_to_journal', payloadFor(drawn));

    assert.equal(fromPayload.structuredContent.outcome, 'already_saved');
    assert.equal(fromPayload.structuredContent.entry.id, fromJob.structuredContent.entry.id);
    assert.equal(entries(ctx.d1).length, 1);
  });

  it('refuses a payload whose request ID belongs to a different reading', async () => {
    const ctx = await session();
    const drawn = await drawAndFinish(ctx);
    await ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken });
    const other = payloadFor(drawn);
    other.cards[0] = { ...other.cards[0], orientation: other.cards[0].orientation === 'Upright' ? 'Reversed' : 'Upright' };

    const result = await ctx.call('save_reading_to_journal', other);

    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /different reading under this request ID/);
    assert.equal(entries(ctx.d1).length, 1);
  });

  it('refuses a job reference mixed with reading fields', async () => {
    const ctx = await session();
    const drawn = await drawAndFinish(ctx);
    const result = await ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken, spread: 'x' });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /not both \(also sent: spread\)/);
    assert.equal(entries(ctx.d1).length, 0);
  });

  it('refuses a reading that has not finished', async () => {
    const ctx = await session({ runReading: hangingRunner() });
    const drawn = (await ctx.call('draw_tarot_reading', { spreadInfo: THREE })).structuredContent;
    const result = await ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /^Not saved: the reading has not finished/);
  });

  it('refuses a crisis safety response', async () => {
    const ctx = await session({ runReading: readingRunner({ reading: 'Please reach out…', provider: 'safety-gate', gateReason: 'crisis_gate' }) });
    const drawn = await drawAndFinish(ctx);
    const result = await ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /safety message, not a reading/);
    assert.equal(entries(ctx.d1).length, 0);
  });

  it('points to payload mode when the job has expired', async () => {
    const ctx = await session();
    const drawn = await drawAndFinish(ctx);
    ctx.jobs.instances.get(drawn.jobId).object.job.expiresAt = Date.now() - 1;

    const result = await ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken });

    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /job has expired\. Save it with the reading fields instead/);
    const fallback = await ctx.call('save_reading_to_journal', payloadFor(drawn));
    assert.equal(fallback.structuredContent.outcome, 'saved');
  });

  it('refuses accounts below Plus', async () => {
    const ctx = await session({ user: { ...OWNER, subscription_tier: 'free', subscription_status: 'inactive' } });
    const drawn = await drawAndFinish(ctx);
    const result = await ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /^Not saved: Cloud journal sync requires an active Plus or Pro subscription/);
  });
});

describe('add_reflection_to_journal_entry', () => {
  async function savedReading(ctx, extra) {
    const drawn = await drawAndFinish(ctx, extra);
    const saved = await ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken });
    return { drawn, entryId: saved.structuredContent.entry.id };
  }

  it('adds a card note by the label the reading showed, and a whole-reading note', async () => {
    const ctx = await session();
    const { drawn, entryId } = await savedReading(ctx, { deckStyle: 'thoth-a1' });
    const label = drawn.cardsInfo[1].card;

    const onCard = await ctx.call('add_reflection_to_journal_entry', { entryId, text: 'this one is me', scope: 'card', card: label });
    const onReading = await ctx.call('add_reflection_to_journal_entry', { entryId, text: 'gentle overall', scope: 'reading' });

    assert.equal(onCard.structuredContent.outcome, 'added');
    assert.equal(onCard.structuredContent.key, '1');
    assert.equal(onCard.structuredContent.target.cardIndex, 1);
    assert.equal(onReading.structuredContent.key, 'Overall');
    const stored = JSON.parse(ctx.d1.rows('SELECT reflections_json FROM journal_entries')[0].reflections_json);
    assert.deepEqual(stored, { 1: 'this one is me', Overall: 'gentle overall' });
  });

  it('returns reusable Thoth labels for both court cards, including a positioned retry', async () => {
    const ctx = await session();
    await seedEntry(ctx.d1, {
      id: 'thoth-entry', deckId: 'thoth-a1', cards: [
        { position: 'Past', name: 'Knight of Wands', suit: 'Wands', rank: 'Knight', rankValue: 12, orientation: 'Upright' },
        { position: 'Present', name: 'King of Wands', suit: 'Wands', rank: 'King', rankValue: 14, orientation: 'Upright' }
      ]
    });
    const prince = await ctx.call('add_reflection_to_journal_entry', {
      entryId: 'thoth-entry', text: 'Prince note', scope: 'card', card: 'Prince of Wands', position: 'Past'
    });
    const knight = await ctx.call('add_reflection_to_journal_entry', {
      entryId: 'thoth-entry', text: 'Knight note', scope: 'card', card: 'Knight of Wands', position: 'Present'
    });
    assert.equal(prince.structuredContent.key, '0');
    assert.equal(knight.structuredContent.key, '1');
    assert.equal(prince.structuredContent.target.card, 'Prince of Wands');
    assert.equal(knight.structuredContent.target.card, 'Knight of Wands');

    const princeRetry = await ctx.call('add_reflection_to_journal_entry', {
      entryId: 'thoth-entry', text: 'Prince note', scope: 'card',
      card: prince.structuredContent.target.card, position: prince.structuredContent.target.position
    });
    const knightRetry = await ctx.call('add_reflection_to_journal_entry', {
      entryId: 'thoth-entry', text: 'Knight note', scope: 'card', card: knight.structuredContent.target.card
    });
    assert.equal(princeRetry.structuredContent.outcome, 'already_present');
    assert.equal(knightRetry.structuredContent.outcome, 'already_present');
    assert.equal(princeRetry.structuredContent.key, '0');
    assert.equal(knightRetry.structuredContent.key, '1');
    const [row] = ctx.d1.rows('SELECT cards_json, reflections_json FROM journal_entries WHERE id = ?', ['thoth-entry']);
    assert.deepEqual(JSON.parse(row.cards_json).map((card) => card.name), ['Knight of Wands', 'King of Wands']);
    assert.deepEqual(JSON.parse(row.reflections_json), { 0: 'Prince note', 1: 'Knight note' });
  });

  it('treats a repeated note as already present', async () => {
    const ctx = await session();
    const { entryId } = await savedReading(ctx);
    await ctx.call('add_reflection_to_journal_entry', { entryId, text: 'same words', scope: 'reading' });
    const again = await ctx.call('add_reflection_to_journal_entry', { entryId, text: 'same words', scope: 'reading' });

    assert.equal(again.structuredContent.outcome, 'already_present');
    assert.match(again.content[0].text, /already attached/);
  });

  it("answers not found for another user's entry and for a deleted entry, recreating nothing", async () => {
    const ctx = await session();
    await seedEntry(ctx.d1, { id: 'entry-other', userId: 'user-2' });
    const { entryId } = await savedReading(ctx);
    ctx.d1.rows('DELETE FROM journal_entries WHERE id = ?', [entryId]);

    const foreign = await ctx.call('add_reflection_to_journal_entry', { entryId: 'entry-other', text: 'note', scope: 'reading' });
    const deleted = await ctx.call('add_reflection_to_journal_entry', { entryId, text: 'note', scope: 'reading' });

    for (const result of [foreign, deleted]) {
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, /no saved entry with that id/);
    }
    assert.equal(ctx.d1.rows('SELECT COUNT(*) AS n FROM journal_entries WHERE user_id = ?', ['user-1'])[0].n, 0);
  });

  it('lists the entry cards when the card is not in the reading', async () => {
    const ctx = await session();
    const { entryId } = await savedReading(ctx);
    const result = await ctx.call('add_reflection_to_journal_entry', { entryId, text: 'note', scope: 'card', card: 'The Unicorn' });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /The Unicorn is not in this entry\. Cards in this entry:/);
  });

  it('requires a card name for a card note', async () => {
    const ctx = await session();
    const { entryId } = await savedReading(ctx);
    const result = await ctx.call('add_reflection_to_journal_entry', { entryId, text: 'note', scope: 'card' });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /name the card/);
  });
});
