import assert from 'node:assert/strict';
import test from 'node:test';
import { getAllCards } from '../src/lib/cardLookup.js';
import { getVectorGestureDetails, projectGestureFrame } from '../src/data/cardGestureArtwork.js';
import { alignReadingPassages } from '../src/lib/narrativePassageAligner.js';
import { MAJOR_EXAMPLES } from '../src/data/cardGestureDetails/majors.js';
import { CUP_PENTACLE_EXAMPLES } from '../src/data/cardGestureDetails/cupsPentacles.js';

import { WAND_SWORD_EXAMPLES } from '../src/data/cardGestureDetails/wandsSwords.js';

const edition = 'rws-immanuelle-vector';
const examples = [...MAJOR_EXAMPLES, ...CUP_PENTACLE_EXAMPLES, ...WAND_SWORD_EXAMPLES];

test('each of the 78 vector faces has distinct, bounded authored details', () => {
  for (const card of getAllCards()) {
    const details = getVectorGestureDetails(card.name);
    assert.ok(details.length, `${card.name} has a detail treatment`);
    assert.equal(new Set(details.map(detail => detail.id)).size, details.length);
    for (const detail of details) {
      assert.ok(detail.maskSpots.length, `${card.name}/${detail.id} has localized light`);
      for (const spot of detail.maskSpots) {
        for (const field of ['x', 'y', 'rx', 'ry']) assert.ok(Number.isFinite(spot[field]));
        assert.ok(spot.x >= 0 && spot.x <= 1 && spot.y >= 0 && spot.y <= 1);
        assert.ok(spot.rx > 0 && spot.rx <= .5 && spot.ry > 0 && spot.ry <= .5);
      }
      assert.ok(detail.frame.x >= 0 && detail.frame.x <= 1 && detail.frame.y >= 0 && detail.frame.y <= 1);
      assert.ok(detail.frame.zoom > 0 && detail.frame.zoom <= 3);
      const restored = projectGestureFrame(projectGestureFrame(detail.frame, true), true);
      assert.ok(Math.abs(restored.x - detail.frame.x) < 1e-12 && Math.abs(restored.y - detail.frame.y) < 1e-12);
    }
  }
});

test('authored visual probes produce their intended literal detail through the real aligner', () => {
  for (const { card, detailId, text } of examples) {
    const rawText = `### ${card}\n\n${text}`;
    const result = alignReadingPassages({ rawText, cards: [{ index: 0, name: card }], artworkEdition: edition });
    assert.deepEqual(result.errors, [], card);
    assert.ok(result.associations.some(cue => cue.kind === 'literal' && cue.targets[0].detailIds.includes(detailId)), `${card}/${detailId}: ${text}`);
    for (const cue of result.associations) assert.equal(rawText.slice(cue.passage.start, cue.passage.end), cue.passage.quote);
  }
});

test('expanded treatments do not activate for explicitly figurative terms or a different edition', () => {
  for (const { card, detailId, text } of examples) {
    const detail = getVectorGestureDetails(card).find(detail => detail.id === detailId);
    assert.ok(detail, `${card}/${detailId}`);
    const cards = [{ index: 0, name: card }];
    const figurative = alignReadingPassages({ rawText: `${card}. Consider ${detail.terms[0]} as a metaphor for an opportunity.`, cards, artworkEdition: edition });
    assert.ok(figurative.associations.every(cue => !cue.targets.some(target => target.detailIds.length)), `${card}/${detailId} metaphor`);
    const foreign = alignReadingPassages({ rawText: `${card}. ${text}`, cards, artworkEdition: 'rws-1909-scan' });
    assert.ok(foreign.associations.every(cue => !cue.targets.some(target => target.detailIds.length)), `${card}/${detailId} edition`);
  }
});

test('expanded details require a depicted physical clause rather than personal idioms or negation', () => {
  for (const [card, prose] of [
    ['Two of Swords', 'You wear a blindfold when you refuse to consider another viewpoint.'],
    ['Eight of Pentacles', 'Your need to hammer out a plan can make even gentle creative work feel urgent.'],
    ['Justice', 'You hold the scales of your own priorities in your hands.'],
    ['The Moon', 'No crayfish emerges from the pool in this description.'],
    ['The Moon', 'A crayfish does not emerge from the pool.'],
    ['The Fool', 'Imagine a white dog leaping beside the traveler as a metaphor for companionship.'],
    ['The Fool', 'Figuratively, a white dog leaps beside the traveler.']
  ]) {
    const result = alignReadingPassages({ rawText: `${card}. ${prose}`, cards: [{ index: 0, name: card }], artworkEdition: edition });
    assert.ok(result.associations.some(cue => cue.kind === 'identity'), card);
    assert.deepEqual(result.associations.flatMap(cue => cue.targets.flatMap(target => target.detailIds)), [], `${card}: ${prose}`);
  }
});

test('physical detail and its following interpretation can share a sentence', () => {
  for (const prose of [
    'A white dog leaps beside the traveler as a metaphor for companionship.',
    'A white dog leaps beside the traveler, reminding you that support can come quietly.',
    'You may feel uncertain, but a white dog leaps beside the traveler in the picture.'
  ]) {
    const result = alignReadingPassages({ rawText: `The Fool. ${prose}`, cards: [{ index: 0, name: 'The Fool' }], artworkEdition: edition });
    assert.ok(result.associations.some(cue => cue.targets[0].detailIds.includes('white-dog')), prose);
  }
});
