import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js';
import { formatUsageSummary } from '../src/components/reading/complete/sourceUsageSummary.js';

test('absent, empty and invalid metadata never invent sources', () => {
  for (const value of [null, {}, [], { vision: { used: 'true' } }]) {
    assert.deepEqual(formatUsageSummary(value).rows, []);
    assert.equal(formatUsageSummary(value).summary.attention, 0);
  }
});

test('caller interpretation is a separate personal input in bounded summaries', () => {
  const result = formatUsageSummary({ userContext: { requested: true, used: true, providedInputs: ['callerInterpretations'], usedInputs: ['callerInterpretations'], callerInterpretationsProvided: true, callerInterpretationsUsed: true, fields: { 'interpretation-0': { originalLength: 19, includedLength: 19 } } } });
  assert.equal(result.rows.length, 1);
  assert.match(result.rows[0].detail, /your card interpretations/i);
  assert.equal(result.rows[0].state, 'used');
});

test('real builder output includes Standard depth and card notes without warning about optional sources', () => {
  const built = buildEnhancedClaudePrompt({
    spreadInfo: { name: 'One-Card Insight', key: 'single' },
    cardsInfo: [{ card: 'The Sun', number: 19, orientation: 'Upright', position: 'Theme', userReflection: 'The flowers stand out.' }],
    userQuestion: 'What supports me today?', personalization: { preferredSpreadDepth: 'standard', readingTone: 'gentle' },
    promptBudgetEnv: { GRAPHRAG_ENABLED: 'true' },
    graphRAGPayload: { retrievalSummary: { skippedReason: 'no_patterns_detected' } },
    ephemerisContext: { available: false }
  });
  const usage = formatUsageSummary(built.promptMeta.sourceUsage);
  assert.equal(usage.summary.attention, 0);
  assert.deepEqual(usage.rows.map(row => row.label), ['Your cards', 'Your question & notes', 'Your preferences', 'Detected patterns']);
  const copy = JSON.stringify(usage);
  assert.match(copy, /card notes/);
  assert.match(copy, /reading depth/);
  assert.doesNotMatch(copy, /cardReflections|default profile|not requested|no patterns detected|Ephemeris|Skipped/);
});

test('budget losses warn even when other personal inputs were included', () => {
  const result = formatUsageSummary({ userContext: {
    used: true, requested: true, usedInputs: ['question', 'cardReflections'],
    skippedInputs: { tone: 'removed_for_budget' },
    fields: { question: { originalLength: 100, includedLength: 50, budgetTruncated: true } }
  } });
  assert.equal(result.summary.attention, 2);
  assert.equal(result.rows[0].state, 'partial');
  assert.match(result.rows[0].detail, /Shortened: question/);
  assert.match(result.rows[1].detail, /length limit/);
});

test('sanitization warns about lost content, not same-length normalization', () => {
  for (const [note, state, attention] of [
    ['The flowers stand out. Decode this. I miss my family.', 'partial', 1],
    ['Decode this. I miss my family.', 'omitted', 1],
    ['  The flowers stand out.  ', 'used', 0],
    ['The **flowers** stand out.', 'used', 0],
    ['A_B', 'used', 0]
  ]) {
    const built = buildEnhancedClaudePrompt({
      spreadInfo: { key: 'single', name: 'One-Card Insight' },
      cardsInfo: [{ card: 'The Sun', number: 19, orientation: 'Upright', position: 'Theme', userReflection: note }]
    });
    const summary = formatUsageSummary(built.promptMeta.sourceUsage);
    const notes = summary.rows.find(row => row.label === 'Your question & notes');
    assert.equal(notes.state, state);
    assert.equal(summary.summary.attention, attention);
    if (state === 'partial') assert.match(notes.detail, /Shortened: card notes/);
  }
});

test('duplicate notes, saved-focus priority and legacy Standard depth are normal behavior', () => {
  const result = formatUsageSummary({ userContext: {
    used: true, usedInputs: ['cardReflections'],
    skippedInputs: { reflections: 'deduped_against_card_reflection', focusAreas: 'current_context_priority', depth: 'default_profile' },
    fields: { reflections: { originalLength: 100, includedLength: 0, representedLength: 100, representedByDuplicate: true, omitted: true } }
  } });
  assert.equal(result.summary.attention, 0);
  assert.match(JSON.stringify(result), /reading depth/);
  assert.doesNotMatch(JSON.stringify(result), /default_profile|deduped|Skipped/);
});

test('unknown reason codes and input keys never become user-facing copy', () => {
  const result = formatUsageSummary({ userContext: { used: false, requested: true,
    skippedInputs: { question: 'future_private_reason', unknownInternalKey: 'raw_telemetry' }
  } });
  assert.equal(result.summary.attention, 1);
  assert.match(result.rows[0].detail, /not included/);
  assert.doesNotMatch(JSON.stringify(result), /future|private|unknownInternalKey|raw_telemetry/);
});

test('diagnostic-only and partly usable uploads are explained without telemetry terms', () => {
  const diagnostic = formatUsageSummary({ vision: { requested: true, used: true, diagnosticsIncluded: true, cardCuesUsed: false, evidencePacketsUsed: 0, telemetryOnlyUploads: 1 } });
  assert.equal(diagnostic.rows[0].state, 'omitted');
  assert.equal(diagnostic.summary.attention, 1);
  const partial = formatUsageSummary({ vision: { requested: true, used: true, evidencePacketsUsed: 1, telemetryOnlyUploads: 2 } });
  assert.equal(partial.rows[0].state, 'partial');
  assert.match(partial.rows[0].detail, /2 images could not be included/);
  assert.doesNotMatch(JSON.stringify(partial), /telemetry|packets/);
});

test('local pattern summaries never imply that zero passages were used', () => {
  const result = formatUsageSummary({ graphRAG: { requested: true, used: true, mode: 'summary', passagesProvided: 1, passagesUsedInPrompt: 0 } });
  assert.match(result.rows[0].detail, /patterns/);
  assert.doesNotMatch(result.rows[0].detail, /0\/1|mode/);
});

test('cards-only provenance has a visible detail row as well as a summary', () => {
  const result = formatUsageSummary({ spreadCards: { used: true } });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].label, 'Your cards');
  assert.equal(result.rows[0].state, 'used');
  assert.equal(result.rows[0].group, 'you');
  assert.match(result.summaryText, /your cards/);
  assert.equal(result.summary.used, 1);
});

test('used pattern sources with absent or zero counts use uncounted descriptions', () => {
  for (const count of [undefined, 0]) {
    const result = formatUsageSummary({
      graphRAG: { used: true, passagesUsedInPrompt: count },
      patterns: { used: true, patternsUsedInPrompt: count }
    });
    assert.equal(result.rows.length, 2);
    for (const row of result.rows) {
      assert.equal(row.state, 'used');
      assert.match(row.detail, /patterns/i);
      assert.doesNotMatch(row.detail, /\b0\b/);
    }
  }
});

test('saved memory attribution distinguishes selection from final inclusion without exposing text or identities', () => {
  const selected = { requested: true, used: false, candidatesProvided: 100, memoriesSelected: 3, memoriesUsedInPrompt: 0, skippedReason: 'removed_for_budget', text: 'Private name', selectedIds: ['private-id'] };
  const omitted = formatUsageSummary({ memories: selected });
  assert.equal(omitted.rows[0].label, 'Saved memories');
  assert.equal(omitted.rows[0].state, 'omitted');
  assert.doesNotMatch(JSON.stringify(omitted), /Private name|private-id/);
  const included = formatUsageSummary({ memories: { ...selected, used: true, memoriesUsedInPrompt: 1, skippedReason: null } });
  assert.match(included.rows[0].detail, /1 saved memory included as reading context/);
  assert.doesNotMatch(included.rows[0].detail, /influenced|followed|proved/);
});
