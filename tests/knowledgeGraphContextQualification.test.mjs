import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as samples from '../scripts/evaluation/runNarrativeSamples.js';
import { readFileSync } from 'node:fs';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts.js';

const sample = {
  id: 'synthetic-memory-path-plumbing', referenceTime: '2026-10-22T16:00:00.000Z', spreadKey: 'decision',
  userQuestion: 'Which path deserves attention?', reflectionsText: '',
  cards: ['Two of Pentacles', 'Queen of Wands', 'The Chariot', 'Two of Swords', 'Judgement'].map((name, index) => ({ name, orientation: 'Upright', ...(index === 4 ? { userReflection: 'A career job interview needs preparation.' } : {}) })),
  decisionPaths: { a: 'take the library job', b: 'continue the studio contract' },
  memories: [{ id: 'synthetic-career', scope: 'global', category: 'life_context', text: 'Career guidance' }, { id: 'synthetic-off-topic', scope: 'global', category: 'general', text: 'I collect shells along the coast.' }]
};

test('remediation v1 qualification checks every final mode and all eight registry-backed families', async () => {
  const gate = await import('../scripts/evaluation/verifyNarrativePromptAssembly.js');
  assert.equal(typeof gate.verifyGraphRAGRemediationFixtures, 'function');
  const fixtures = JSON.parse(readFileSync(new URL('./fixtures/graph-rag-remediation-v1-cases.json', import.meta.url), 'utf8'));
  const report = await gate.verifyGraphRAGRemediationFixtures({ fixtures });
  assert.equal(report.readingPromptVersion, '1.6.0');
  assert.equal(report.casesChecked, 23);
  assert.equal(report.providerBuildsChecked, 69);
  assert.deepEqual(report.executedCaseIds, fixtures.cases.map(row => row.id));
  assert.deepEqual(report.familiesChecked, fixtures.requiredFamilies);
  assert.deepEqual(report.observations['remediation-budget-summary'].modes, { claude: 'summary', openai: 'summary', modal: 'full' });
  assert.deepEqual(report.observations['remediation-budget-omitted'].modes, { claude: 'none', openai: 'none', modal: 'full' });
  assert.equal(report.observations['remediation-integrity-removed'].integrityRemovedBlocks.claude, 2);
  assert.equal(report.liveProviderCalls, 0);
});

test('remediation qualification rejects contradictory expected mode, guardrails and family evidence', async () => {
  const gate = await import('../scripts/evaluation/verifyNarrativePromptAssembly.js');
  assert.equal(typeof gate.verifyGraphRAGRemediationFixtures, 'function');
  const fixtures = JSON.parse(readFileSync(new URL('./fixtures/graph-rag-remediation-v1-cases.json', import.meta.url), 'utf8'));
  for (const [id, expected] of [
    ['remediation-full-multi-major', { mode: 'none' }],
    ['remediation-integrity-removed', { integrityRemovedBlocks: 0 }],
    ['remediation-summary-court-lineage', { families: ['marseille-numerology'] }],
    // Paired finding cases: a new Major must not outrank an existing pattern on
    // equal evidence, short-word matches must clear the threshold, and an
    // unmatched context variant must not win.
    ['remediation-f1-equal-evidence-pattern-first', { selected: [{ type: 'major-arcana', patternId: '9' }, { type: 'triad', patternId: 'strength-hermit-wheel' }] }],
    ['remediation-f3a-short-words-match', { weakFloor: true }],
    ['remediation-f2-canon-wins-unmatched-context', { selected: [{ type: 'major-arcana', patternId: '17', isEnriched: true }] }]
  ]) {
    const corrupted = structuredClone(fixtures);
    const row = corrupted.cases.find(item => item.id === id);
    Object.assign(row.expected, expected);
    await assert.rejects(gate.verifyGraphRAGRemediationFixtures({ fixtures: corrupted }), error => error.message.includes(id));
  }
});

test('v3 manifest preserves previous bytes and executes bounded probes plus current-input regressions', async () => {
  const { loadQualificationManifest, runDeterministicQualification } = await import('../scripts/evaluation/verifyNarrativePromptAssembly.js');
  const v3 = JSON.parse(readFileSync(new URL('./fixtures/knowledge-graph-context-v3-cases.json', import.meta.url), 'utf8'));
  const manifest = loadQualificationManifest();
  assert.equal(manifest.v3?.schemaVersion, 3);
  assert.equal(manifest.v3.v2RawHash, manifest.v2.rawHash);
  assert.equal(manifest.v3.candidateSourceIdentity, null);
  const ids = [...v3.cases, ...v3.groundingProbes].map(row => row.id);
  const result = await runDeterministicQualification({ developmentFixtureIds: ids });
  assert.deepEqual(result.executedCaseIds, ids);
  assert.equal(result.groundingProbesChecked, v3.groundingProbes.length);
  assert.equal(result.admissionCasesChecked, 1);
  assert.equal(result.providerBuildsChecked, v3.cases.filter(row => row.executor === 'prompt').length * 3);
  assert.ok(Object.values(result.v3Observations).every(row => row.requiresHumanReview));
});

test('v3 reference adversaries cannot replace authored registry prose or forge retained provenance', async () => {
  const qualification = await import('../scripts/evaluation/verifyNarrativePromptAssembly.js');
  assert.equal(typeof qualification.verifyReferenceAdversaries, 'function');
  const result = qualification.verifyReferenceAdversaries();
  assert.deepEqual(result.observations.map(row => row.retained), [1, 0, 0, 0]);
  assert.equal(result.providerBuildsChecked, 4);
  assert.equal(result.requiresHumanReview, true);
});

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
  const execution = spawnSync(process.execPath, ['scripts/evaluation/verifyNarrativePromptAssembly.js', '--json'], { cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 180000 });
  assert.equal(execution.status, 0, execution.stderr || execution.stdout);
  const result = JSON.parse(execution.stdout);
  assert.equal(result.partialPairsChecked, 30);
  assert.equal(result.completeTriadsChecked, 10);
  assert.equal(result.pairedCasesChecked, 18);
  const { loadQualificationManifest } = await import('../scripts/evaluation/verifyNarrativePromptAssembly.js');
  const manifest = loadQualificationManifest();
  assert.equal(result.casesChecked, manifest.caseOrder.length);
  assert.equal(result.frozenCasesChecked, 73);
  assert.equal(result.matrixPartialCasesChecked, 720);
  assert.equal(result.matrixCompleteCasesChecked, 30);
  assert.equal(result.deckProjectionsChecked, (result.canonPassagesChecked + result.partialProjectionRowsChecked) * 3);
  assert.equal(result.partialProjectionRowsChecked, 30);
  assert.equal(result.passageCapsChecked, 21);
  const migrated = id => manifest.v3.expectationMigrations[id]?.newExecutor === 'admission-error';
  const frozenBuildCases = manifest.frozen.caseIds.filter(id => !migrated(id)).length;
  const v2BuildCases = manifest.v2.cases.filter(row => row.executor === 'prompt' && !migrated(row.id)).length;
  assert.equal(result.providerBuildsChecked, (frozenBuildCases + 750 + v2BuildCases + manifest.v3.cases.filter(row => row.executor === 'prompt').length) * 3);
  assert.equal(result.referenceAdversaryBuildsChecked, 4);
  assert.deepEqual(result.executedCaseIds, manifest.caseOrder);
  assert.equal(result.developmentFiltered, false);
  assert.equal(result.manifest.sourceIdentity, null);
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
  assert.equal(result.graphRAGRemediation.casesChecked, 23);
  assert.equal(result.graphRAGRemediation.providerBuildsChecked, 69);
  assert.equal(result.graphRAGRemediation.readingPromptVersion, '1.6.0');
  assert.equal(result.graphRAGRemediation.fixtureHash, manifest.graphRAGRemediation.rawHash);
});

test('qualification rejects an incorrect authored expectation instead of accepting corpus labels', async () => {
  const { readFileSync } = await import('node:fs');
  const { runDeterministicQualification } = await import('../scripts/evaluation/verifyNarrativePromptAssembly.js');
  const corpus = JSON.parse(readFileSync(new URL('./fixtures/knowledge-graph-context-cases.json', import.meta.url), 'utf8'));
  corpus.cases[0].expected.partialNarrative = 'An unsupported invented narrative';
  await assert.rejects(runDeterministicQualification({ corpus }), /partial-death-temperance-star-13-14/);
});

test('sample adapter preserves authoritative selection, explicit memory opt-out and caller interpretation', async () => {
  const payload = await samples.prepareNarrativeSamplePayload({
    ...sample, useSavedMemories: false,
    cards: sample.cards.map((card, index) => index ? card : { ...card, meaning: 'My partner is 42 and needs health guidance.' })
  }, { env: { GRAPHRAG_ENABLED: 'true', ENABLE_SEMANTIC_SCORING: 'false' } });
  assert.equal(payload.useSavedMemories, false);
  assert.deepEqual(payload.memories, []);
  assert.equal(payload.memorySelection.candidateCount, 0);
  assert.equal(payload.contextSelection.context, 'career');
  assert.equal(payload.analysis.graphRAGPayload.retrievalSummary.contextSelection.context, payload.contextSelection.context);
  assert.equal(payload.cardsInfo[0].callerMeaning, 'My partner is 42 and needs health guidance.');
  assert.notEqual(payload.cardsInfo[0].meaning, payload.cardsInfo[0].callerMeaning);
  assert.ok(!payload.contextSelection.selectedSourceIds.some(id => id.startsWith('interpretation-')));
});

test('v2 manifest expands stable complete matrix without modifying frozen evidence', async () => {
  const gate = await import('../scripts/evaluation/verifyNarrativePromptAssembly.js');
  assert.equal(typeof gate.loadQualificationManifest, 'function');
  const manifest = gate.loadQualificationManifest();
  assert.equal(manifest.frozen.rawHash, '578e615034eaef0e188ae04986cfc9834b62c80943dae089873582cb0cd2ee29');
  assert.equal(manifest.frozen.caseIds.length, 73);
  assert.equal(manifest.matrix.partial.length, 720);
  assert.equal(manifest.matrix.complete.length, 30);
  assert.equal(manifest.caps.length, 21);
  assert.equal(new Set(manifest.caseOrder).size, manifest.caseOrder.length);
  assert.equal(manifest.sourceIdentity, null, 'infrastructure does not freeze an unqualified source commit');
});


test('v2 manifest protects every pair permutation and approved expectation migration', async () => {
  const { loadQualificationManifest } = await import('../scripts/evaluation/verifyNarrativePromptAssembly.js');
  const manifest = loadQualificationManifest();
  assert.equal(manifest.v2.partialMatrix.seeds.length, 30);
  const migrations = Object.values(manifest.v2.expectationMigrations);
  assert.equal(migrations.length, 6);
  const memoryMigrations = migrations.filter(migration => migration.type === 'memory-admission');
  assert.equal(memoryMigrations.length, 5);
  for (const migration of memoryMigrations) {
    assert.equal(migration.oldExpected.memoriesSelected, 1);
    assert.equal(migration.newExpected.memoriesSelected, 0);
    assert.deepEqual(migration.newExpected.memoryIds, []);
    assert.ok(migration.reason.length > 30);
  }
  const partialMigrations = migrations.filter(migration => migration.type === 'partial-pattern-meaning');
  assert.equal(partialMigrations.length, 1);
  const partial = manifest.v2.expectationMigrations['partial-death-temperance-star-13-17'];
  assert.equal(partial.oldExpected.partialNarrative, 'Dramatic shift from ending to rebirth (skipping integration)');
  assert.equal(partial.newExpected.partialNarrative, 'Change accompanied by renewed possibility');
  assert.ok(partial.reason.length > 30);
  assert.equal(manifest.v2.partialMatrix.seeds.find(seed => seed.id === 'partial-death-temperance-star-13-17').expected.partialNarrative, 'Change accompanied by renewed possibility');
  const altered = structuredClone(manifest.v2);
  altered.partialMatrix.orientations.pop();
  assert.throws(() => loadQualificationManifest({ v2: altered }));
});

test('fixed output probes expose detected allowances and deterministic editorial blind spots', async () => {
  const { probeOutputQuality } = await import('../scripts/evaluation/verifyNarrativePromptAssembly.js');
  const probes = await probeOutputQuality();
  assert.equal(probes.length, 7);
  const byId = Object.fromEntries(probes.map(row => [row.id, row]));
  assert.deepEqual(byId['undrawn-within-allowance'].hallucinations, []);
  assert.deepEqual(byId['undrawn-within-allowance'].undrawnCardAssertions, ['The Moon']);
  assert.equal(byId['undrawn-within-allowance'].shouldBlock, true);
  assert.equal(byId['ambiguous-name-spread-assertion'].shouldBlock, true);
  assert.equal(byId['undrawn-above-allowance'].shouldBlock, true);
  for (const id of ['foreign-scene-without-card-name', 'unrelated-memory', 'irrelevant-valid-prose']) {
    assert.equal(byId[id].shouldBlock, false);
    assert.equal(byId[id].editorialReviewRequired, true);
  }
});
