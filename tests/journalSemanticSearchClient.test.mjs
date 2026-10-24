// The journal's explicit "Search by meaning": a complete synced history filters
// literally in the browser, and only a request for the current query calls the
// semantic search endpoint.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { journalFiltersDriver } from './helpers/journalFiltersDriver.mjs';

const entry = (id, personalReading) => ({ id, ts: 1790000000000, question: `Question ${id}`, personalReading, cards: [] });
const LOADED = [
  entry('literal', 'A lighthouse on the shore.'),
  entry('other', 'A quiet garden at noon.')
];
const settle = () => new Promise(resolve => setImmediate(resolve));

async function setup(t, { cloud = true } = {}) {
  const requests = [];
  let release;
  const driver = await journalFiltersDriver(LOADED, {
    cloud,
    completeHistory: true,
    fetchImpl: (url) => {
      requests.push(String(url));
      return new Promise(resolve => { release = resolve; });
    }
  });
  t.after(() => driver.close());
  const query = (text) => {
    driver.render().setFilters(previous => ({ ...previous, query: text }));
    driver.flush();
    return driver.render(true);
  };
  return { driver, requests, query, respond: (body) => release(Response.json(body)) };
}

test('a complete history searches literally until the reader asks to search by meaning', async t => {
  const { driver, requests, query, respond } = await setup(t);
  let view = query('lighthouse');
  assert.deepEqual(view.filteredEntries.map(item => item.id), ['literal']);
  assert.equal(view.serverSearchState.enabled, false);
  assert.equal(view.serverSearchState.semanticAvailable, true);
  assert.deepEqual(requests, []);

  view.requestSemanticSearch();
  driver.flush();
  view = driver.render(true);
  assert.equal(view.serverSearchState.semanticActive, true);
  assert.equal(view.serverSearchState.status, 'loading');
  assert.equal(requests.length, 1);
  const url = new URL(requests[0], 'https://example.test');
  assert.equal(url.pathname, '/api/journal/search');
  assert.equal(url.searchParams.get('q'), 'lighthouse');
  assert.equal(url.searchParams.get('mode'), 'semantic');

  respond({ mode: 'semantic', entries: [entry('beacon', 'A beacon guiding ships home.')] });
  await settle();
  driver.flush();
  view = driver.render();
  assert.deepEqual(view.filteredEntries.map(item => item.id), ['beacon']);
  assert.equal(view.serverSearchState.mode, 'semantic');
  assert.equal(view.serverSearchState.semanticAvailable, false);
});

test('editing the query returns to literal matches without another request', async t => {
  const { driver, requests, query, respond } = await setup(t);
  query('lighthouse').requestSemanticSearch();
  driver.flush();
  driver.render(true);
  respond({ mode: 'semantic', entries: [entry('beacon', 'A beacon.')] });
  await settle();
  driver.flush();

  const view = query('lighthouse on');
  assert.equal(view.serverSearchState.semanticActive, false);
  assert.equal(view.serverSearchState.semanticAvailable, true);
  assert.deepEqual(view.filteredEntries.map(item => item.id), ['literal']);
  assert.equal(requests.length, 1);

  // Returning to the earlier words does not silently search by meaning again.
  assert.equal(query('lighthouse').serverSearchState.semanticActive, false);
  assert.equal(requests.length, 1);
});

test('journals without cloud search, and short queries, are not offered search by meaning', async t => {
  const local = await setup(t, { cloud: false });
  const view = local.query('lighthouse');
  assert.equal(view.serverSearchState.semanticAvailable, false);
  view.requestSemanticSearch();
  local.driver.flush();
  assert.equal(local.driver.render(true).serverSearchState.semanticActive, false);
  assert.deepEqual(local.requests, []);

  const cloud = await setup(t);
  assert.equal(cloud.query('li').serverSearchState.semanticAvailable, false);
});
