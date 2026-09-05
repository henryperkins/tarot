import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeReadingEnhanced } from '../functions/lib/narrativeBackends.js';
import { analyzeSpreadThemes, analyzeSingleCard } from '../functions/lib/spreadAnalysis.js';
import { buildOpening } from '../functions/lib/narrative/helpers.js';

const personalization = { focusAreas: ['Love & relationships'], readingTone: 'balanced' };
const cardsInfo = [{ card: 'The Hermit', name: 'The Hermit', number: 9, position: 'Theme', orientation: 'Upright', meaning: 'Reflection and careful preparation.' }];

async function compose(context, userQuestion, { spreadKey = 'single', reflectionsText = '' } = {}) {
  return composeReadingEnhanced({
    spreadInfo: { key: 'single', name: 'One-Card Insight' },
    cardsInfo,
    userQuestion,
    reflectionsText,
    context,
    personalization,
    analysis: { spreadKey, themes: await analyzeSpreadThemes(cardsInfo), spreadAnalysis: analyzeSingleCard(cardsInfo) }
  });
}

test('local fallback closing honors the current career topic instead of unrelated saved relationship focus', async () => {
  const result = await compose('career', 'How can I prepare for my job interview?');
  assert.ok(result.reading.includes('The Hermit'));
  assert.ok(!result.reading.includes('Love & relationships'));
});

test('local fallback opening bridge does not redirect a specific current context to saved focus', () => {
  const opening = buildOpening('Three-Card Story', 'How can I prepare for my job interview?', 'career', { personalization });
  assert.ok(opening.includes('job interview'));
  assert.ok(!opening.includes('Love & relationships'));
});

test('generic fallback readings can still draw on saved focus', async () => {
  const result = await compose('general', 'Any guidance?');
  assert.ok(result.reading.includes('Love & relationships'));
  const opening = buildOpening('Three-Card Story', '', null, { personalization });
  assert.ok(opening.includes('Love & relationships'));
});

test('legacy callers with a manually selected topic keep that context ahead of saved focus', async () => {
  const result = await compose('career', 'Any guidance?', { spreadKey: 'custom' });
  assert.ok(!result.reading.includes('Love & relationships'));
});

test('graph-only question evidence suppresses saved focus even when reading context is general', async () => {
  const result = await compose('general', 'How can I process grief?');
  assert.ok(result.reading.includes('The Hermit'));
  assert.ok(!result.reading.includes('Love & relationships'));
  const usage = result.promptMeta.sourceUsage.userContext;
  assert.equal(usage.focusAreasProvided, true);
  assert.equal(usage.focusAreasUsed, false);
  assert.equal(usage.skippedInputs.focusAreas, 'current_context_priority');
});

test('graph-only reflection evidence also takes priority over saved focus', async () => {
  const result = await compose('general', 'Any guidance?', { reflectionsText: 'I need space to process grief.' });
  assert.ok(!result.reading.includes('Love & relationships'));
});

test('generic spread fallback uses the same current-topic precedence as named spread builders', async () => {
  for (const [context, userQuestion] of [['career', 'How can I prepare for my interview?'], ['general', 'How can I process grief?']]) {
    const result = await compose(context, userQuestion, { spreadKey: 'custom' });
    assert.ok(result.reading.includes('The Hermit'));
    assert.ok(!result.reading.includes('Love & relationships'));
  }
  const generic = await compose('general', 'Any guidance?', { spreadKey: 'custom' });
  assert.ok(generic.reading.includes('Love & relationships'));
  assert.equal(generic.promptMeta.sourceUsage.userContext.focusAreasProvided, true);
  assert.equal(generic.promptMeta.sourceUsage.userContext.focusAreasUsed, true);
  assert.deepEqual(personalization.focusAreas, ['Love & relationships'], 'generation must not mutate saved preferences');
});
