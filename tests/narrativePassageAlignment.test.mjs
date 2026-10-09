import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { alignReadingPassages, resolveDynamicPassages } from '../src/lib/narrativePassageAligner.js';
import { createGestureFocusState, getCardPresence, reduceGestureFocus } from '../src/components/reading/narrative/narrativeGestureState.js';

const edition = 'rws-immanuelle-vector';
const spread = (...names) => names.map((name, index) => ({ index, name, canonicalName: name }));
const star = spread('The Star');
const align = (rawText, cards = star, artworkEdition = edition) => alignReadingPassages({ rawText, cards, artworkEdition });
const stream = (raw, cards = star, status = 'streaming') => resolveDynamicPassages({
  source: { runId: 'live-reading', sourceRevision: 0, raw, status, kind: status === 'complete' ? 'complete' : 'stream' },
  cards,
  artworkEdition: edition
});
const detailIds = (association) => association.targets.flatMap((target) => target.detailIds);
const fixture = (name) => JSON.parse(readFileSync(new URL(`../output/reading-motion/fixtures/${name}`, import.meta.url), 'utf8'));

test('named card headings and generic reading headings both introduce the described card', () => {
  for (const rawText of [
    '### The Star\n\nA figure pours water into a pool and onto the land.',
    '### Your Reading\n\nThe Star depicts a figure pouring water into a pool and onto the land.'
  ]) {
    const result = align(rawText);
    assert.deepEqual(result.introductions.map((intro) => intro.spreadIndex), [0], rawText);
    assert.ok(result.associations.some((association) => detailIds(association).includes('pool-pour')), rawText);
  }
});

test('a joint introduction preserves both card occurrences and their relationship', () => {
  const rawText = 'The Ace of Wands and Queen of Cups suggest that your drive and sensitivity can work together.';
  const result = align(rawText, spread('Ace of Wands', 'Queen of Cups'));
  assert.deepEqual(result.introductions.map((intro) => intro.spreadIndex).sort(), [0, 1]);
  const relationship = result.associations.find((association) => association.kind === 'relationship');
  assert.ok(relationship, 'joint introduction must not lose its relationship to an overlapping identity span');
  assert.deepEqual(relationship.targets.map((target) => target.spreadIndex).sort(), [0, 1]);
});

test('an explicit later card return remains available for identity inspection', () => {
  const rawText = 'The Star offers hope. A figure pours water into a pool.\n\nThe Hermit holds a lantern.\n\nThe Star returns to the question of renewal.';
  const result = align(rawText, spread('The Star', 'The Hermit'));
  const returnStart = rawText.lastIndexOf('The Star');
  const returned = result.associations.find((association) => association.kind === 'identity' && association.passage.start === returnStart);
  assert.ok(returned, 'changing paragraph context must not consume the later card mention');
  assert.deepEqual(returned.targets.map((target) => target.spreadIndex), [0]);
  assert.deepEqual(detailIds(returned), []);
});

test('detail cues follow prose order even when the artwork registry uses the opposite order', () => {
  const result = align('The Star shows water pouring onto the land and then into the pool.');
  const details = result.associations.filter((association) => detailIds(association).length);
  assert.deepEqual(details.map((association) => detailIds(association)[0]), ['land-pour', 'pool-pour']);
  assert.ok(result.associations.every((association, index, all) => index === 0 || all[index - 1].passage.end <= association.passage.start));
});

test('figurative keywords do not invent literal details or personal associations', () => {
  const rawText = 'The Star invites you to pool your resources and land a new role. Your memory of the interview may help.';
  const result = alignReadingPassages({ rawText, cards: star, userQuestion: 'Can I land a new role?' });
  assert.ok(result.associations.some((association) => association.kind === 'identity'));
  assert.deepEqual(result.associations.flatMap(detailIds), [], 'ungrounded idioms and memory are not painted pours');
  assert.ok(result.associations.every((association) => !association.personalContext), 'a shared keyword cannot establish personal relevance');
});

test('code, links, image metadata, and raw HTML cannot emit invisible or unrenderable gesture cues', () => {
  const fragments = [
    '`The Star pours water into a pool.`',
    '```text\nThe Star pours water into a pool.\n```',
    '[The Star pours water into a pool](https://example.test/card)',
    '[reference](https://example.test/The%20Star/pool/land)',
    '![The Star pours into a pool](https://example.test/pool.png)',
    '<div>The Star pours water into a pool.</div>'
  ];
  for (const rawText of fragments) {
    const result = align(rawText);
    assert.deepEqual(result.associations, [], rawText);
    assert.deepEqual(result.introductions, [], rawText);
  }
});

test('unsupported artwork editions retain card identity without vector geometry', () => {
  const result = align('The Star shows water pouring into a pool and onto the land.', star, 'rws-1909-scan');
  assert.equal(result.introductions.length, 1);
  assert.ok(result.associations.length > 0);
  assert.ok(result.associations.every((association) => association.kind === 'identity'));
  assert.deepEqual(result.associations.flatMap(detailIds), []);
});

test('Markdown destinations cannot borrow the preceding card context to become artwork details', () => {
  const rawText = 'The Star invites reflection.\n\nRead [the source](https://example.test/pool/land) or inspect ![water](https://example.test/pool.png).';
  const result = align(rawText);
  assert.ok(result.associations.some((association) => association.kind === 'identity'));
  assert.deepEqual(result.associations.flatMap(detailIds), []);
});

test('duplicate canonical cards do not arbitrarily assign an ambiguous mention to one occurrence', () => {
  const result = align('The Star shows water pouring into a pool.', spread('The Star', 'The Star'));
  assert.deepEqual(result.introductions, []);
  assert.deepEqual(result.associations, []);
});

test('streamed card names and unfinished physical words do not instantly finish emergence', () => {
  for (const raw of ['The Star', 'The Star shows a figure pouring water into a pool']) {
    const result = stream(raw);
    const introduction = result.introductions[0];
    assert.ok(getCardPresence({ introduction, visibleEnd: raw.length }) < 1, `premature full presence for ${raw}`);
    assert.equal(result.associations.some((association) => detailIds(association).includes('pool-pour')), false, 'uncommitted trailing token must not acquire a detail');
  }
  const committed = stream('The Star shows a figure pouring water into a pool.');
  assert.ok(committed.associations.some((association) => detailIds(association).includes('pool-pour')));
});

test('unfinished card-name tokens cannot create an association that is revoked by the next characters', () => {
  assert.deepEqual(stream('The Star').associations, []);
  assert.deepEqual(stream('The Starfish swims through the pool.').associations, []);
});

test('a committed held association keeps the same source span and selection as more text arrives', () => {
  const raw = 'The Star shows a figure pouring water into a pool.';
  const first = stream(raw);
  const pool = first.associations.find((association) => detailIds(association).includes('pool-pour'));
  assert.ok(pool);
  let state = createGestureFocusState({ runId: 'live-reading', sourceRevision: 0, ...first });
  state = reduceGestureFocus(state, { type: 'PROGRESS', runId: 'live-reading', sourceRevision: 0, progress: { visibleEnd: raw.length, complete: false } });
  state = reduceGestureFocus(state, { type: 'HOLD', runId: 'live-reading', sourceRevision: 0, selection: { kind: 'association', id: pool.id } });
  assert.equal(state.held?.id, pool.id);
  const next = stream(`${raw} The other pitcher pours onto the land.\n\nThe Star invites a gentler beginning.`);
  assert.deepEqual(next.associations.find((association) => association.id === pool.id), pool);
  state = reduceGestureFocus(state, { type: 'SOURCE', source: { runId: 'live-reading', sourceRevision: 0, status: 'streaming' }, ...next });
  assert.equal(state.held?.id, pool.id);
  assert.equal(state.current?.id, pool.id);
});

test('the recorded Star passage connects both literal pours with grounded later interpretation', () => {
  const sample = fixture('three-card-transition.json');
  const result = align(sample.excerpt, sample.cards);
  const memory = result.associations.find((association) => association.passage.start >= sample.excerpt.indexOf('One hand tends') && detailIds(association).includes('pool-pour'));
  const ground = result.associations.find((association) => association.passage.start >= sample.excerpt.indexOf('the other waters new ground') && detailIds(association).includes('land-pour'));
  assert.ok(memory, 'previously described pool returns for memory');
  assert.ok(ground, 'previously described land returns for new ground');
  assert.notEqual(memory.kind, 'literal', 'memory must not be mislabeled as a physical feature');
  assert.notEqual(ground.kind, 'literal', 'new ground is an interpretation of the described pour');
});

test('the recorded five-card reading retains all introductions, synthesis, and grounded next-step returns', () => {
  const sample = fixture('gestures-five-card-creative-project.json');
  const result = align(sample.reading, sample.cards);
  assert.deepEqual(result.introductions.map((intro) => intro.spreadIndex).sort(), [0, 1, 2, 3, 4]);
  const synthesisStart = sample.reading.indexOf('The Ace of Wands and Queen of Cups suggest');
  assert.ok(result.associations.some((association) => association.kind === 'relationship' && association.passage.start <= synthesisStart && association.passage.end > synthesisStart && association.targets.some((target) => target.spreadIndex === 0) && association.targets.some((target) => target.spreadIndex === 2)), 'Ace and Queen retain the drive/sensitivity relationship');
  const stepsStart = sample.reading.indexOf('### Gentle Next Steps');
  for (const [spreadIndex, detailId] of [[1, 'two-swords'], [3, 'collaborators'], [4, 'wheel']]) {
    assert.ok(result.associations.some((association) => association.passage.start > stepsStart && association.targets.some((target) => target.spreadIndex === spreadIndex && target.detailIds.includes(detailId))), `next steps return to ${detailId}`);
  }
  const closingStart = sample.reading.indexOf('### Closing');
  assert.ok(result.associations.some((association) => association.passage.start > closingStart && association.kind === 'identity' && association.targets.some((target) => target.spreadIndex === 0)), 'closing spark recalls the previously established Ace identity');
});

test('later names in the same sentence do not retract a committed literal or turn it into a relationship', () => {
  const cards = spread('The Star', 'The Hermit');
  const prefix = 'The Star shows water pouring into a pool, ';
  const first = stream(prefix, cards).associations.find(cue => detailIds(cue).includes('pool-pour'));
  assert.ok(first);
  const next = stream(`${prefix}and The Hermit holds a lantern.`, cards);
  assert.deepEqual(next.associations.find(cue => cue.id === first.id), first);
  assert.ok(next.associations.some(cue => detailIds(cue).includes('lantern')));
  assert.ok(next.associations.every(cue => cue.kind !== 'relationship'));
});

test('a nearby physical verb does not turn figurative pool and land into artwork nouns', () => {
  for (const rawText of [
    'The Star asks you to pour your energy into your work and pool your resources.',
    'The Star invites you to keep water on your desk as you land a new role.'
  ]) assert.deepEqual(align(rawText).associations.flatMap(detailIds), []);
});

test('a different named card cannot borrow an earlier card image for its interpretation', () => {
  const result = align('The Star shows water pouring into a pool.\n\n## The Hermit\n\nThe Hermit asks whether people back home might benefit from more distance.', spread('The Star', 'The Hermit'));
  assert.ok(result.associations.every(cue => cue.kind !== 'interpretation'));
});

test('a heading-only identity settles after its unsupported description paragraph closes', () => {
  const raw = '## The Fool\n\nA traveler walks toward an edge, a white dog beside him.\n\n## Next steps\n\nTake one small step.';
  const result = stream(raw, spread('The Fool'));
  assert.equal(result.introductions[0].pending, false);
  assert.equal(getCardPresence({ introduction: result.introductions[0], visibleEnd: raw.length }), 1);
});

test('inline HTML remains opaque even with whitespace after a sentence', () => {
  const result = align('<span>The Star pours water into a pool. </span>');
  assert.deepEqual(result.associations, []);
  assert.deepEqual(result.introductions, []);
});

test('an unspecified artwork edition cannot opt itself into vector details', () => {
  const raw = 'The Star shows water pouring into a pool.';
  const result = resolveDynamicPassages({ source: { runId: 'unknown-art', raw, status: 'complete' }, cards: star });
  assert.ok(result.associations.some(cue => cue.kind === 'identity'));
  assert.deepEqual(result.associations.flatMap(detailIds), []);
});

test('a spread-level edition cannot override an individual card artwork edition', () => {
  const cards = spread('The Star', 'The Hermit').map((card, index) => ({ ...card, artworkEdition: index ? 'rws-1909-scan' : edition }));
  const result = align('The Star pours water into a pool. The Hermit holds a lantern.', cards);
  assert.ok(result.associations.some(cue => detailIds(cue).includes('pool-pour')));
  assert.ok(result.associations.every(cue => !detailIds(cue).includes('lantern')));
});

test('a soft line break cannot prematurely commit a replaceable identity cue', () => {
  const cards = spread('The Star', 'The Hermit');
  assert.deepEqual(stream('The Star\n', cards).associations, []);
  const result = stream('The Star\nand The Hermit suggest balance.', cards);
  assert.equal(result.associations[0].kind, 'relationship');
});

test('closing quotation punctuation does not revoke an arrived literal cue', () => {
  const prefix = 'The Star shows a figure pouring into a pool.';
  const pool = stream(prefix).associations.find(cue => detailIds(cue).includes('pool-pour'));
  assert.ok(pool);
  assert.deepEqual(stream(`${prefix}”`).associations.find(cue => cue.id === pool.id), pool);
});
