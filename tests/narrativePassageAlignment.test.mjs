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

test('recorded Star imagery stays literal until a semantic association source supplies interpretation', () => {
  const sample = fixture('three-card-transition.json');
  const result = align(sample.excerpt, sample.cards);
  assert.deepEqual(result.associations.filter(cue => cue.kind === 'literal').flatMap(detailIds), ['pool-pour', 'land-pour']);
  assert.ok(result.associations.every(cue => cue.kind !== 'interpretation' && cue.kind !== 'balance'));
  assert.ok(result.associations.every(cue => !cue.personalContext));
});

test('the recorded five-card reading retains introductions and named relationships without memorized returns', () => {
  const sample = fixture('gestures-five-card-creative-project.json');
  const result = align(sample.reading, sample.cards);
  assert.deepEqual(result.introductions.map(intro => intro.spreadIndex).sort(), [0, 1, 2, 3, 4]);
  const synthesisStart = sample.reading.indexOf('The Ace of Wands and Queen of Cups suggest');
  const pair = result.associations.find(cue => cue.kind === 'relationship' && cue.passage.start <= synthesisStart && cue.passage.end > synthesisStart);
  assert.deepEqual(pair?.targets.map(target => target.spreadIndex), [0, 2]);
  assert.deepEqual(pair.targets.flatMap(target => target.detailIds), []);
  const stepsStart = sample.reading.indexOf('### Gentle Next Steps');
  assert.ok(result.associations.filter(cue => cue.passage.start > stepsStart).every(cue => detailIds(cue).length === 0));
  assert.ok(result.associations.every(cue => cue.kind !== 'interpretation' && cue.kind !== 'balance'));
});

test('a future named card cannot lend ownership or scene evidence to an earlier detail', () => {
  const cards = spread('The Star', 'The Hermit');
  const prefix = 'The Star shows water pouring into a pool, ';
  assert.deepEqual(stream(prefix, cards).associations, [], 'an open sentence can still acquire negation');
  const closed = stream(`${prefix}and The Hermit holds a lantern.`, cards);
  assert.deepEqual(closed.associations.filter(cue => cue.kind === 'literal').map(cue => [cue.targets[0].canonicalName, ...detailIds(cue)]), [
    ['The Star', 'pool-pour'], ['The Hermit', 'lantern']
  ]);
  assert.ok(closed.associations.every(cue => cue.kind !== 'relationship'));
  const wrongOwner = align('The Star describes a lantern, and The Hermit holds a staff.', cards);
  assert.deepEqual(wrongOwner.associations.flatMap(detailIds), []);
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

test('named pairs never inherit geometry just because their images were described earlier', () => {
  for (const ending of [
    'The Ace of Wands and Queen of Cups suggest both your drive and your sensitivity are worth trusting.',
    'The Ace of Wands and Queen of Cups appear together.'
  ]) {
    const result = align(`Ace of Wands. A hand offers a wand still sprouting leaves. Queen of Cups. She holds an ornate, covered cup. ${ending}`, spread('Ace of Wands', 'Queen of Cups'));
    assert.deepEqual(result.associations.filter(cue => cue.kind === 'literal').flatMap(detailIds), ['sprout', 'cup']);
    assert.ok(result.associations.filter(cue => cue.kind === 'relationship').every(cue => cue.targets.every(target => target.detailIds.length === 0)));
  }
});

test('the recorded Celtic physical clauses survive qualifiers without interpreting later metaphors', () => {
  const sample = fixture('gestures-celtic-deep-shift.json');
  const result = align(sample.excerpt, sample.cards);
  assert.deepEqual(result.associations.filter(cue => cue.kind === 'literal').flatMap(detailIds), ['lantern', 'staffs']);
  assert.ok(result.associations.every(cue => cue.kind !== 'interpretation'));
});

test('expanded live details wait for a complete physical statement and remain stable while held', () => {
  const cards = spread('The Fool');
  const prefix = 'The Fool. A white dog leaps beside the traveler ';
  const first = stream(prefix, cards);
  assert.deepEqual(first.associations.flatMap(detailIds), [], 'future qualifiers have not arrived');
  assert.equal(first.introductions[0].pending, true);
  const raw = `${prefix}as a metaphor for companionship.`;
  const closed = stream(raw, cards);
  const dog = closed.associations.find(cue => detailIds(cue).includes('white-dog'));
  assert.ok(dog, 'the physical description survives its interpretive explanation');
  assert.equal(closed.introductions[0].pending, false);
  let state = createGestureFocusState({ runId: 'live-reading', sourceRevision: 0, ...closed });
  state = reduceGestureFocus(state, { type: 'PROGRESS', runId: 'live-reading', sourceRevision: 0, progress: { visibleEnd: raw.length, complete: false } });
  state = reduceGestureFocus(state, { type: 'HOLD', runId: 'live-reading', sourceRevision: 0, selection: { kind: 'association', id: dog.id } });
  const next = stream(`${raw} You can decide what that companionship means for you.`, cards);
  assert.deepEqual(next.associations.find(cue => cue.id === dog.id), dog);
  state = reduceGestureFocus(state, { type: 'SOURCE', source: { runId: 'live-reading', sourceRevision: 0, status: 'streaming' }, ...next });
  assert.equal(state.held?.id, dog.id);
  assert.equal(state.current?.id, dog.id);
});

test('all cards wait for late qualifiers, then preserve closed physical associations', () => {
  for (const [name, prefix, ending] of [
    ['The Moon', 'A crayfish ', 'does not emerge from the pool.'],
    ['The Hermit', 'A lantern ', 'is not held by the figure.'],
    ['Queen of Cups', 'Her covered cup ', 'is not held in either hand.']
  ]) {
    const cards = spread(name);
    assert.deepEqual(stream(`${name}. ${prefix}`, cards).associations.flatMap(detailIds), []);
    assert.deepEqual(stream(`${name}. ${prefix}${ending}`, cards).associations.flatMap(detailIds), []);
  }
  const prefix = 'The Star shows water pouring into a pool, ';
  assert.deepEqual(stream(prefix).associations.flatMap(detailIds), []);
  const closed = `${prefix}as a metaphor for memory.`;
  const pool = stream(closed).associations.find(cue => detailIds(cue).includes('pool-pour'));
  assert.ok(pool);
  assert.deepEqual(stream(`${closed} Take that at your own pace.`).associations.find(cue => cue.id === pool.id), pool);
});

test('one physical-clause guard protects the original cards without rejecting observation or adjective lists', () => {
  const positive = [
    ['Queen of Cups', 'She holds an ornate, covered cup.', 'cup'],
    ['The Hermit', 'You see him holding a lantern.', 'lantern'],
    ['The Hermit', 'In the picture, you can see him holding a lantern.', 'lantern'],
    ['The Hermit', 'His lantern is held close and lights only the next few steps, not the whole mountain.', 'lantern'],
    ['The Star', 'The figure pours one pitcher into a pool and the other onto the land.', 'pool-pour'],
    ['Five of Wands', 'On the card, five people swing staffs in a chaotic scrum.', 'staffs']
  ];
  for (const [name, prose, expected] of positive) {
    const result = align(`${name}. ${prose}`, spread(name));
    assert.ok(result.associations.some(cue => detailIds(cue).includes(expected)), `${name}: ${prose}`);
  }
  const negative = [
    ['The Hermit', 'You do not hold a lantern here.'],
    ['The Hermit', 'You see yourself holding a lantern.'],
    ['The Hermit', 'Let your own lantern light the way.'],
    ['The Hermit', 'There is no lantern held here.'],
    ['The Hermit', 'Imagine him holding a lantern.'],
    ['Five of Wands', 'There is no clash of staves.'],
    ['Queen of Cups', 'She does not hold an ornate, covered cup.'],
    ['The Star', 'You are pouring energy into a pool of other people’s needs.'],
    ['The Star', 'Imagine The Star pouring water into a pool.'],
    ['Ace of Wands', 'Your wand is still sprouting leaves as a metaphor for ambition.'],
    ['Seven of Swords', 'Your figure carries five swords in the imagined camp.'],
    ['Three of Pentacles', 'There is no craftsman in this cathedral.'],
    ['Wheel of Fortune', 'The great wheel does not bear a sphinx.']
  ];
  for (const [name, prose] of negative) assert.deepEqual(align(`${name}. ${prose}`, spread(name)).associations.flatMap(detailIds), [], `${name}: ${prose}`);
});
