import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeThreeCard } from '../functions/lib/spreadAnalysis.js';
import { buildEnhancedClaudePrompt, buildThreeCardReading } from '../functions/lib/narrativeBuilder.js';
import { buildDeckSpecificContext } from '../functions/lib/narrative/prompts/cardBuilders.js';

for (const positions of [['Self', 'Other', 'Bond'], ['Left', 'Center', 'Right'], ['Self', 'Other — Future Ltd.', 'Bond']]) {
  test(`three-card source preserves ${positions.join('/')} without inventing a timeline`, async () => {
    const cardsInfo = ['The Empress', 'The Emperor', 'The Hierophant'].map((card, index) => ({ card, position: positions[index], orientation: 'Upright', number: index + 3, meaning: ['Creativity.', 'Structure.', 'Tradition.'][index] }));
    const analysis = analyzeThreeCard(cardsInfo);
    assert.deepEqual(analysis.positionNotes.map(row => row.label), positions);
    const built = buildEnhancedClaudePrompt({ spreadInfo: { key: 'threeCard', name: 'Three-Card Story' }, cardsInfo, themes: {}, spreadAnalysis: analysis, userQuestion: 'How can I nurture creative art at home? I am not quitting my job.', promptBudgetEnv: { GRAPHRAG_ENABLED: 'false' } });
    assert.doesNotMatch(built.systemPrompt, /Past → Present → Future/);
    assert.doesNotMatch(built.userPrompt, /- Past:|- Present dynamics|- Future trajectory|This future position|path forward from second to third/);
    assert.doesNotMatch(built.userPrompt, /If things continue as they are, this shows how the trajectory leans/);
    for (const position of positions) assert.ok(built.userPrompt.includes(position));
    const local = await buildThreeCardReading({ cardsInfo, threeCardAnalysis: analysis, themes: {}, context: 'general', userQuestion: 'What do these roles suggest?' });
    assert.doesNotMatch(local, /Past · Present · Future|The Future position|The path ahead shows|trajectory of current momentum/);
    assert.doesNotMatch(local, /If things continue as they are, this shows how the trajectory leans/);
    for (const position of positions) assert.ok(local.includes(position));
  });
}

test('normal temporal three-card source retains its supplied timeline', () => {
  const cardsInfo = ['The Empress', 'The Emperor', 'The Hierophant'].map((card, index) => ({ card, position: ['Past', 'Present', 'Future'][index], orientation: 'Upright', number: index + 3 }));
  const built = buildEnhancedClaudePrompt({ spreadInfo: { key: 'threeCard', name: 'Three-Card Story' }, cardsInfo, themes: {}, spreadAnalysis: analyzeThreeCard(cardsInfo), userQuestion: 'What supports reflection?', promptBudgetEnv: { GRAPHRAG_ENABLED: 'false' } });
  assert.match(built.systemPrompt, /Past → Present → Future/);
  assert.match(built.userPrompt, /- Past: symbolic reflection/);
});

test('the drawn Thoth Art motif preserves its canonical spatial relation', () => {
  const note = buildDeckSpecificContext('thoth-a1', [{ card: 'Art', canonicalName: 'Temperance', position: 'Present' }]);
  assert.match(note, /raven perched on a skull on the cauldron/);
  assert.match(note, /not inside/);
  assert.equal(buildDeckSpecificContext('rws-1909', [{ card: 'Temperance' }]), '');
  assert.equal(buildDeckSpecificContext('thoth-a1', [{ card: 'The Star' }]), '');
  assert.equal(buildDeckSpecificContext('thoth-a1', [{ card: 'Art' }], { includeDeckContext: false }), '');
});
