import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  analyzeBlock,
  buildCardLinkCatalog,
  expandTouchTerm,
  findCardMentions,
  readBlockFocus,
  remarkCardLinks
} from '../src/lib/narrativeCardLinks.js';
import { CARD_TOUCH_POINTS, getCardTouchPoints } from '../src/data/cardTouchPoints.js';
import { MAJOR_ARCANA } from '../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../src/data/minorArcana.js';

function spread(names, deckStyle) {
  const cards = names.map((name, index) => ({ index, name, canonicalName: name }));
  return buildCardLinkCatalog({ cards, deckStyle });
}

function mentionedCards(text, catalog) {
  return findCardMentions(text, catalog).map((mention) => [text.slice(mention.start, mention.end), mention.card]);
}

function touchWords(text, catalog, options) {
  return analyzeBlock(text, catalog, options).touches.map((touch) => [text.slice(touch.start, touch.end), touch.card, touch.point]);
}

function renderReading(markdown, catalog) {
  return renderToStaticMarkup(createElement(Markdown, {
    remarkPlugins: [remarkGfm, [remarkCardLinks, { catalog }]]
  }, markdown));
}

describe('card touch point data', () => {
  test('covers every card with well-formed points', () => {
    const names = [...MAJOR_ARCANA, ...MINOR_ARCANA].map((card) => card.name);
    assert.deepEqual(Object.keys(CARD_TOUCH_POINTS).sort(), [...names].sort());
    for (const name of names) {
      const points = getCardTouchPoints(name);
      assert.ok(points.length > 0, `${name} has touch points`);
      const ids = new Set();
      const owners = new Map();
      for (const point of points) {
        assert.ok(!ids.has(point.id), `${name}: duplicate id ${point.id}`);
        ids.add(point.id);
        for (const term of point.terms) {
          assert.equal(term, term.toLowerCase(), `${name}/${point.id}: "${term}" is lowercase`);
          for (const form of expandTouchTerm(term)) {
            const owner = owners.get(form);
            assert.ok(!owner || owner === point.id, `${name}: "${form}" is claimed by ${owner} and ${point.id}`);
            owners.set(form, point.id);
          }
        }
        for (const [x, y, r] of point.spots) {
          assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1, `${name}/${point.id}: spot inside the card`);
          assert.ok(r > 0 && r <= 0.35, `${name}/${point.id}: spot radius`);
        }
      }
    }
  });

  test('unknown cards have no points', () => {
    assert.deepEqual(getCardTouchPoints('The Void'), []);
  });

  test('derives plural forms unless a term is exact', () => {
    assert.deepEqual(expandTouchTerm('cup'), ['cup', 'cups']);
    assert.deepEqual(expandTouchTerm('falling figure'), ['falling figure', 'falling figures']);
    assert.deepEqual(expandTouchTerm('child'), ['child', 'children']);
    assert.deepEqual(expandTouchTerm('=star'), ['star']);
  });
});

describe('finding card names', () => {
  const catalog = spread(['The Tower', 'Six of Cups', 'The Star']);

  test('needs the capital a card name is written with', () => {
    assert.deepEqual(mentionedCards('The Tower falls, and the tower in your story falls too.', catalog), [['The Tower', 0]]);
    assert.deepEqual(mentionedCards('After the Tower comes the Six of Cups.', catalog), [['the Tower', 0], ['Six of Cups', 1]]);
  });

  test('reads Major Arcana by their bare names', () => {
    const majors = spread(['Death', 'The Hermit', 'Temperance', 'The Sun']);
    assert.deepEqual(
      mentionedCards('The larger movement is Death to Hermit to Temperance to Sun.', majors),
      [['Death', 0], ['Hermit', 1], ['Temperance', 2], ['Sun', 3]]
    );
  });

  test('leaves astrological weather alone', () => {
    const majors = spread(['The Moon', 'The Sun']);
    assert.deepEqual(mentionedCards('The New Moon in Libra lands in two weeks.', majors), []);
    assert.deepEqual(mentionedCards('With the Moon waxing, start small.', majors), []);
    assert.deepEqual(mentionedCards('With the Sun just entering Libra, weigh it.', majors), []);
  });

  test('tolerates curly apostrophes', () => {
    const courts = spread(['Queen of Cups', 'Knight of Swords']);
    assert.deepEqual(mentionedCards('The Queen of Cups’ cup stays covered.', courts), [['Queen of Cups', 0]]);
  });

  test('uses a court title only when one card holds it', () => {
    assert.deepEqual(mentionedCards('For the Queen, keep your own cup.', spread(['Queen of Cups', 'Knight of Swords'])), [['the Queen', 0]]);
    assert.deepEqual(mentionedCards('For the Queen, keep your own cup.', spread(['Queen of Cups', 'Queen of Swords'])), []);
  });

  test('knows the deck in play', () => {
    const thoth = spread(['Justice', 'Six of Cups'], 'thoth-a1');
    assert.deepEqual(mentionedCards('Adjustment asks for balance; Pleasure answers it.', thoth), [['Adjustment', 0], ['Pleasure', 1]]);
    const marseille = spread(['Strength', 'Page of Swords'], 'marseille-classic');
    assert.deepEqual(mentionedCards('La Force meets the Valet of Epees.', marseille), [['La Force', 0], ['Valet of Epees', 1]]);
    assert.equal(thoth.touchPointsEnabled, false);
    assert.equal(spread(['Justice']).touchPointsEnabled, true);
  });

  test('needs a spread', () => {
    assert.equal(buildCardLinkCatalog({ cards: [] }), null);
    assert.deepEqual(findCardMentions('The Tower', null), []);
  });
});

describe('reading a block', () => {
  const catalog = spread(['The Tower', 'Six of Cups', 'The Star']);

  test('lights what the passage describes on its card', () => {
    const text = 'The Star kneels beside a pool, pouring one pitcher into the water and the other onto the land.';
    const block = analyzeBlock(text, catalog);
    assert.equal(block.intro, 2);
    assert.equal(block.primary, 2);
    assert.equal(block.mode, 'single');
    assert.deepEqual(
      Array.from(new Set(block.touches.map((touch) => touch.point))),
      ['figure', 'pool', 'pitchers', 'land']
    );
  });

  test('sweeps across several named cards', () => {
    const text = 'From the Six of Cups to The Tower to The Star, the path runs from memory to upheaval to renewal.';
    const block = analyzeBlock(text, catalog);
    assert.equal(block.mode, 'sweep');
    assert.deepEqual(block.cards, [1, 0, 2]);
  });

  test('gives a detail to the card named nearest before it', () => {
    const text = 'Lightning strikes The Tower, and then The Star pours water into the pool while the crown falls.';
    const touches = touchWords(text, catalog);
    assert.deepEqual(touches.find(([word]) => word === 'pool'), ['pool', 2, 'pool']);
    // Only The Tower shows a crown, and it was named earlier in the passage.
    assert.deepEqual(touches.find(([word]) => word === 'crown'), ['crown', 0, 'crown']);
  });

  test('keeps details before a passing name with the passage card', () => {
    const cards = spread(['Queen of Cups', 'Knight of Swords', 'Two of Cups']);
    const text = 'Notice that both figures are still holding their cups. For the Knight, that means slowing down.';
    const block = analyzeBlock(text, cards, { context: 2 });
    assert.deepEqual(block.touches.map((touch) => [touch.card, touch.point]), [[2, 'couple'], [2, 'cups']]);
    assert.equal(block.primary, 2);
  });

  test('ignores idioms, elements, suit names and card names', () => {
    const tower = spread(['The Tower', 'Temperance', 'Ace of Cups']);
    assert.deepEqual(touchWords('The Tower is a fire card; on the other hand, it clears ground.', tower), []);
    assert.deepEqual(touchWords('The Tower moves through water, then fire, then air.', tower), []);
    assert.deepEqual(touchWords('In the Rider–Waite–Smith image, The Tower burns.', tower), []);
    assert.deepEqual(touchWords('Temperance points toward Sun and the Cups suit.', tower), []);
    assert.deepEqual(
      touchWords('Temperance pours water between two cups, one foot on land.', tower).map(([word]) => word),
      ['pours', 'water', 'cups', 'one foot on land']
    );
  });

  test('lights at most four details per card, specific ones first', () => {
    const fool = spread(['The Fool']);
    const text = 'The Fool, a young figure, steps toward the cliff with a white rose, a small dog, his bundle, his staff and the sun behind.';
    const points = Array.from(new Set(analyzeBlock(text, fool).touches.map((touch) => touch.point)));
    assert.equal(points.length, 4);
    assert.ok(!points.includes('figure'));
  });

  test('stays dark for decks without placed points', () => {
    const thoth = spread(['The Star'], 'thoth-a1');
    assert.deepEqual(analyzeBlock('The Star pours water into the pool.', thoth).touches, []);
  });
});

describe('remark plugin', () => {
  const catalog = spread(['The Tower', 'Six of Cups', 'The Star']);
  const reading = [
    '## Your reading',
    '',
    'This spread moves from memory through upheaval toward renewal.',
    '',
    '## The Star',
    '',
    'In the future, The Star kneels at a pool and pours from one pitcher.',
    '',
    'She is unhurried, and the water keeps moving.',
    '',
    '- The **Six of Cups** offers a cup of flowers.'
  ].join('\n');

  test('marks blocks, names and described details', () => {
    const html = renderReading(reading, catalog);
    assert.match(html, /<h2 data-reading-block="1"[^>]*>Your reading<\/h2>/);
    assert.match(html, /<span class="narrative-emphasis reading-card-ref" data-card-index="2">The Star<\/span>/);
    assert.match(html, /<span class="reading-imagery" data-card-index="2" data-touch-id="pool">pool<\/span>/);
    assert.match(html, /<span class="reading-imagery" data-card-index="2" data-touch-id="pitchers">pitcher<\/span>/);
    // The passage carries on without naming its card again.
    assert.match(html, /data-block-cards="2"[^>]*data-block-primary="2"[^>]*data-block-mode="single"[^>]*data-block-touches="2:pool"[^>]*>She is unhurried, and the <span class="reading-imagery" data-card-index="2" data-touch-id="pool">water<\/span>/);
  });

  test('sets the card into the paragraph that opens its passage only', () => {
    const html = renderReading(reading, catalog);
    const intros = [...html.matchAll(/data-card-intro="(\d+)"/g)].map((match) => match[1]);
    assert.deepEqual(intros, ['2']);
    assert.doesNotMatch(html, /data-card-intro="[^"]*"[^>]*>This spread moves/);
  });

  test('wraps a name split by formatting', () => {
    const html = renderReading('The **Six of Cups** offers a cup of flowers.', catalog);
    assert.match(html, /<strong><span class="narrative-emphasis reading-card-ref" data-card-index="1">Six of Cups<\/span><\/strong>/);
  });

  test('reads a rendered block back as focus', () => {
    const dataset = {
      readingBlock: '4',
      blockCards: '2 1',
      blockPrimary: '2',
      blockMode: 'single',
      blockTouches: '2:pool 2:pitchers 2:pool 1:children'
    };
    assert.deepEqual(readBlockFocus({ dataset }), {
      key: 'block:4:2 1:2:pool 2:pitchers 2:pool 1:children',
      mode: 'single',
      cards: [2, 1],
      primary: 2,
      touches: { 2: ['pool', 'pitchers'], 1: ['children'] }
    });
    assert.equal(readBlockFocus({ dataset: { readingBlock: '1', blockCards: '' } }), null);
    assert.equal(readBlockFocus(null), null);
  });
});

test('authored raw ranges preserve a whole emphasized phrase and reject changed source', async () => {
  const { resolveGestureSidecar } = await import('../src/lib/narrativeCardLinks.js');
  const raw = '🌟 The **Star** pours; The **Star** pours.';
  const start = raw.lastIndexOf('The');
  const sidecar = { expectedRaw: raw, associations: [{ id: 'second', kind: 'literal', targets: [{ spreadIndex: 0, canonicalName: 'The Star', detailIds: ['pool-pour'] }], passage: { start, end: raw.length, quote: raw.slice(start) } }], introductions: [] };
  const cards = [{ index: 0, name: 'The Star' }];
  const result = resolveGestureSidecar({ sidecar, source: { runId: 'run', raw }, cards });
  assert.equal(result.associations[0].targets[0].occurrenceId, 'run:0');
  const html = renderToStaticMarkup(createElement(Markdown, { remarkPlugins: [[remarkCardLinks, { associations: result.associations }]] }, raw));
  assert.match(html, /data-gesture-id="second"[^>]*>The <strong>Star<\/strong> pours\.<\/span>/);
  assert.equal(resolveGestureSidecar({ sidecar, source: { runId: 'run', raw: raw.replace('pours', 'waits') }, cards }).associations.length, 0);
  assert.equal(resolveGestureSidecar({ sidecar, source: { runId: 'run', raw: raw.slice(0, -2) }, cards }).associations.length, 0);
});

test('authored association validation keeps optional context independent and occurrences distinct', async () => {
  const { resolveGestureSidecar } = await import('../src/lib/narrativeCardLinks.js');
  const raw = "L'étoile 🌟 revient. L'étoile 🌟 revient.";
  const cards = [{ index: 0, name: 'The Star' }, { index: 1, name: 'The Star' }];
  const sidecar = { expectedRaw: raw, associations: [{ id: 'return', kind: 'relationship', passage: { start: 0, end: raw.length, quote: raw }, targets: cards.map((card) => ({ spreadIndex: card.index, canonicalName: card.name, detailIds: ['pool-pour'] })), personalContext: { type: 'card-reflection', spreadIndex: 0, quote: 'nostalgic' } }], introductions: [{ spreadIndex: 0, canonicalName: 'The Star', start: 0, namedEnd: 2, descriptionStart: 3, midpoint: 8, end: raw.length }] };
  const result = resolveGestureSidecar({ sidecar, source: { runId: 'translated', raw }, cards });
  assert.deepEqual(result.associations[0].targets.map((target) => target.occurrenceId), ['translated:0', 'translated:1']);
  assert.equal(result.associations[0].personalContext, undefined);
  assert.equal(resolveGestureSidecar({ sidecar, source: { runId: 'translated', raw: raw.slice(0, 5) }, cards }).introductions.length, 1);
  assert.equal(resolveGestureSidecar({ sidecar, source: { runId: 'translated', raw }, cards: [{ index: 0, name: 'The Moon' }] }).associations.length, 0);
});

test('authored annotations exclude code, HTML, links, cross-block and overlapping phrases', () => {
  for (const raw of ['`The Star`', '<span>The Star</span>', '[The Star](https://example.com)', 'The Star\n\nreturns']) {
    const associations = [{ id: 'excluded', passage: { start: 0, end: raw.length, quote: raw } }];
    const html = renderToStaticMarkup(createElement(Markdown, { skipHtml: true, remarkPlugins: [[remarkCardLinks, { associations }]] }, raw));
    assert.doesNotMatch(html, /data-gesture-id/);
  }
  const raw = 'The Star pours';
  const associations = [ { id: 'a', passage: { start: 0, end: 8, quote: 'The Star' } }, { id: 'b', passage: { start: 4, end: 14, quote: 'Star pours' } } ];
  assert.doesNotMatch(renderToStaticMarkup(createElement(Markdown, { remarkPlugins: [[remarkCardLinks, { associations }]] }, raw)), /data-gesture-id/);
});

test('recorded sidecars preserve raw fixtures, hash and independent detail targets', async () => {
  const { readFile } = await import('node:fs/promises');
  const { createHash } = await import('node:crypto');
  const { resolveGestureSidecar } = await import('../src/lib/narrativeCardLinks.js');
  const load = async (name) => JSON.parse(await readFile(new URL(`../output/reading-motion/fixtures/${name}.json`, import.meta.url), 'utf8'));
  const sidecars = await load('gesture-sidecars');
  for (const [key, file, count, cues] of [['star','three-card-transition',97,6],['related','gestures-celtic-deep-shift',183,6],['fiveCard','gestures-five-card-creative-project',904,25]]) {
    const fixture = await load(file); const sidecar = sidecars[key]; const raw = fixture.reading || fixture.excerpt;
    assert.equal(sidecar.expectedRaw, raw);
    assert.equal(raw.replace(/[*_]/g, '').trim().split(/\s+/).length, count);
    assert.equal(sidecar.associations.length, cues);
    const resolved = resolveGestureSidecar({ sidecar, source: { runId: key, raw }, cards: fixture.cards });
    assert.deepEqual(resolved.invalid, []);
    assert.equal(resolved.associations.length, cues);
  }
  assert.equal(createHash('sha256').update(sidecars.fiveCard.expectedRaw).digest('hex'), 'd3c52d35597669deb2bd4770d532934c47f775ba894c9b7a60974231b0eab91b');
  const cues = sidecars.fiveCard.associations;
  assert.deepEqual(cues.find((cue) => cue.id === 'ace-meaning').targets[0].detailIds, ['sprout','castle']);
  assert.deepEqual(cues.find((cue) => cue.id === 'drive-and-sensitivity').targets.map((target) => target.detailIds), [['sprout'],['cup']]);
  assert.deepEqual(cues.find((cue) => cue.id === 'readiness').targets.map((target) => target.detailIds), [[],[]]);
  assert.equal(sidecars.fiveCard.introductions.length, 5);
});
