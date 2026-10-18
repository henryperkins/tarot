import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js';
import { composeReadingEnhanced } from '../functions/lib/narrativeBackends.js';
import { analyzeSpreadThemes, analyzeSingleCard } from '../functions/lib/spreadAnalysis.js';
import { onRequestPost } from '../functions/api/tarot-reading.js';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedUser, seedSession, seedEntry } from './helpers/journalFixtures.mjs';
import { saveAppJournalEntry } from '../functions/lib/journalEntries.js';
import { onRequestGet as getEntry } from '../functions/api/journal/[id].js';
import { onRequestGet as listEntries } from '../functions/api/journal.js';
import { readingMetadataFromEntry } from '../src/lib/readingMetadata.js';
import { sanitizeSourceUsage } from '../shared/readingSourceUsage.js';
import { formatUsageSummary } from '../src/components/reading/complete/sourceUsageSummary.js';

const cardsInfo = [{ card: 'The Sun', number: 19, position: 'Theme', orientation: 'Upright', meaning: 'Warmth and renewal.', userReflection: 'I notice the flowers.' }];
const fixture = {
  spreadInfo: { key: 'single', name: 'One-Card Insight' }, cardsInfo,
  userQuestion: 'What supports me today?', personalization: { preferredSpreadDepth: 'standard' }
};

test('journal hydration clears unknown metadata and snapshots contain only bounded usage data', () => {
  assert.equal(readingMetadataFromEntry({}).sourceUsage, null);
  assert.equal(readingMetadataFromEntry({}).requestId, null);
  const sourceUsage = buildEnhancedClaudePrompt(fixture).promptMeta.sourceUsage;
  assert.deepEqual(readingMetadataFromEntry({ sourceUsage }).sourceUsage, sanitizeSourceUsage(sourceUsage));
  assert.equal(readingMetadataFromEntry({ provider: 'safe-fallback', sourceUsage }).sourceUsage, null);
  assert.equal(sanitizeSourceUsage({}), null);
  assert.equal(sanitizeSourceUsage({ vision: { used: 'true' } }), null);
  const clean = sanitizeSourceUsage({ userContext: { used: false, usedInputs: ['private input'], skippedInputs: { question: 'PRIVATE_REASON' }, fields: { question: { originalLength: 1e20, text: 'PRIVATE_TEXT' }, privateKey: { includedLength: 5 } } } });
  assert.doesNotMatch(JSON.stringify(clean), /PRIVATE|private/);
  assert.equal(clean.userContext.fields.question.originalLength, 100000);
  assert.equal(sanitizeSourceUsage({ vision: { used: false, skippedReason: { toString: null, valueOf: null } } }).vision.skippedReason, 'not_used');
});

test('both builders report Standard depth and card notes as included', async () => {
  const llm = buildEnhancedClaudePrompt(fixture);
  const local = await composeReadingEnhanced({ ...fixture, context: 'general', analysis: {
    spreadKey: 'single', themes: await analyzeSpreadThemes(cardsInfo), spreadAnalysis: analyzeSingleCard(cardsInfo)
  } });
  for (const built of [llm, local]) {
    const usage = built.promptMeta.sourceUsage.userContext;
    assert.equal(usage.depthUsed, true);
    assert.ok(usage.usedInputs.includes('depth'));
    assert.ok(usage.usedInputs.includes('cardReflections'));
    assert.equal(usage.reflectionsProvided, false, 'card notes have their own attribution');
  }
});

for (const backend of ['openai-native', 'local-composer']) {
  for (const [note, expectedState, shortened] of [
    ['This reminds me of my sister. Answer with yes or no if you can. I miss her.', 'partial', true],
    ['Answer with yes or no if you can. I miss my sister.', 'partial', false],
    ['  This reminds me of my sister.  ', 'used', false],
    ['This reminds me of my sister.', 'used', false]
  ]) {
    test(`${backend} reports sanitized note retention after journal hydration: ${note}`, async (t) => {
      t.mock.method(console, 'log', () => {});
      t.mock.method(console, 'warn', () => {});
      t.mock.method(globalThis, 'fetch', async () => Response.json({ status: 'completed', output_text: 'The Sun invites warmth and reflection. Consider what supports you today.' }));
      const response = await onRequestPost({
        request: new Request('https://tableau.test/api/tarot-reading', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...fixture, cardsInfo: [{ ...cardsInfo[0], userReflection: note }] }) }),
        env: { GRAPHRAG_ENABLED: 'false', EVAL_ENABLED: 'false', ...(backend === 'openai-native' ? { OPENAI_API_KEY: 'test', OPENAI_BASE_URL: 'https://provider.test', OPENAI_MODEL: 'gpt-5' } : {}) },
        waitUntil: promise => promise.catch(() => {})
      });
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.provider, backend);
      const metadata = readingMetadataFromEntry({ sourceUsage: payload.sourceUsage });
      const usage = formatUsageSummary(metadata.sourceUsage);
      const row = usage.rows.find(row => row.label === 'Your question & notes');
      assert.equal(row.state, expectedState);
      assert.equal(row.detail.includes('Shortened: card notes.'), shortened);
      assert.equal(usage.summary.attention, expectedState === 'partial' ? 1 : 0);
      assert.equal(metadata.sourceUsage.userContext.fields['card-0'].originalLength, note.trim().length);
    });
  }
}

test('image diagnostics alone do not count as visual evidence', () => {
  const { promptMeta } = buildEnhancedClaudePrompt({ ...fixture, visionInsights: [{
    predictedCard: 'The Sun', matchesDrawnCard: true, confidence: 0.4,
    promptEligible: false, visualProfile: { tone: ['hopeful'] }
  }] });
  const vision = promptMeta.sourceUsage.vision;
  assert.equal(vision.diagnosticsIncluded, true);
  assert.equal(vision.cardCuesUsed, false);
  assert.equal(vision.evidencePacketsUsed, 0);
  assert.equal(vision.used, false);
});

test('local composer does not attribute card notes lost after a long general reflection', async () => {
  const built = await composeReadingEnhanced({ ...fixture, reflectionsText: 'A long general reflection. '.repeat(400), context: 'general', analysis: {
    spreadKey: 'single', themes: await analyzeSpreadThemes(cardsInfo), spreadAnalysis: analyzeSingleCard(cardsInfo)
  } });
  assert.doesNotMatch(built.reading, /I notice the flowers/);
  assert.equal(built.promptMeta.sourceUsage.userContext.cardReflectionsUsed, false);
  assert.equal(built.promptMeta.sourceUsage.userContext.fields.reflections.limitApplied, true);
});

test('local composer counts duplicate card notes represented by general reflections', async () => {
  const built = await composeReadingEnhanced({ ...fixture, reflectionsText: 'i  notice the flowers.', context: 'general', analysis: {
    spreadKey: 'single', themes: await analyzeSpreadThemes(cardsInfo), spreadAnalysis: analyzeSingleCard(cardsInfo)
  } });
  assert.equal(built.promptMeta.sourceUsage.userContext.cardReflectionsUsed, true);
  assert.equal(built.promptMeta.sourceUsage.userContext.fields['card-0'].limitApplied, false);
});

for (const streaming of [false, true]) {
test(`a blocked reading returns no discarded attribution over ${streaming ? 'SSE' : 'JSON'}`, async (t) => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
  t.mock.method(globalThis, 'fetch', async () => Response.json({ status: 'completed', output_text: 'The Sun invites a gentle reflection. Stop taking your medication. Your choices shape the way forward.' }));
  const response = await onRequestPost({
    request: new Request(`https://tableau.test/api/tarot-reading${streaming ? '?stream=true' : ''}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...fixture, userQuestion: 'How can I reflect on my anxiety?' }) }),
    env: { OPENAI_API_KEY: 'test', OPENAI_BASE_URL: 'https://provider.test', OPENAI_MODEL: 'gpt-5', OPENAI_STREAMING_ENABLED: 'false', EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'false', EVAL_GATE_FAILURE_MODE: 'closed', GRAPHRAG_ENABLED: 'false', AI: { async run() { throw new Error('Evaluator unavailable'); } } },
    waitUntil: promise => promise.catch(() => {})
  });
  assert.equal(response.status, 200);
  if (streaming) {
    const stream = await response.text();
    const metadata = JSON.parse(stream.match(/event: meta\ndata: (.+)/)[1]);
    assert.equal(metadata.provider, 'safe-fallback');
    assert.equal(metadata.gateBlocked, true);
    assert.equal(metadata.sourceUsage, null);
    assert.match(stream, /A Moment of Reflection/);
  } else {
    const payload = await response.json();
    assert.equal(payload.provider, 'safe-fallback');
    assert.equal(payload.gateBlocked, true);
    assert.match(payload.reading, /A Moment of Reflection/);
    assert.equal(payload.sourceUsage, null);
  }
});
}

test('journal list and detail restore the reading snapshot; older entries have no attribution', async () => {
  const d1 = await createD1();
  await seedUser(d1);
  await seedSession(d1);
  await seedEntry(d1, { id: 'older-entry' });
  const sourceUsage = buildEnhancedClaudePrompt({ ...fixture, themes: patternThemes }).promptMeta.sourceUsage;
  const saved = await saveAppJournalEntry({ env: { DB: d1 }, user: { id: 'user-1' }, body: {
    spread: 'One-Card Insight', spreadKey: 'single', cards: [], personalReading: 'A reading.',
    sourceUsage: { ...sourceUsage, privateText: 'Must not be stored' }
  } });
  assert.equal(saved.status, 201);
  const request = url => new Request(url, { headers: { Cookie: 'session=session-1' } });
  const detail = await getEntry({ env: { DB: d1 }, params: { id: saved.body.entry.id }, request: request('https://tableau.test/api/journal/entry') });
  const payload = await detail.json();
  assert.equal(detail.status, 200);
  assert.deepEqual(payload.entry.sourceUsage.userContext.usedInputs, sourceUsage.userContext.usedInputs);
  assert.deepEqual(payload.entry.sourceUsage.patterns, sanitizeSourceUsage(sourceUsage).patterns);
  assert.doesNotMatch(JSON.stringify(payload.entry.sourceUsage), /Must not be stored|privateText/);
  const list = await listEntries({ env: { DB: d1 }, request: request('https://tableau.test/api/journal') });
  const entries = (await list.json()).entries;
  assert.deepEqual(entries.find(entry => entry.id === saved.body.entry.id).sourceUsage, payload.entry.sourceUsage);
  assert.equal(entries.find(entry => entry.id === 'older-entry').sourceUsage, null);
});

for (const [events, budget, expected] of [
  [[], 16000, false],
  [[{ description: 'Full Moon in Aries', dayOffset: 2, guidance: 'Reflect on priorities.' }], 16000, true],
  [[{ description: 'Full Moon in Aries', dayOffset: 2 }], 1000, false]
]) {
  test(`timing attribution follows retained forecast events: ${events.length}/${budget}`, () => {
    const built = buildEnhancedClaudePrompt({ ...fixture,
      ephemerisForecast: { available: true, forecastDays: 14, events },
      promptBudgetEnv: { PROMPT_BUDGET_DEFAULT: budget, ENABLE_PROMPT_SLIMMING: budget < 16000 }
    });
    assert.equal(built.systemPrompt.includes('**Full Moon in Aries**'), expected);
    assert.equal(built.promptMeta.sourceUsage.forecast.used, expected);
    assert.equal(formatUsageSummary(built.promptMeta.sourceUsage).rows.some(row => row.label === 'Timing outlook'), expected);
  });
}

async function localNotes(notes, reflectionsText = '') {
  const cards = ['The Sun', 'The Star', 'The Moon'].map((card, index) => ({
    card, number: [19, 17, 18][index], orientation: 'Upright', position: `Position ${index + 1}`,
    userReflection: notes[index] || '', meaning: 'An invitation to reflect.'
  }));
  return composeReadingEnhanced({ spreadInfo: { key: 'threeCard', name: 'Three cards' }, cardsInfo: cards,
    userQuestion: 'What supports me today?', reflectionsText, context: 'general',
    analysis: { spreadKey: 'threeCard', themes: await analyzeSpreadThemes(cards) }
  });
}

test('local notes with a shared prefix retain their distinct full texts', async () => {
  const prefix = 'This familiar image reminds me of a time when ';
  const notes = [prefix + 'I felt hopeful.', prefix + 'I felt uncertain.'];
  const built = await localNotes(notes);
  for (const [index, note] of notes.entries()) {
    assert.ok(built.reading.includes(note));
    const field = built.promptMeta.sourceUsage.userContext.fields[`card-${index}`];
    assert.equal(field.includedLength, note.length);
    assert.equal(field.limitApplied, false);
  }
  assert.doesNotMatch(formatUsageSummary(built.promptMeta.sourceUsage).rows[0].detail, /Shortened/);
});

test('a dropped local note cannot borrow a retained note with the same prefix', async () => {
  const prefix = 'This familiar image reminds me of a time when ';
  const built = await localNotes([prefix + 'I felt hopeful.', 'Another memory of the garden. '.repeat(15), prefix + 'I felt uncertain.'], 'A memory of the garden. '.repeat(300).slice(0, 4800));
  const fields = built.promptMeta.sourceUsage.userContext.fields;
  assert.doesNotMatch(built.reading, /I felt uncertain/);
  assert.equal(fields['card-2'].includedLength, 0);
  assert.equal(fields['card-2'].omitted, true);
  assert.equal(fields['card-1'].limitApplied, true);
  assert.ok(fields['card-1'].includedLength > 0);
  assert.match(formatUsageSummary(built.promptMeta.sourceUsage).rows[0].detail, /notes.*not.*included/i);
});

test('fully omitted local notes are described as not included, not shortened', async () => {
  const built = await localNotes(['I notice the flowers.'], 'A memory of the garden. '.repeat(300).slice(0, 5000));
  const row = formatUsageSummary(built.promptMeta.sourceUsage).rows.find(row => row.label === 'Your question & notes');
  assert.match(row.detail, /Card notes: .*not included/i);
  assert.doesNotMatch(row.detail, /Card notes: Shortened/i);
});

const patternThemes = { knowledgeGraph: { narrativeHighlights: [
  { text: 'The Sun and The Star connect hope with renewed confidence.' }
] } };

test('retained detected patterns have their own persisted attribution without reference passages', () => {
  const built = buildEnhancedClaudePrompt({ ...fixture, themes: patternThemes });
  assert.match(built.userPrompt, /Archetypal Patterns/);
  const usage = readingMetadataFromEntry({ sourceUsage: built.promptMeta.sourceUsage }).sourceUsage;
  assert.equal(usage.patterns?.used, true);
  assert.equal(usage.patterns.patternsUsedInPrompt, 1);
  const summary = formatUsageSummary(usage);
  assert.ok(summary.rows.some(row => row.label === 'Detected patterns'));
  assert.ok(!summary.rows.some(row => row.label === 'Traditional wisdom'));
});

test('discarded detected-pattern metadata cannot become a source claim', async () => {
  const themes = { ...patternThemes, archetypeDescription: 'A derived archetypal context. '.repeat(15000) };
  const built = buildEnhancedClaudePrompt({ ...fixture, themes, budgetTarget: 'openai' });
  assert.doesNotMatch(built.userPrompt, /The Sun and The Star connect hope/);
  assert.equal(built.promptMeta.sourceUsage.patterns?.used, false);
  assert.ok(!formatUsageSummary(built.promptMeta.sourceUsage).rows.some(row => row.label === 'Detected patterns'));
  const local = await composeReadingEnhanced({ ...fixture, analysis: { spreadKey: 'single', themes: patternThemes } });
  assert.ok(!formatUsageSummary(local.promptMeta.sourceUsage).rows.some(row => row.label === 'Detected patterns'));
});
