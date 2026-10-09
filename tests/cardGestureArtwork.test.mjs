import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { getVectorGestureDetails, projectGestureFrame, CARD_GESTURE_PLANE } from '../src/data/cardGestureArtwork.js';
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
