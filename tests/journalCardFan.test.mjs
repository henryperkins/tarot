// Journal card fan geometry: every rotated card stays inside the section, card
// names get full-width label columns when they fit, and overlap only happens
// when the spread is too wide for columns.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  computeFanLayout,
  FAN_ACTIVE_LIFT,
  FAN_EDGE_PADDING,
  FAN_MAX_CARD_WIDTH,
  FAN_MIN_CARD_WIDTH,
  FAN_MIN_COLUMN_EM
} from '../src/components/journal/entry-card/EntrySections/CardsDrawnSection/fanGeometry.js';

const EPSILON = 0.5;

// Mirrors the CardFan transform: bottom-centre pivot at (width / 2 + x,
// height - baseline - lift), then rotate(rotation) about that pivot.
function cardCorners(layout, width, card, active = false) {
  const lift = card.lift + (active ? FAN_ACTIVE_LIFT : 0);
  const pivotX = width / 2 + card.x;
  const pivotY = layout.height - layout.baseline - lift;
  const angle = (card.rotation * Math.PI) / 180;
  const half = layout.cardWidth / 2;
  return [[-half, 0], [half, 0], [-half, -layout.cardHeight], [half, -layout.cardHeight]].map(([x, y]) => [
    pivotX + x * Math.cos(angle) - y * Math.sin(angle),
    pivotY + x * Math.sin(angle) + y * Math.cos(angle)
  ]);
}

test('every rotated card stays inside the section at every width, count and text size', () => {
  for (const fontPx of [16, 20, 32]) {
    for (const width of [150, 180, 200, 240, 260, 320, 480, 700, 900]) {
      for (let count = 1; count <= 10; count += 1) {
        const layout = computeFanLayout({ count, width, rootFontPx: fontPx });
        assert.equal(layout.cards.length, count);
        assert.ok(layout.cardWidth >= FAN_MIN_CARD_WIDTH && layout.cardWidth <= FAN_MAX_CARD_WIDTH,
          `card width ${layout.cardWidth} at ${width}px, ${count} cards`);
        layout.cards.forEach((card, index) => {
          for (const active of layout.mode === 'caption' ? [false, true] : [false]) {
            for (const [x, y] of cardCorners(layout, width, card, active)) {
              const where = `${count} cards, card ${index}, ${width}px, ${fontPx}px text, ${layout.mode}${active ? ', selected' : ''}`;
              assert.ok(x >= FAN_EDGE_PADDING - EPSILON && x <= width - FAN_EDGE_PADDING + EPSILON, `x ${x.toFixed(1)}: ${where}`);
              assert.ok(y >= FAN_EDGE_PADDING - EPSILON && y <= layout.height - FAN_EDGE_PADDING + EPSILON, `y ${y.toFixed(1)}: ${where}`);
            }
          }
        });
      }
    }
  }
});

test('label columns hold every name and never exceed the section', () => {
  for (const fontPx of [16, 20]) {
    for (const width of [240, 260, 320, 480, 700]) {
      for (let count = 1; count <= 10; count += 1) {
        const layout = computeFanLayout({ count, width, rootFontPx: fontPx });
        if (layout.mode !== 'labels') continue;
        assert.ok(layout.column >= FAN_MIN_COLUMN_EM * fontPx, `column ${layout.column} at ${width}px`);
        assert.ok(layout.column * count <= width - 2 * FAN_EDGE_PADDING + EPSILON);
        if (count > 1) assert.equal(layout.step, layout.column);
      }
    }
  }
});

test('common spreads get the roomiest layout the section allows', () => {
  const desktopThree = computeFanLayout({ count: 3, width: 698 });
  assert.equal(desktopThree.mode, 'labels');
  assert.equal(desktopThree.cardWidth, FAN_MAX_CARD_WIDTH);

  const phoneThree = computeFanLayout({ count: 3, width: 260 });
  assert.equal(phoneThree.mode, 'labels', 'a phone-width three-card reading keeps its names');
  assert.ok(phoneThree.cardWidth >= 56);

  const desktopCeltic = computeFanLayout({ count: 10, width: 698 });
  assert.equal(desktopCeltic.mode, 'caption');
  assert.ok(desktopCeltic.step < desktopCeltic.cardWidth, 'ten cards overlap at desktop width');
  assert.ok(desktopCeltic.cardWidth >= 64, 'and stay large enough to recognise');

  const enlargedThree = computeFanLayout({ count: 3, width: 200, rootFontPx: 20 });
  assert.equal(enlargedThree.mode, 'caption', 'enlarged text at 320px moves names into the caption');

  const single = computeFanLayout({ count: 1, width: 200, rootFontPx: 20 });
  assert.equal(single.mode, 'labels');
  assert.equal(single.cards[0].rotation, 0);
});

test('the centre card sits on top and the arc is symmetric', () => {
  const layout = computeFanLayout({ count: 5, width: 300 });
  const z = layout.cards.map((card) => card.zIndex);
  assert.equal(Math.max(...z), z[2]);
  assert.equal(layout.cards[0].rotation, -layout.cards[4].rotation);
  assert.equal(layout.cards[0].x, -layout.cards[4].x);
  assert.equal(layout.cards[1].lift, layout.cards[3].lift);
});

test('an empty spread lays out nothing', () => {
  const layout = computeFanLayout({ count: 0, width: 500 });
  assert.deepEqual(layout.cards, []);
  assert.equal(layout.height, 0);
});
