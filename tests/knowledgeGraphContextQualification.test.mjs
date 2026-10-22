import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as samples from '../scripts/evaluation/runNarrativeSamples.js';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts.js';

const sample = {
  id: 'synthetic-memory-path-plumbing', referenceTime: '2026-10-22T16:00:00.000Z', spreadKey: 'decision',
  userQuestion: 'Which path deserves attention?', reflectionsText: '',
  cards: ['Two of Pentacles', 'Queen of Wands', 'The Chariot', 'Two of Swords', 'Judgement'].map((name, index) => ({ name, orientation: 'Upright', ...(index === 4 ? { userReflection: 'A career job interview needs preparation.' } : {}) })),
  decisionPaths: { a: 'take the library job', b: 'continue the studio contract' },
  memories: [{ id: 'synthetic-career', scope: 'global', category: 'life_context', text: 'Rehearsing a career job interview helps me prepare.' }, { id: 'synthetic-off-topic', scope: 'global', category: 'general', text: 'I collect shells along the coast.' }]
};

test('narrative sample plumbing exercises actual current card/path/memory inputs and final retention', async () => {
  assert.equal(typeof samples.prepareNarrativeSamplePayload, 'function');
  const payload = await samples.prepareNarrativeSamplePayload(sample, { env: { GRAPHRAG_ENABLED: 'true', ENABLE_SEMANTIC_SCORING: 'false' } });
  assert.equal(payload.context, 'career');
  assert.equal(payload.cardsInfo[4].userReflection, sample.cards[4].userReflection);
  assert.equal(payload.decisionPaths.a, 'take the library job');
  assert.deepEqual(payload.memories.map(memory => memory.id), ['synthetic-career']);
  const built = buildEnhancedClaudePrompt({ ...payload, themes: payload.analysis.themes, spreadAnalysis: payload.analysis.spreadAnalysis });
  assert.match(built.userPrompt, /A career job interview needs preparation/);
  assert.match(built.userPrompt, /take the library job/);
  assert.equal(built.promptMeta.memories.selectedCount, 1);
  assert.equal(built.promptMeta.memories.retainedCount, 1);
  assert.equal(built.memoryRetention.slotToId['memory-0'], 'synthetic-career');
});

test('sample plumbing supports valid custom spreads without changing accepted input limits', async () => {
  assert.equal(typeof samples.prepareNarrativeSamplePayload, 'function');
  const payload = await samples.prepareNarrativeSamplePayload({ ...sample, spreadKey: 'general', cards: sample.cards.slice(0, 2), memories: [] }, { env: { GRAPHRAG_ENABLED: 'true' } });
  assert.equal(payload.cardsInfo.length, 2);
  assert.equal(payload.spreadInfo.key, 'general');
  assert.deepEqual(payload.decisionPaths, {});
});

test('deterministic assembly gate exercises the frozen corpus and actual provider/fallback boundaries', async () => {
  const { spawnSync } = await import('node:child_process');
  const execution = spawnSync(process.execPath, ['scripts/evaluation/verifyNarrativePromptAssembly.js', '--json'], { cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 60000 });
  assert.equal(execution.status, 0, execution.stderr || execution.stdout);
  const result = JSON.parse(execution.stdout);
  assert.equal(result.partialPairsChecked, 30);
  assert.equal(result.completeTriadsChecked, 10);
  assert.equal(result.pairedCasesChecked, 18);
  assert.ok(result.casesChecked >= 70);
  assert.equal(result.pairedFixtureHash, 'ae2ab4ee406b7b085d6e6f9887b32c7159bb9bf9522b1e33b7f040106acc1c95');
  assert.deepEqual(result.providerBudgets, { claude: 25000, openai: 20000, modal: null });
  assert.equal(result.boundaries['summary-only'].mode, 'summary');
  assert.equal(result.boundaries['removed-graph'].mode, 'none');
  assert.equal(result.boundaries['removed-graph'].retainedPatterns, 0);
  assert.equal(result.boundaries['removed-passages'].mode, 'none');
  assert.ok(result.boundaries['removed-passages'].retainedPatterns > 0);
  assert.equal(result.boundaries['partial-path'].partial, true);
  assert.equal(result.boundaries['removed-memory'].selected, 1);
  assert.equal(result.boundaries['removed-memory'].retained, 0);
  assert.equal(result.boundaries['embedding-outage'].scoringMethod, 'keyword');
  assert.equal(result.boundaries['quality-bypass'].scoringMethod, 'bypassed');
  assert.equal(result.boundaries['safe-fallback'].sourceUsage, null);
  assert.equal(result.boundaries['local-composer'].retainedMemories, 0);
  assert.ok(result.boundaries.slimming.steps > 0);
  assert.equal(result.boundaries['removed-highlights'].used, 0);
  assert.equal(result.boundaries['beyond-old-shortlist'].patternId, '13-17');
});

test('qualification rejects an incorrect authored expectation instead of accepting corpus labels', async () => {
  const { readFileSync } = await import('node:fs');
  const { runDeterministicQualification } = await import('../scripts/evaluation/verifyNarrativePromptAssembly.js');
  const corpus = JSON.parse(readFileSync(new URL('./fixtures/knowledge-graph-context-cases.json', import.meta.url), 'utf8'));
  corpus.cases[0].expected.partialNarrative = 'An unsupported invented narrative';
  await assert.rejects(runDeterministicQualification({ corpus }), /partial-death-temperance-star-13-14/);
});
