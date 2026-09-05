import assert from 'node:assert/strict';
import { test } from 'node:test';

import { onRequestPost as drawTarotReading } from '../functions/api/tarot-reading-draw.js';
import { resolveReadingCards } from '../functions/lib/readingCardResolution.js';
import { drawSpread } from '../src/lib/deck.js';
import { buildReadingRequestCard } from '../shared/contracts/readingRequestCards.js';
import { safeParseReadingRequest } from '../shared/contracts/readingSchema.js';
import { getDeckAlias } from '../shared/vision/deckAssets.js';
import { MAJOR_ARCANA } from '../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../src/data/minorArcana.js';

for (const deckStyle of ['rws-1909', 'thoth-a1', 'marseille-classic']) {
  test(`request cards preserve all 78 ${deckStyle} display labels and canonical identities through validation`, () => {
    const catalog = [...MAJOR_ARCANA, ...MINOR_ARCANA];
    const original = structuredClone(catalog);
    const cardsInfo = catalog.map((card, index) => buildReadingRequestCard(card, {
      deckStyle,
      position: `Position ${index + 1}`,
      isReversed: index % 2 === 1,
      userReflection: `  Reflection ${index + 1}.  `
    }));
    const parsed = safeParseReadingRequest({ spreadInfo: { name: 'Catalog coverage' }, cardsInfo, deckStyle });
    assert.equal(parsed.success, true, parsed.error);
    const resolved = resolveReadingCards(parsed.data.cardsInfo, deckStyle);

    assert.equal(new Set(resolved.map((card) => card.canonicalKey)).size, 78);
    for (let index = 0; index < catalog.length; index++) {
      const source = catalog[index];
      const request = cardsInfo[index];
      const actual = resolved[index];
      assert.equal(request.card, getDeckAlias(source, deckStyle), `${source.name}: use the same label as the selected deck UI`);
      assert.equal(request.canonicalName, source.name);
      assert.equal(request.canonicalKey, source.name.toLowerCase());
      assert.equal(actual.canonicalName, source.name);
      assert.equal(actual.canonicalKey, source.name.toLowerCase());
      assert.equal(actual.number, source.number ?? null);
      assert.equal(actual.suit, source.suit ?? null);
      assert.equal(actual.rank, source.rank ?? null);
      assert.equal(actual.rankValue, source.rankValue ?? null);
      assert.equal(actual.position, `Position ${index + 1}`);
      assert.equal(actual.orientation, index % 2 === 1 ? 'Reversed' : 'Upright');
      assert.equal(actual.meaning, index % 2 === 1 ? source.reversed : source.upright);
      assert.equal(actual.userReflection, `Reflection ${index + 1}.`);
    }
    assert.deepEqual(catalog, original, 'request assembly must preserve the original UI card state');
  });
}

test('distinguishes canonical Knights from Kings when building Thoth Prince and Knight requests', () => {
  const prince = MINOR_ARCANA.find((card) => card.name === 'Knight of Cups');
  const knight = MINOR_ARCANA.find((card) => card.name === 'King of Cups');
  const requests = [prince, knight].map((card) => buildReadingRequestCard(card, {
    deckStyle: 'thoth-a1', position: 'Focus'
  }));

  assert.deepEqual(requests.map((card) => card.card), ['Prince of Cups', 'Knight of Cups']);
  assert.deepEqual(requests.map((card) => card.canonicalName), ['Knight of Cups', 'King of Cups']);
  assert.deepEqual(resolveReadingCards(requests, 'thoth-a1').map((card) => card.rankValue), [12, 14]);
});

test('preserves drawn reversal state and permits the server no-reversals override without mutating it', () => {
  const drawn = { ...MAJOR_ARCANA[0], isReversed: true };
  const reversed = buildReadingRequestCard(drawn, { position: 'Focus', userReflection: '  A personal note.  ' });
  const upright = buildReadingRequestCard(drawn, { position: 'Focus', isReversed: false, userReflection: '   ' });

  assert.equal(reversed.orientation, 'Reversed');
  assert.equal(reversed.meaning, drawn.reversed);
  assert.equal(reversed.userReflection, 'A personal note.');
  assert.equal(upright.orientation, 'Upright');
  assert.equal(upright.meaning, drawn.upright);
  assert.equal(upright.userReflection, null);
  assert.equal(drawn.isReversed, true);
});

for (const fixture of [
  { name: 'top-level deck precedence', deckStyle: 'thoth-a1', spreadDeckStyle: 'rws-1909' },
  { name: 'spread deck fallback', spreadDeckStyle: 'thoth-a1' },
  { name: 'trimmed deck fallback', deckStyle: ' ', spreadDeckStyle: ' thoth-a1 ' }
]) {
  test(`server draw preserves the displayed Thoth Prince with ${fixture.name}`, async (t) => {
    const [drawn] = drawSpread({ spreadKey: 'single', useSeed: true, seed: 7, includeMinors: true });
    assert.equal(drawn.name, 'Knight of Cups', 'the fixed seed must draw the canonical Knight, displayed as Prince');
    const requests = [];
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'warn', () => {});
    t.mock.method(globalThis, 'fetch', async (_url, init) => {
      requests.push(JSON.parse(init.body));
      return Response.json({
        choices: [{
          finish_reason: 'stop',
          message: {
            content: '### Opening\n\nThe Prince of Cups offers you a moment of reflection.\n\n### Guidance\n\nThe Prince of Cups invites one gentle next step.\n\n- Choose one small action that feels right for you.\n\nYour choices shape the path ahead.'
          }
        }]
      });
    });
    const response = await drawTarotReading({
      request: new Request('https://tableau.test/api/tarot-reading/draw', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          spreadInfo: { name: 'One-Card Insight', key: 'single', deckStyle: fixture.spreadDeckStyle },
          deckStyle: fixture.deckStyle,
          seed: 7,
          allowReversals: false,
          userQuestion: 'What supports reflection today?'
        })
      }),
      env: {
        MODAL_ENDPOINT_URL: 'https://modal.test',
        MODAL_PROXY_TOKEN: 'test-token',
        MODAL_MODEL: 'test-qwen',
        GRAPHRAG_ENABLED: 'false',
        EVAL_ENABLED: 'false',
        EVAL_GATE_ENABLED: 'false'
      },
      waitUntil: (promise) => promise.catch(() => {})
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.provider, 'modal-qwen');
    assert.equal(body.cardsInfo[0].card, 'Prince of Cups');
    assert.equal(body.cardsInfo[0].canonicalName, 'Knight of Cups');
    assert.equal(body.cardsInfo[0].orientation, 'Upright');
    const [resolved] = resolveReadingCards(body.cardsInfo, 'thoth-a1');
    assert.equal(resolved.canonicalKey, 'knight of cups');
    assert.equal(resolved.rankValue, 12);
    assert.ok(requests.length > 0);
    assert.match(requests[0].messages[1].content, /Prince of Cups/);
    assert.doesNotMatch(requests[0].messages[1].content, /King of Cups|Cups \(Water\) — King/);
  });
}
