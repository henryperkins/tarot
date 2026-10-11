import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { getVectorGestureDetails, projectGestureFrame, getVectorGestureCropZoom, CARD_GESTURE_PLANE } from '../src/data/cardGestureArtwork.js';
import { getAllCards } from '../src/lib/cardLookup.js';
import { getCardTouchPoints } from '../src/data/cardTouchPoints.js';
test('vector artwork keeps pours separate and confines trusted water geometry', () => {
  const [pool, land] = getVectorGestureDetails('The Star');
  assert.equal(pool.id, 'pool-pour'); assert.equal(land.id, 'land-pour');
  assert.ok(pool.terms.includes('memory')); assert.ok(land.terms.includes('new ground'));
  assert.notDeepEqual(pool.frame, land.frame);
  assert.equal(land.motionRecipe.rivulets.length, 5); assert.equal(land.motionRecipe.rivuletMaskWidth, 14);
  assert.ok(pool.motionRecipe.clips.pool); assert.equal(pool.motionRecipe.streams.length, 4);
  assert.deepEqual(CARD_GESTURE_PLANE, { width: 1086, height: 1810 });
});
test('edition dispatch never borrows scan coordinates; authored crops reverse once', () => {
  const targets = [['Ace of Wands', 'sprout'], ['Ace of Wands', 'castle'], ['Seven of Swords', 'carried'], ['Seven of Swords', 'two-swords'], ['Queen of Cups', 'cup'], ['Three of Pentacles', 'collaborators'], ['Wheel of Fortune', 'wheel'], ['The Hermit', 'lantern'], ['Five of Wands', 'staffs']];
  for (const [name, id] of targets) {
    const detail = getCardTouchPoints(name, { artworkEdition: 'rws-immanuelle-vector' }).find(entry => entry.id === id);
    assert.ok(detail, `${name}: ${id}`);
    const restored = projectGestureFrame(projectGestureFrame(detail.frame, true), true);
    assert.ok(Math.abs(restored.x - detail.frame.x) < 1e-12);
    assert.ok(Math.abs(restored.y - detail.frame.y) < 1e-12);
    assert.equal(restored.zoom, detail.frame.zoom);
  }
  for (const [name, id, x, y] of [['The Star', 'pool-pour', .725, .3], ['The Star', 'land-pour', .16, .275], ['The Hermit', 'lantern', .85, .768], ['Seven of Swords', 'two-swords', .252, .41], ['Wheel of Fortune', 'wheel', .516, .494]]) {
    const upright = getVectorGestureDetails(name).find(detail => detail.id === id).frame;
    const reversed = projectGestureFrame(upright, true);
    assert.ok(Math.abs(reversed.x - x) < 1e-12);
    assert.ok(Math.abs(reversed.y - y) < 1e-12);
    assert.equal(projectGestureFrame(upright, false).x, upright.x);
  }
  assert.deepEqual(getCardTouchPoints('The Star', { artworkEdition: 'unknown' }), []);
  assert.deepEqual(getVectorGestureDetails('Unknown'), []);
});
test('manifest contains 78 distinct present faces, excluding back', async () => {
  const root = new URL('../output/reading-motion/assets/rws-immanuelle/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
  const entries = manifest.cards || manifest.assets;
  assert.ok(entries);
  const files = (Array.isArray(entries) ? entries : Object.values(entries)).map(entry => entry.file || entry.filename || entry.local_file).filter(file => file && !file.includes('back'));
  assert.equal(new Set(files).size, 78);
  const faces = entries.filter(entry => entry.id !== 'back');
  const roster = getAllCards();
  assert.equal(new Set(roster.map(card => card.name)).size, 78);
  assert.deepEqual(new Set(faces.map(entry => entry.name.replace(/^The /, ''))), new Set(roster.map(card => card.name.replace(/^The /, ''))));
  assert.equal(faces.filter(entry => entry.arcana === 'major').length, 22);
  for (const suit of ['cups', 'wands', 'swords', 'pentacles']) assert.equal(faces.filter(entry => entry.suit === suit).length, 14);
  for (const face of faces) { assert.ok(face.width > 0); assert.ok(face.height > 0); }
  await Promise.all(files.map(file => access(new URL(file, root))));
});

test('multi-detail composition follows artwork metadata and short screens retain supported extents', async () => {
  const { getVectorGestureFrames, getVectorGestureFrame } = await import('../src/data/cardGestureArtwork.js');
  assert.deepEqual(getVectorGestureFrames('The Star', ['pool-pour', 'land-pour']), [['pool-pour', 'land-pour']]);
  assert.deepEqual(getVectorGestureFrames('Ace of Wands', ['sprout', 'castle']), [['sprout'], ['castle']]);
  assert.deepEqual(getVectorGestureFrames('Ace of Wands', ['sprout', 'castle'], { paired: true }), [['sprout', 'castle']]);
  for (const [name, id] of [['The Emperor', 'scepter'], ['Justice', 'scales']]) {
    const detail = getVectorGestureDetails(name).find(item => item.id === id);
    const frame = getVectorGestureFrame(name, [id]);
    assert.ok(frame.shortZoom < frame.zoom);
    for (const spot of detail.maskSpots) assert.ok((Math.abs(spot.y - frame.y) + spot.ry) * 266.667 * frame.shortZoom <= 33.001);
    assert.equal(getVectorGestureFrame(name, [id], true).shortZoom, frame.shortZoom);
  }
});

// Compact crop model, bound to the stylesheet so it cannot drift from the
// renderer: the plane is 160 x 266.667 CSS px, scaled about the projected
// frame point and centred in the art box. Desktop shows the whole card.
async function compactStages() {
  const css = await readFile(new URL('../src/styles/narrative-card-touch.css', import.meta.url), 'utf8');
  const compact = css.slice(css.indexOf('@media (max-width: 1023px) {\n  .narrative-panel__layout:has(.gesture-companion)'));
  assert.match(compact, /\.gesture-window \{ height: 106px; \}/);
  assert.match(compact, /\.gesture-focus-card \{ max-width: 232px; \}/);
  assert.match(compact, /\.gesture-focus-layer \{ gap: 10px; \}/);
  assert.match(compact, /\.gesture-art\[data-crop\] \.gesture-art__plane \{ width: 160px; height: 266\.667px;[^}]*scale\(min\(var\(--crop-zoom\), var\(--crop-fit-zoom, var\(--crop-zoom\)\)\)\) translate\(var\(--crop-x\), var\(--crop-y\)\)/);
  assert.match(css, /@media \(max-width: 359px\) \{ \.gesture-window \{ height: 96px; \}/);
  assert.match(css, /@media \(max-height: 600px\) and \(max-width: 1023px\) \{ \.gesture-window \{ height: 72px; \}[^\n]*scale\(min\(var\(--crop-zoom-short\), var\(--crop-fit-zoom, var\(--crop-zoom-short\)\)\)\)/);
  assert.match(css, /\.gesture-focus-card \{ display: flex; gap: 6px;/);
  return { plane: { width: 160, height: 266.667 }, stages: [
    { name: 'compact phone', width: 232, height: 106, zoom: frame => frame.zoom },
    { name: 'narrow phone', width: 232, height: 96, zoom: frame => frame.zoom },
    { name: 'short phone', width: 232, height: 72, zoom: frame => frame.shortZoom }
  ] };
}
function outsidePoints({ name, detailIds, reversed, width, height, zoom: zoomFor, plane }) {
  const { getVectorGestureFrame } = projection;
  const frame = getVectorGestureFrame(name, detailIds, reversed);
  const zoom = zoomFor(frame);
  return getVectorGestureDetails(name).filter(detail => detailIds.includes(detail.id)).flatMap(detail => detail.maskSpots.map(spot => {
    // Reversal rotates the upright plane once about its centre.
    const x = reversed ? 1 - spot.x : spot.x, y = reversed ? 1 - spot.y : spot.y;
    return { detail: detail.id, spot, dx: zoom * (x - frame.x) * plane.width, dy: zoom * (y - frame.y) * plane.height };
  })).filter(point => Math.abs(point.dx) > width / 2 || Math.abs(point.dy) > height / 2)
    .map(point => `${name}/${point.detail} ${reversed ? 'reversed' : 'upright'} (${point.spot.x}, ${point.spot.y}) at ${point.dx.toFixed(1)}, ${point.dy.toFixed(1)} px of ${width}x${height}`);
}
const projection = await import('../src/data/cardGestureArtwork.js');

test('compact, narrow and short phone crops keep every requested point inside the painted stage, upright and reversed', async () => {
  const { plane, stages } = await compactStages();
  const failures = [];
  for (const card of getAllCards()) for (const detail of getVectorGestureDetails(card.name)) for (const reversed of [false, true]) {
    for (const stage of stages) failures.push(...outsidePoints({ name: card.name, detailIds: [detail.id], reversed, width: stage.width, height: stage.height, zoom: stage.zoom, plane })
      .map(failure => `${stage.name}: ${failure}`));
  }
  assert.deepEqual(failures, []);
});

test('recorded relationship compositions keep requested points inside split and paired compact frames', async () => {
  const { plane } = await compactStages();
  const { getVectorGestureFrames } = projection;
  // Recorded fixture targets: five-card ace-meaning (one card, two frames),
  // Ace/Queen and Hermit/Five of Wands pairs (two cards, one frame each).
  const stageWidth = 361, gap = 10, cardGap = 6;
  const compositions = [
    { name: 'Ace of Wands', targets: [{ name: 'Ace of Wands', detailIds: ['sprout', 'castle'], reversed: false }] },
    { name: 'drive-and-sensitivity', targets: [{ name: 'Ace of Wands', detailIds: ['sprout'], reversed: false }, { name: 'Queen of Cups', detailIds: ['cup'], reversed: false }] },
    { name: 'celtic relationship', targets: [{ name: 'The Hermit', detailIds: ['lantern'], reversed: false }, { name: 'Five of Wands', detailIds: ['staffs'], reversed: true }] }
  ];
  const failures = [];
  for (const composition of compositions) {
    const paired = composition.targets.length > 1;
    const cardWidth = Math.min(232, paired ? (stageWidth - gap) / 2 : stageWidth);
    for (const target of composition.targets) {
      const frames = getVectorGestureFrames(target.name, target.detailIds, { paired });
      const artWidth = (cardWidth - cardGap * (frames.length - 1)) / frames.length;
      for (const ids of frames) failures.push(...outsidePoints({ name: target.name, detailIds: ids, reversed: target.reversed, width: artWidth, height: 106, zoom: frame => frame.zoom, plane }));
    }
  }
  assert.deepEqual(failures, []);
});

test('compact fit preserves painted mask extents in split, paired, narrow and short slots, with one reversal', () => {
  const failures = [];
  for (const card of getAllCards()) {
    const details = getVectorGestureDetails(card.name);
    const groups = [...details.map(detail => [detail.id]), ...(details.length > 1 ? [details.map(detail => detail.id)] : []), []];
    for (const ids of groups) for (const width of [232, 175.5, 113, 84]) for (const height of [106, 96, 72]) {
      const zoom = getVectorGestureCropZoom(card.name, ids, { width, height });
      const selected = details.filter(detail => ids.includes(detail.id));
      for (const reversed of [false, true]) {
        const frame = projection.getVectorGestureFrame(card.name, ids, reversed);
        const points = selected.length ? selected.flatMap(detail => [...detail.maskSpots.flatMap(spot => Array.from({ length: 96 }, (_, index) => {
          const angle = index * Math.PI / 48, rotation = (spot.rotation || 0) * Math.PI / 180;
          const dx = spot.rx * CARD_GESTURE_PLANE.width * Math.cos(angle), dy = spot.ry * CARD_GESTURE_PLANE.height * Math.sin(angle);
          return { x: spot.x + (dx * Math.cos(rotation) - dy * Math.sin(rotation)) / CARD_GESTURE_PLANE.width,
            y: spot.y + (dx * Math.sin(rotation) + dy * Math.cos(rotation)) / CARD_GESTURE_PLANE.height };
        })), ...(detail.cropBounds ? [{ x: detail.cropBounds.left, y: detail.cropBounds.top },
          { x: detail.cropBounds.right, y: detail.cropBounds.bottom }] : [])]) : [{ x: 0, y: 0 }, { x: 1, y: 1 }];
        for (const point of points.filter(point => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1)) {
          const x = reversed ? 1 - point.x : point.x, y = reversed ? 1 - point.y : point.y;
          const dx = (x - frame.x) * 160 * zoom, dy = (y - frame.y) * 266.667 * zoom;
          if (Math.abs(dx) > width / 2 - 2.999 || Math.abs(dy) > height / 2 - 2.999) failures.push(`${card.name}/${ids.join('+') || 'identity'} ${width}x${height} reversed=${reversed} at ${dx},${dy}`);
        }
      }
    }
  }
  assert.equal(failures.length, 0, failures.slice(0, 8).join('\n'));
});
