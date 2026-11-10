import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveContextSelection } from '../functions/lib/contextDetection.js';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts.js';

for (const cardIndex of [0, 9, 77]) {
  test(`full general notes do not suppress a later career card reflection ${cardIndex}`, () => {
    const cardsInfo = Array.from({ length: cardIndex + 1 }, (_, i) => ({
      card: 'The Star', number: 17, position: `Position ${i + 1}`, orientation: 'Upright', meaning: 'Hope.',
      userReflection: i === cardIndex ? 'My next career step involves a job interview and new work.' : ''
    }));
    const reflectionsText = 'A quiet moment. '.repeat(313).slice(0, 4991);
    const input = { userQuestion: 'Any guidance?', reflectionsText, cardsInfo, focusAreas: ['Love & relationships'] };
    const selection = resolveContextSelection(input, 'general');
    assert.equal(selection.context, 'career');
    assert.equal(selection.graphRAGContext, 'career');
    assert.equal(selection.source, 'reflections');
    assert.ok(selection.selectedSourceIds.includes(`card-${cardIndex}`));
    assert.match(selection.retrievalQuery, /job interview/);
    const built = buildEnhancedClaudePrompt({ ...input, spreadInfo: { key: 'general', name: 'Custom Spread' }, themes: {}, context: selection.context });
    assert.ok(built.userPrompt.includes(cardsInfo[cardIndex].userReflection));
  });
}

test('repeated note copies cannot outvote distinct current topic evidence', () => {
  const selection = resolveContextSelection({
    userQuestion: 'Any guidance?', reflectionsText: 'My job and career need attention.',
    cardsInfo: Array.from({ length: 78 }, () => ({ userReflection: 'love' })), focusAreas: ['Love']
  }, 'general');
  assert.equal(selection.context, 'career');
});

test('a clue at the end of a maximum card reflection participates before query projection', () => {
  const selection = resolveContextSelection({ userQuestion: 'Any guidance?', cardsInfo: [{ userReflection: 'q'.repeat(1968) + ' My job interview concerns work.' }] }, 'single');
  assert.equal(selection.context, 'career');
  assert.match(selection.retrievalQuery, /job interview/);
});

for (const noteLength of [4991, 5000]) {
  test(`authoritative selection preserves ${noteLength} general characters and the final decisive card`, () => {
    const ending = 'My career and job interview are tomorrow.';
    const note = 'q'.repeat(2000 - ending.length) + ending;
    const cardsInfo = Array.from({ length: 78 }, (_, i) => ({ card: 'The Star', number: 17, position: `Position ${i + 1}`, orientation: 'Upright', meaning: 'Hope.', userReflection: i === 77 ? note : '' }));
    const reflectionsText = 'n'.repeat(noteLength);
    const selection = resolveContextSelection({ userQuestion: 'Any guidance?', reflectionsText, cardsInfo }, 'general');
    assert.equal(selection.version, 1);
    assert.equal(selection.context, 'career');
    assert.equal(selection.source, 'reflections');
    assert.ok(selection.selectedSourceIds.includes('card-77'));
    assert.match(selection.retrievalQuery, /job interview/);
    assert.equal(selection.queryCoverage.find(field => field.id === 'reflections').classifiedLength, noteLength);
    const { userPrompt, promptMeta } = buildEnhancedClaudePrompt({ spreadInfo: { key: 'general', name: 'Custom Spread' }, cardsInfo, userQuestion: 'Any guidance?', reflectionsText, context: 'love', contextSelection: selection, themes: {} });
    assert.ok(userPrompt.includes(note));
    assert.equal(promptMeta.context.normalized, selection.context);
    assert.deepEqual(promptMeta.contextSelection, { version: 1, context: selection.context, graphRAGContext: selection.graphRAGContext, source: selection.source, clarifiedBy: selection.clarifiedBy, selectedSourceIds: selection.selectedSourceIds });
    assert.deepEqual(promptMeta.queryCoverage, selection.queryCoverage);
  });
}

test('the twelfth sanitized focus entry participates before the separate rendering cap', () => {
  const selection = resolveContextSelection({ userQuestion: 'Any guidance?', focusAreas: [...Array(11).fill('Evenings'), 'career'] }, 'single');
  assert.equal(selection.context, 'career');
  assert.equal(selection.source, 'focusAreas');
  assert.ok(selection.selectedSourceIds.includes('focus-11'));
});
