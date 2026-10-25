import assert from 'node:assert/strict';
import { test } from 'node:test';
import { journalHookDriver, journalStorageFixture } from './helpers/journalHookDriver.mjs';

const reading = (id, ts = 1700100000000) => ({ id, readingResultId: id, ts,
  question: id, personalReading: `Full saved prose ${id}`, reflections: { Overall: `Reflection ${id}` }, cards: [] });
const response = (entries, hasMore = false) => new Response(JSON.stringify({ entries,
  pagination: { total: 12, hasMore, nextCursor: entries.at(-1)?.ts ?? null, nextCursorId: entries.at(-1)?.id ?? null }
}));

async function setup(t, fetchImpl) {
  t.after(() => driver.close());
  const fixture = journalStorageFixture(t);
  // These tests drive continuation explicitly, without a wall-clock race.
  globalThis.window.requestIdleCallback = () => 1;
  globalThis.window.cancelIdleCallback = () => {};
  const driver = await journalHookDriver('progressive-owner', {
    cloud: true, hookOptions: { completeHistory: true, progressiveHistory: true }, fetchImpl
  });
  const render = () => { driver.flush(); return driver.render(); };
  return { ...fixture, driver, render, hook: driver.render() };
}

test('first page is bounded and the last complete cache survives until full history is ready', async t => {
  const urls = [];
  const first = Array.from({ length: 10 }, (_, index) => reading(`first-${index}`));
  const last = [reading('last-1', 1700000000000), reading('last-2', 1699900000000)];
  const { hook, render, storage } = await setup(t, async url => {
    urls.push(new URL(url, 'https://example.test'));
    return response(urls.length === 1 ? first : last, urls.length === 1);
  });
  const key = 'tarot_journal_cache_progressive-owner';
  const previous = JSON.stringify([reading('previous-complete-copy')]);
  storage.setItem(key, previous);
  await hook.reload();
  let current = render();
  assert.equal(urls[0].searchParams.get('all'), null);
  assert.equal(urls[0].searchParams.get('limit'), '10');
  assert.equal(current.entries.length, 10);
  assert.equal(current.historyComplete, false);
  assert.equal(storage.getItem(key), previous);
  await current.loadMoreEntries();
  current = render();
  assert.equal(urls[1].searchParams.get('limit'), '100');
  assert.equal(urls[1].searchParams.get('cursorId'), 'first-9');
  assert.equal(current.historyComplete, true);
  assert.equal(current.entries.length, 12);
  assert.equal(current.entries.at(-1).personalReading, last.at(-1).personalReading);
  assert.equal(JSON.parse(storage.getItem(key)).length, 12);
});

test('older pages preserve source-matched local visual outcomes in memory and the completed cache', async t => {
  const older = { ...reading('older', 1700000000000), visualState: {
    attachmentStatus: 'failed', retryStatus: 'unavailable', sourceFingerprint: 'a'.repeat(64),
    stateVersion: 2, reason: 'attachment-error'
  } };
  let calls = 0;
  const { hook, render, storage } = await setup(t, async () => response(++calls === 1 ? [reading('first')] : [older], calls === 1));
  storage.setItem('tarot_journal_cache_progressive-owner', JSON.stringify([
    { ...older, visualState: { ...older.visualState, reason: 'configuration-unavailable' } }
  ]));
  await hook.reload();
  await render().loadMoreEntries();
  const current = render();
  assert.equal(current.entries.find(entry => entry.id === 'older').visualState.reason, 'configuration-unavailable');
  assert.equal(JSON.parse(storage.getItem('tarot_journal_cache_progressive-owner')).find(entry => entry.id === 'older').visualState.reason, 'configuration-unavailable');
});

test('failed background loading retains entries and the complete cache, and explicit retry recovers', async t => {
  let calls = 0;
  const { hook, render, storage } = await setup(t, async () => {
    calls += 1;
    return calls === 1 ? response([reading('first')], true)
      : calls === 2 ? new Response('{}', { status: 503 }) : response([reading('older', 1700000000000)]);
  });
  storage.setItem('tarot_journal_cache_progressive-owner', JSON.stringify([reading('complete-copy')]));
  await hook.reload();
  let current = render();
  await current.loadMoreEntries({ prefetch: true });
  current = render();
  assert.equal(current.entries.length, 1);
  assert.equal(current.historyComplete, false);
  assert.match(current.historyError, /load/i);
  assert.equal(JSON.parse(storage.getItem('tarot_journal_cache_progressive-owner'))[0].id, 'complete-copy');
  await current.loadMoreEntries();
  current = render();
  assert.equal(current.historyError, null);
  assert.equal(current.historyComplete, true);
  assert.equal(current.entries.length, 2);
});

test('concurrent continuation requests share one flight', async t => {
  let calls = 0, release;
  const { hook, render } = await setup(t, async () => {
    calls += 1;
    if (calls === 1) return response([reading('first')], true);
    await new Promise(resolve => { release = resolve; });
    return response([reading('older', 1700000000000)]);
  });
  await hook.reload();
  const current = render();
  const a = current.loadMoreEntries(), b = current.loadMoreEntries();
  assert.equal(calls, 2);
  release();
  await Promise.all([a, b]);
  assert.equal(render().entries.length, 2);
});

test('a page from a superseded refresh cannot append or overwrite the new complete cache', async t => {
  let calls = 0, release;
  const { hook, render, storage } = await setup(t, async () => {
    calls += 1;
    if (calls === 1) return response([reading('first')], true);
    if (calls === 2) {
      await new Promise(resolve => { release = resolve; });
      return response([reading('obsolete-page', 1700000000000)]);
    }
    return response([reading('new-refresh')]);
  });
  await hook.reload();
  const current = render();
  const pending = current.loadMoreEntries();
  await current.reload();
  render();
  release();
  await pending;
  assert.deepEqual(render().entries.map(entry => entry.id), ['new-refresh']);
  assert.deepEqual(JSON.parse(storage.getItem('tarot_journal_cache_progressive-owner')).map(entry => entry.id), ['new-refresh']);
});
