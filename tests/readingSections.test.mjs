import test from 'node:test';
import assert from 'node:assert/strict';
import * as sections from '../src/lib/narrativeSections.js';

test('reading contents keep source offsets and omit nested card headings', () => {
  const raw = '## Opening\n\nA quiet start.\n\n## The Story\n\n### Six of Swords\n\nYour own words.\n\n## Next steps\n\nRest.';
  const result = sections.getReadingSections?.(raw);
  assert.deepEqual(result?.map(({ title, start }) => ({ title, start })), [
    { title: 'Opening', start: 0 },
    { title: 'The Story', start: 28 },
    { title: 'Next steps', start: 78 }
  ]);
  assert.equal(result?.map(section => raw.slice(section.start, section.end)).join(''), raw);
});

test('contents recognize setext headings and ignore headings inside fenced code', () => {
  const raw = 'Opening\n=======\n\nA beginning.\n\n```md\n# A quoted heading\n```\n\nClosing\n=======\n\nAn end.';
  assert.deepEqual(sections.getReadingSections?.(raw)?.map(section => section.title), ['Opening', 'Closing']);
});

test('duplicate and non-Latin headings have unique stable destinations during streaming', () => {
  const prefix = '## 静かな始まり\n\n🌙 Your question.\n\n## Reflection\n\nA thought.\n\n## Reflection\n\n';
  const before = sections.getReadingSections?.(prefix);
  const after = sections.getReadingSections?.(`${prefix}Another thought.`);
  assert.deepEqual(before?.map(section => section.id), ['reading-section-0', 'reading-section-30', 'reading-section-57']);
  assert.deepEqual(after?.map(section => section.id), before?.map(section => section.id));
});

test('plain readings and an unheaded introduction remain reachable without changing prose', () => {
  const raw = 'Your introduction.\n\n## The Story\n\nYour story.';
  const result = sections.getReadingSections?.(raw);
  assert.deepEqual(result?.map(section => section.title), ['Introduction', 'The Story']);
  assert.equal(result?.map(section => raw.slice(section.start, section.end)).join(''), raw);
  assert.deepEqual(sections.getReadingSections?.('Plain text.')?.map(section => section.title), ['Your reading']);
  assert.deepEqual(sections.getReadingSections?.(''), []);
});

test('leading whitespace belongs to the document while its heading keeps its actual anchor', () => {
  const raw = '\n\n## Opening\n\nYour words.';
  const result = sections.getReadingSections(raw);
  assert.equal(result[0].id, 'reading-section-2');
  assert.equal(result[0].headingStart, 2);
  assert.equal(raw.slice(result[0].start, result[0].end), raw);
});

const chapterCards = [
  { index: 0, name: 'The Tower', canonicalName: 'The Tower' },
  { index: 1, name: 'The Hermit', canonicalName: 'The Hermit' },
  { index: 2, name: 'The Moon', canonicalName: 'The Moon' }
];

test('chapter artwork follows actual card mentions in their reading order', () => {
  const result = sections.getReadingChapterCards?.('**The Hermit** crosses the Tower. The Hermit invites reflection.', chapterCards);
  assert.deepEqual(result?.map(card => card.index), [1, 0]);
});

test('chapter artwork excludes quoted code and astrological weather', () => {
  assert.deepEqual(sections.getReadingChapterCards?.('The Moon is waxing in Aquarius. \u0060The Tower\u0060\n\n\u0060\u0060\u0060\nThe Hermit\n\u0060\u0060\u0060', chapterCards), []);
});

test('chapter artwork requires at most two unambiguous drawn cards', () => {
  assert.deepEqual(sections.getReadingChapterCards?.('The Tower, The Hermit, and The Moon form the spread.', chapterCards), []);
  assert.deepEqual(sections.getReadingChapterCards?.('The Star offers hope.', chapterCards), []);
  assert.deepEqual(sections.getReadingChapterCards?.('The Tower rises.', [...chapterCards, { index: 3, name: 'The Tower' }]), []);
});

test('chapter artwork gives the selected deck label precedence over a conflicting canonical name', () => {
  const cards = [
    { index: 0, name: 'Knight of Wands', canonicalName: 'King of Wands' },
    { index: 1, name: 'Prince of Wands', canonicalName: 'Knight of Wands' }
  ];
  assert.deepEqual(sections.getReadingChapterCards?.('Knight of Wands opens the passage.', cards)?.map(card => card.index), [0]);
});
