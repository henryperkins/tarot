import assert from 'node:assert/strict';
import { test } from 'node:test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerJournalTools } from '../journal-tools.js';
import { createBackendClient } from '../backend.js';
import { buildReadingRequestCard } from '../../../shared/contracts/readingRequestCards.js';
import { MINOR_ARCANA } from '../../../src/data/minorArcana.js';

const reading = {
  spread: 'Single Card', spreadKey: 'single',
  cards: [{ name: 'The Star', position: 'Focus', orientation: 'Reversed', number: 17 }],
  personalReading: '  Full narrative.\n\nKeep the line breaks.  ',
  themes: { focus: 'hope' }, provider: 'local-composer', requestId: 'trace-only',
  deckId: 'rws-1909', userPreferences: { readingTone: 'gentle' }
};

async function connect(t, fetchImpl) {
  const backend = createBackendClient({ baseUrl: 'https://tableu.example', apiKey: 'private-test-key', ownerUserId: 'owner', fetchImpl });
  const server = new McpServer({ name: 'test', version: '1.0.0' });
  registerJournalTools(server, backend);
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  t.after(async () => { await client.close(); await server.close(); });
  return client;
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const owner = () => json({ user: { id: 'owner', auth_provider: 'api_key' } });

test('draw/save/reflection tools preserve payloads, require narrative and use only a returned saved id', async t => {
  const requests = [];
  const client = await connect(t, async (url, init) => {
    if (url.endsWith('/api/auth/me')) return owner();
    const body = JSON.parse(init.body);
    requests.push({ url, body });
    if (url.endsWith('/draw')) return json({ reading: 'Backend narrative', provider: 'local-composer', requestId: 'draw-1', cardsInfo: [{ card: 'The Star', position: 'Focus', orientation: 'upright', meaning: 'Hope' }], seed: 'returned-seed' });
    if (url.endsWith('/reflections')) return json({ success: true, entry: { id: 'saved-id' }, reflections: { Overall: body.text } });
    return json({ success: true, entry: { id: 'saved-id' } }, 201);
  });
  const tools = (await client.listTools()).tools;
  assert.deepEqual(tools.map(t => t.name).sort(), ['addReflectionToJournalEntry', 'drawTarotReading', 'saveReadingToJournal']);
  for (const tool of tools) assert.equal(tool.annotations.readOnlyHint, false);
  const refused = await client.callTool({ name: 'addReflectionToJournalEntry', arguments: { id: 'guessed', scope: 'reading', text: 'note' } });
  assert.equal(refused.isError, true);
  assert.equal(refused.structuredContent.outcome, 'not_started');
  assert.equal(requests.length, 0);
  const draw = await client.callTool({ name: 'drawTarotReading', arguments: { spreadInfo: { name: 'Single Card', key: 'single' }, seed: 'ritual-input' } });
  assert.equal(draw.structuredContent.seed, 'returned-seed');
  assert.equal(requests[0].body.cardsInfo, undefined);
  const missing = { ...reading };
  delete missing.personalReading;
  assert.equal((await client.callTool({ name: 'saveReadingToJournal', arguments: missing })).isError, true);
  const saved = await client.callTool({ name: 'saveReadingToJournal', arguments: reading });
  assert.equal(saved.structuredContent.entry.id, 'saved-id');
  assert.deepEqual(requests[1].body, reading);
  const text = '  My words.\nExactly.  ';
  const reflection = await client.callTool({ name: 'addReflectionToJournalEntry', arguments: { id: 'saved-id', scope: 'card', card: 'The Star', position: 'Focus', text } });
  assert.equal(reflection.isError, undefined);
  assert.deepEqual(requests[2], { url: 'https://tableu.example/api/journal/saved-id/reflections', body: { scope: 'card', card: 'The Star', position: 'Focus', text } });
  assert.equal((await client.callTool({ name: 'saveReadingToJournal', arguments: { ...reading, context: { inferred: 'self' } } })).isError, true);
  assert.equal((await client.callTool({ name: 'saveReadingToJournal', arguments: { ...reading, cards: [{ ...reading.cards[0], meaning: 'excluded' }] } })).isError, true);
});

test('a completed draw is still returned when its journal payload cannot be prepared', async t => {
  const client = await connect(t, async url => url.endsWith('/api/auth/me') ? owner() : json({
    reading: 'Backend narrative', provider: 'local-composer', requestId: 'draw-2', seed: 7,
    cardsInfo: [{ card: 'The Star', position: 'Focus', orientation: 'sideways' }]
  }));
  const draw = await client.callTool({ name: 'drawTarotReading', arguments: { spreadInfo: { name: 'Single Card', key: 'single' } } });
  assert.equal(draw.isError, undefined);
  assert.equal(draw.structuredContent.reading, 'Backend narrative');
  assert.equal(draw.structuredContent.savePayload, null);
  assert.match(draw.structuredContent.savePayloadError, /do not repeat the draw/);
});

test('deduplicated saves keep returned id; uncertain writes never retry or claim success', async t => {
  let writes = 0;
  let outcome = 'dedup';
  const client = await connect(t, async (url) => {
    if (url.endsWith('/api/auth/me')) return owner();
    writes += 1;
    if (outcome === 'dedup') return json({ success: true, deduplicated: true, entry: { id: 'original' } });
    if (outcome === 'lost') throw new Error('Socket lost after commit');
    if (outcome === 'invalid') return new Response('<html>proxy</html>', { status: 200 });
    if (outcome === 'timeout') return json({ error: 'Request timed out after dispatch' }, 408);
    return json({ error: 'Upstream failed after commit' }, 502);
  });
  const dedup = await client.callTool({ name: 'saveReadingToJournal', arguments: { ...reading, sessionSeed: 'returned-seed' } });
  assert.equal(dedup.structuredContent.entry.id, 'original');
  assert.equal(dedup.structuredContent.deduplicated, true);
  for (outcome of ['lost', 'invalid', 'server', 'timeout']) {
    const before = writes;
    const result = await client.callTool({ name: 'addReflectionToJournalEntry', arguments: { id: 'original', scope: 'reading', text: outcome } });
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.outcome, 'unknown');
    assert.match(result.content[0].text, /check.*app/i);
    assert.equal(writes, before + 1);
  }
});

test('mismatched and synthetic backend identities block writes before dispatch', async t => {
  for (const user of [{ id: 'someone-else', auth_provider: 'api_key' }, { id: 'owner', auth_provider: 'service' }]) {
    let writes = 0;
    const client = await connect(t, async url => {
      if (url.endsWith('/api/auth/me')) return json({ user });
      writes += 1;
      return json({ success: true, entry: { id: 'wrong' } }, 201);
    });
    const result = await client.callTool({ name: 'saveReadingToJournal', arguments: reading });
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.outcome, 'not_started');
    assert.equal(writes, 0);
  }
});

test('explicit authorization rejection is distinct from an uncertain write', async t => {
  const client = await connect(t, async url => url.endsWith('/api/auth/me') ? owner() : json({ error: 'Cloud journal sync requires Plus', requiredTier: 'plus' }, 403));
  const result = await client.callTool({ name: 'saveReadingToJournal', arguments: reading });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.outcome, 'rejected');
  assert.equal(result.structuredContent.status, 403);
});

test('real Thoth card contract and numeric draw seed produce a lossless usable save payload', async t => {
  const cardsInfo = ['Knight of Cups', 'King of Cups'].map((name, i) => buildReadingRequestCard(
    MINOR_ARCANA.find(card => card.name === name), { deckStyle: 'thoth-a1', position: i ? 'Future' : 'Past' }
  ));
  let saved;
  let context = 'career';
  const client = await connect(t, async (url, init) => {
    if (url.endsWith('/api/auth/me')) return owner();
    if (url.endsWith('/draw')) return json({ reading: reading.personalReading, cardsInfo, seed: 123456,
      provider: 'local-composer', requestId: 'real-shape', context });
    saved = JSON.parse(init.body);
    return json({ success: true, entry: { id: 'thoth-saved' } }, 201);
  });
  const result = await client.callTool({ name: 'drawTarotReading', arguments: {
    spreadInfo: { name: 'Three Card', key: 'threeCard' }, deckStyle: 'thoth-a1', userQuestion: 'What can I learn?',
    personalization: { readingTone: 'gentle' }, seed: 'my ritual'
  } });
  assert.ok(result.structuredContent.savePayload);
  const response = await client.callTool({ name: 'saveReadingToJournal', arguments: result.structuredContent.savePayload });
  assert.equal(response.isError, undefined);
  assert.equal(saved.personalReading, reading.personalReading);
  assert.equal(saved.sessionSeed, '123456:real-shape');
  assert.equal(saved.deckId, 'thoth-a1');
  assert.equal(saved.question, 'What can I learn?');
  assert.equal(saved.context, 'career');
  assert.deepEqual(saved.cards.map(c => [c.name, c.displayName]), [['Knight of Cups', 'Prince of Cups'], ['King of Cups', 'Knight of Cups']]);
  assert.ok(saved.cards.every(c => c.number === undefined && c.meaning === undefined));
  const rawMapped = cardsInfo.map(({ card, position, orientation, number, suit, rank, rankValue, canonicalName, canonicalKey }) => ({ name: card, position, orientation, number, suit, rank, rankValue, canonicalName, canonicalKey }));
  const numeric = await client.callTool({ name: 'saveReadingToJournal', arguments: { ...reading, cards: rawMapped, sessionSeed: 123456 } });
  assert.equal(numeric.isError, undefined);
  assert.equal(saved.sessionSeed, '123456');
  for (context of [{ inferred: 'self' }, 'unknown-category']) {
    const invalidContext = await client.callTool({ name: 'drawTarotReading', arguments: { spreadInfo: { name: 'Three Card', key: 'threeCard' } } });
    assert.equal(invalidContext.structuredContent.savePayload.context, undefined);
  }
});

test('the same caller seed never dedupes a later, different draw into an earlier entry', async t => {
  let draws = 0;
  const client = await connect(t, async url => url.endsWith('/api/auth/me') ? owner() : json({
    reading: `Narrative ${draws += 1}`, provider: 'local-composer', requestId: `draw-${draws}`, seed: 123,
    cardsInfo: [{ card: 'The Star', position: 'Focus', orientation: 'Upright' }]
  }));
  const args = { spreadInfo: { name: 'Single Card', key: 'single' }, seed: 'lucky 7' };
  const first = (await client.callTool({ name: 'drawTarotReading', arguments: args })).structuredContent.savePayload;
  const second = (await client.callTool({ name: 'drawTarotReading', arguments: args })).structuredContent.savePayload;
  assert.equal(first.sessionSeed, '123:draw-1');
  assert.equal(second.sessionSeed, '123:draw-2');
});

test('a crisis-gated draw returns only support, with no cards or save payload', async t => {
  const client = await connect(t, async url => url.endsWith('/api/auth/me') ? owner() : json({
    reading: 'Please reach out: 988', provider: 'safety-gate', requestId: 'crisis-1', gateBlocked: true, gateReason: 'crisis_gate',
    // An older backend still attached cards; the adapter must not pass them on.
    cardsInfo: [{ card: 'The Tower', position: 'Focus', orientation: 'Upright' }], seed: 9
  }));
  const draw = await client.callTool({ name: 'drawTarotReading', arguments: { spreadInfo: { name: 'Single Card', key: 'single' }, userQuestion: 'I feel suicidal' } });
  assert.equal(draw.isError, undefined);
  assert.equal(draw.structuredContent.gateReason, 'crisis_gate');
  assert.equal(draw.structuredContent.reading, 'Please reach out: 988');
  assert.equal(draw.structuredContent.savePayload, null);
  assert.equal(draw.structuredContent.cardsInfo, undefined);
  assert.match(draw.structuredContent.guidance, /do not save/i);
});

test('a draw records the default deck and keeps location only with explicit consent', async t => {
  const client = await connect(t, async url => url.endsWith('/api/auth/me') ? owner() : json({
    reading: 'Narrative', provider: 'local-composer', requestId: 'draw-loc', seed: 5,
    cardsInfo: [{ card: 'The Star', position: 'Focus', orientation: 'Upright' }]
  }));
  const location = { latitude: 41.88, longitude: -87.63, timezone: 'America/Chicago', accuracy: 20 };
  const draw = spec => client.callTool({ name: 'drawTarotReading', arguments: { spreadInfo: { name: 'Single Card', key: 'single' }, ...spec } });
  const kept = (await draw({ location, persistLocationToJournal: true })).structuredContent.savePayload;
  assert.equal(kept.deckId, 'rws-1909');
  assert.deepEqual(kept.location, { latitude: 41.88, longitude: -87.63, timezone: 'America/Chicago' });
  assert.equal(kept.persistLocationConsent, true);
  const withheld = (await draw({ location, deckStyle: 'thoth-a1' })).structuredContent.savePayload;
  assert.equal(withheld.deckId, 'thoth-a1');
  assert.equal(withheld.location, undefined);
  assert.equal(withheld.persistLocationConsent, undefined);
  const unconsented = await client.callTool({ name: 'saveReadingToJournal', arguments: { ...reading, location: { latitude: 1, longitude: 2 } } });
  assert.equal(unconsented.isError, true);
});

test('failed reads are safe to repeat and keep the backend reason; refusals are never uncertain', async () => {
  let response;
  const backend = createBackendClient({ baseUrl: 'https://tableu.example', apiKey: 'private-test-key', ownerUserId: 'owner',
    fetchImpl: async url => url.endsWith('/api/auth/me') ? owner() : response() });
  response = () => json({ error: 'Reading job expired.' }, 503);
  await assert.rejects(backend.call('/api/tarot-reading/jobs/job-1', { method: 'GET' }), error =>
    error.outcome === 'not_started' && /Reading job expired\./.test(error.message) && /safe to try again/.test(error.message));
  response = () => json({ error: 'Reading job expired.' }, 410);
  await assert.rejects(backend.call('/api/tarot-reading/jobs/job-1', { method: 'GET' }), { outcome: 'rejected', status: 410 });
  response = () => new Response('<html>Forbidden</html>', { status: 403 });
  await assert.rejects(backend.call('/api/journal', { method: 'POST', body: '{}' }), { outcome: 'rejected', status: 403 });
  response = () => json({ error: 'Upstream failed' }, 502);
  await assert.rejects(backend.call('/api/journal', { method: 'POST', body: '{}' }), error =>
    error.outcome === 'unknown' && /Do not retry/.test(error.message));
});