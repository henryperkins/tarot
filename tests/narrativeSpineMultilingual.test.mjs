import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { validateReadingNarrative } from '../functions/lib/narrativeSpine.js';
import { buildNarrativeMetrics } from '../functions/lib/readingQuality.js';

const cards = ['The Magician', 'The Chariot', 'The World'].map((card, index) => ({
  card, position: ['Past', 'Present', 'Future'][index], orientation: index === 1 ? 'Reversed' : 'Upright'
}));
const headings = ['過去：The Magician（正位置）', '現在：The Chariot（逆位置）', '未来：The World（正位置）'];
const paragraphs = [
  'この絵は、手元の道具を一つの目的に集中させる可能性を表します。',
  '二つの力が違う方向を向いているなら、まず目的を一文にしてみてください。',
  '輪の内側に何を置くかを決めることが、完成の目安につながります。'
];
const readingFor = (bodies) => headings.map((heading, index) => `### ${heading}\n\n${bodies[index]}`).join('\n\n');

test('card-naming headings credit substantial Japanese bodies without ASCII word separators', () => {
  const result = buildNarrativeMetrics(readingFor(paragraphs), cards);
  assert.equal(result.spine.cardSections, 3);
  assert.equal(result.spine.cardComplete, 3);
  assert.equal(result.spine.isValid, true);
  assert.equal(result.cardCoverage, 1);
});

test('card-naming headings also credit substantial Chinese bodies without word separators', () => {
  const result = validateReadingNarrative('### The Magician\n\n这张牌提醒你先选定一个方向，再把已经掌握的技巧用在同一个作品上。');
  assert.equal(result.cardSections, 1);
  assert.equal(result.cardComplete, 1);
});

test('Japanese structural headings do not become extra card sections when they mention cards', () => {
  const opening = '### はじめに\n\nThe Magician、The Chariot、The World の三枚を、問いに重ねて読んでいきます。';
  const ending = '### まとめ\n\nThe World の輪を、作品の範囲を考える手がかりにできます。';
  const result = buildNarrativeMetrics(`${opening}\n\n${readingFor(paragraphs)}\n\n${ending}`, cards);
  assert.equal(result.spine.cardSections, 3);
  assert.equal(result.spine.structuralSections, 2);
});

for (const body of ['', '少し待って。', '…！！', '🌟 🌙 ⭐ ✨ 💫']) {
  test(`a named Japanese card heading does not supply a missing substantive body: ${JSON.stringify(body)}`, () => {
    const result = validateReadingNarrative(`### 過去：The Magician\n\n${body}`);
    assert.equal(result.cardSections, 1);
    assert.equal(result.cardComplete, 0);
    assert.equal(result.isValid, false);
  });
}

test('a long Japanese paragraph without a card or recognized position is not credited as a card section', () => {
  const result = validateReadingNarrative('### 考えてみること\n\n' + paragraphs[0]);
  assert.equal(result.cardSections, 0);
});

test('an incomplete named card remains below the unchanged 75 percent completion rule', () => {
  const result = buildNarrativeMetrics(readingFor([paragraphs[0], '', paragraphs[2]]), cards);
  assert.equal(result.spine.cardSections, 3);
  assert.equal(result.spine.cardComplete, 2);
  assert.equal(result.spine.cardComplete / result.spine.cardSections < 0.75, true);
  assert.equal(result.spine.isValid, false);
});

// The original frozen output is a regression input, never a replacement reading.
test('the saved FRESH03 reading has exactly three complete card sections', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/narrative-spine-fresh03.json', import.meta.url), 'utf8'));
  const metrics = buildNarrativeMetrics(fixture.reading, fixture.cards, fixture.deck);
  assert.equal(metrics.spine.cardSections, 3);
  assert.equal(metrics.spine.cardComplete, 3);
  assert.equal(metrics.spine.cardIncomplete, 0);
  assert.equal(metrics.cardCoverage, 1);
});
