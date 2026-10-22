#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { prepareNarrativeSamplePayload } from './runNarrativeSamples.js';
import { buildEnhancedClaudePrompt, parseGraphRAGReferenceBlock } from '../../functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js';
import { prepareReadingContextSources } from '../../functions/lib/readingContextSources.js';
import { resolveContextSelection } from '../../functions/lib/contextDetection.js';
import { collectPassageCandidates } from '../../functions/lib/graphRAGCandidates.js';
import { projectPassageForDeck } from '../../functions/lib/graphRAGProjection.js';
import { getPassageCountForSpread, retrievePassagesWithQuality, buildQualityRetrievalSummary } from '../../functions/lib/graphRAG.js';
import { clearEmbeddingCache } from '../../functions/lib/embeddings.js';
import { estimateTokenCount, getHardCapBudget } from '../../functions/lib/narrative/prompts/budgeting.js';
import { truncateUserPromptSafely } from '../../functions/lib/narrative/prompts/truncation.js';
import { parseUserContext, prepareUserContext, summarizeUserContext } from '../../functions/lib/narrative/prompts/userContext.js';
import { parseMemoryBlocks } from '../../functions/lib/userMemory.js';
import { composeReadingEnhanced } from '../../functions/lib/narrativeBackends.js';
import { onRequestPost } from '../../functions/api/tarot-reading.js';
import * as canon from '../../functions/lib/knowledgeBase.js';

const FIXTURES_URL = new URL('../../tests/fixtures/knowledge-graph-context-cases.json', import.meta.url);
const PAIRED_HASH = 'ae2ab4ee406b7b085d6e6f9887b32c7159bb9bf9522b1e33b7f040106acc1c95';
const DECKS = ['rws-1909', 'thoth-a1', 'marseille-classic'];
const TARGETS = ['claude', 'openai', 'modal'];
const BASE_ENV = Object.freeze({ GRAPHRAG_ENABLED: 'true', ENABLE_SEMANTIC_SCORING: 'false' });
const hash = value => createHash('sha256').update(value).digest('hex');

function promptArguments(payload, target = 'claude', extra = {}) {
  return { ...payload, themes: payload.analysis.themes, spreadAnalysis: payload.analysis.spreadAnalysis, budgetTarget: target, promptBudgetEnv: BASE_ENV, ...extra };
}

function verifyFinalPrompt(built, payload, target, label) {
  const cap = getHardCapBudget(target);
  const tokens = estimateTokenCount(built.systemPrompt) + estimateTokenCount(built.userPrompt);
  if (cap != null) assert.ok(tokens <= cap, `${label}: ${target} cap exceeded (${tokens}/${cap})`);
  assert.match(built.systemPrompt, /ETHICS/);
  assert.match(built.systemPrompt, /CORE PRINCIPLES/);
  const references = parseGraphRAGReferenceBlock(built.userPrompt);
  const graphUsage = built.promptMeta.sourceUsage.graphRAG;
  if (graphUsage.mode === 'full') {
    assert.equal(references.status, 'complete', `${label}: incomplete retained reference`);
    assert.equal(graphUsage.passagesUsedInPrompt, references.passageCount);
    assert.match(built.userPrompt, /internally authored Tableu Tarot Canon/);
    assert.doesNotMatch(built.userPrompt, /respected tarot literature/);
  } else assert.equal(graphUsage.passagesUsedInPrompt, 0);
  const blocks = parseMemoryBlocks(built.userPrompt);
  assert.equal(built.promptMeta.memories.retainedCount, blocks.size);
  assert.equal(built.memoryRetention.retainedSlots.length, blocks.size);
  assert.equal(built.promptMeta.sourceUsage.memories.memoriesUsedInPrompt, blocks.size);
  assert.doesNotMatch(JSON.stringify(built.promptMeta), /slotToId|selectedIds|synthetic-old-career|synthetic-right-child/);
  for (const memory of payload.memories) assert.ok(!built.userPrompt.includes(memory.id), `${label}: memory ID in prompt`);
  assert.equal((built.userPrompt.match(/<reading_memory /g) || []).length, (built.userPrompt.match(/<\/reading_memory>/g) || []).length);
  assert.equal((built.userPrompt.match(/<user_context /g) || []).length, (built.userPrompt.match(/<\/user_context>/g) || []).length);
  const retainedFields = parseUserContext(built.userPrompt);
  for (const [id, field] of Object.entries(built.promptMeta.sourceUsage.userContext.fields || {})) {
    const value = retainedFields.get(id);
    const length = typeof value === 'string' ? value.length : value ? value.head.length + value.tail.length : 0;
    assert.equal(field.includedLength, length, `${label}: final retained length for ${id}`);
  }
}

function verifyCanonProjections() {
  const families = { TRIAD_PASSAGES: 'triad', FOOLS_JOURNEY_PASSAGES: 'fools-journey', MAJOR_ARCANA_PASSAGES: 'major-arcana', DYAD_PASSAGES: 'dyad', SUIT_PROGRESSION_PASSAGES: 'suit-progression', COURT_LINEAGE_PASSAGES: 'court-lineage', THOTH_SUIT_PASSAGES: 'thoth-suit', MARSEILLE_NUMEROLOGY_PASSAGES: 'marseille-numerology' };
  const identities = [];
  let projections = 0;
  function visit(entries, type, keys = []) {
    for (const [key, entry] of Object.entries(entries)) {
      if (!entry.passages) { visit(entry, type, [...keys, key]); continue; }
      for (const passage of entry.passages) {
        const patternId = [...keys, key].join(':');
        identities.push([type, patternId, passage.context || 'general', passage.text, passage.archetypalText]);
        for (const deckStyle of DECKS) {
          const projected = projectPassageForDeck({ ...passage, type, patternId }, deckStyle);
          assert.ok(projected, `${type}/${patternId}: missing ${deckStyle} projection`);
          assert.equal(projected.text, passage.text);
          if (projected.crossDeckReference) {
            assert.equal(projected.promptText, passage.archetypalText);
            assert.deepEqual(projected.promptVisualAnchors, []);
          } else assert.equal(projected.promptText, passage.text);
          projections++;
        }
      }
    }
  }
  for (const [family, type] of Object.entries(families)) visit(canon[family], type);
  assert.equal(identities.length, 145);
  return { canonPassagesChecked: identities.length, deckProjectionsChecked: projections, canonProjectionHash: hash(JSON.stringify(identities)) };
}

function verifyFixtureExpectations(fixture, payload, selection, candidates) {
  const expected = fixture.expected || {};
  const patterns = payload.analysis.themes.knowledgeGraph?.patterns;
  if (expected.partialTriad) {
    const partial = patterns?.triads?.find(triad => triad.id === expected.partialTriad);
    assert.equal(partial?.isComplete, false);
    assert.equal(partial.narrative, expected.partialNarrative);
    assert.equal(partial.matchedCards.length, 2);
    assert.equal(partial.missingCards.length, 1);
    const highlights = payload.analysis.themes.knowledgeGraph.narrativeHighlights.filter(entry => entry.type === 'partial-triad' && entry.id === partial.id);
    for (const highlight of highlights) {
      assert.match(highlight.text, /partial/i);
      assert.ok(highlight.text.includes(expected.partialNarrative));
      assert.deepEqual(highlight.cards.slice().sort((a, b) => a - b), partial.matchedCards.slice().sort((a, b) => a - b));
    }
  }
  if (expected.completeTriad) assert.equal(patterns?.triads?.find(triad => triad.id === expected.completeTriad)?.isComplete, true);
  if (expected.context) assert.equal(payload.context, expected.context, `${fixture.id}: current context`);
  if (expected.graphRAGContext) assert.equal(selection.graphRAGContext, expected.graphRAGContext);
  if (expected.contextSource) assert.equal(selection.source, expected.contextSource);
  if (expected.selectedSource) assert.ok(selection.selectedSourceIds.includes(expected.selectedSource));
  if (expected.pathA) assert.equal(payload.decisionPaths.a, expected.pathA);
  if (expected.pathB) assert.equal(payload.decisionPaths.b, expected.pathB);
  if (expected.pathBAbsent) assert.equal(payload.decisionPaths.b || '', '');
  if (expected.memoryIds) assert.deepEqual(payload.memories.map(memory => memory.id), expected.memoryIds);
  if (expected.memoriesSelected !== undefined) assert.equal(payload.memorySelection.selectedCount, expected.memoriesSelected);
  if (expected.currentNote) assert.ok(selection.retrievalQuery.includes(expected.currentNote), `${fixture.id}: selected current evidence missing from retrieval`);
  assert.ok(selection.retrievalQuery.length <= 8000);
  assert.equal(new Set(candidates.map(candidate => candidate.candidateId)).size, candidates.length);
  const ids = new Set(candidates.map(candidate => candidate.candidateId));
  const passages = payload.graphRAGPayload?.passages || [];
  for (const passage of passages) assert.ok(ids.has(passage.candidateId), `${fixture.id}: selected outside the projected candidate set`);
  assert.ok(passages.length <= getPassageCountForSpread(fixture.spreadKey, fixture.subscriptionTier || 'pro'));
}

function stressMeanings(payload, repetitions) {
  // Repetition increases budget pressure without inventing card identities or
  // outside imagery. These remain accepted-size current reflection fields.
  return { ...payload, cardsInfo: payload.cardsInfo.map(card => ({ ...card, meaning: `${card.meaning.replace(/[.!?]/g, '')} `.repeat(repetitions) })) };
}

async function exerciseBoundary(fixture, originalPayload, summary) {
  const boundary = fixture.boundary;
  if (!boundary) return;
  const config = fixture.qualification || {};
  const payload = config.repeatCardMeaning ? stressMeanings(originalPayload, config.repeatCardMeaning) : originalPayload;
  let built;
  if (boundary === 'slimming' || boundary === 'removed-graph') {
    built = buildEnhancedClaudePrompt(promptArguments(payload, config.budgetTarget, { promptBudgetEnv: { ...BASE_ENV, ...config.env } }));
    if (boundary === 'slimming') {
      assert.equal(built.promptMeta.slimmingEnabled, true);
      assert.ok(built.promptMeta.slimmingSteps.length);
      summary.boundaries[boundary] = { steps: built.promptMeta.slimmingSteps.length };
    } else {
      assert.equal(built.promptMeta.sourceUsage.graphRAG.mode, 'none');
      assert.equal(built.promptMeta.sourceUsage.patterns.patternsUsedInPrompt, 0, 'the frozen disabled-graph fixture must suppress highlights as well as references');
      summary.boundaries[boundary] = { mode: 'none', retainedPatterns: built.promptMeta.sourceUsage.patterns.patternsUsedInPrompt };
      // Check passage-only removal separately with the graph enabled. Keep the
      // frozen fixture bytes and paired identities unchanged.
      const passageOnly = buildEnhancedClaudePrompt(promptArguments(payload, config.budgetTarget, { graphRAGPayload: { passages: [] } }));
      assert.equal(passageOnly.promptMeta.sourceUsage.graphRAG.mode, 'none');
      assert.ok(passageOnly.promptMeta.sourceUsage.patterns.patternsUsedInPrompt > 0, 'passage removal must not erase enabled actual-card highlights');
      verifyFinalPrompt(passageOnly, payload, config.budgetTarget, `${fixture.id}:passage-only`);
      summary.boundaries['removed-passages'] = { mode: 'none', retainedPatterns: passageOnly.promptMeta.sourceUsage.patterns.patternsUsedInPrompt };
    }
  } else if (boundary === 'summary-only') {
    const canonPassage = payload.graphRAGPayload.passages[0];
    assert.ok(canonPassage);
    const graphRAGPayload = { ...payload.graphRAGPayload, maxPassages: 1, passages: [{ ...canonPassage, text: `${canonPassage.text} `.repeat(config.repeatCanonPassage), archetypalText: `${canonPassage.archetypalText} `.repeat(config.repeatCanonPassage) }] };
    built = buildEnhancedClaudePrompt(promptArguments(payload, config.budgetTarget, { graphRAGPayload }));
    assert.equal(built.promptMeta.sourceUsage.graphRAG.mode, 'summary');
    assert.equal(built.promptMeta.sourceUsage.graphRAG.passagesUsedInPrompt, 0);
    assert.match(built.userPrompt, /CARD GUARDRAIL/);
    summary.boundaries[boundary] = { mode: 'summary', passages: 0 };
  } else if (boundary === 'partial-path') {
    built = buildEnhancedClaudePrompt(promptArguments(payload));
    const fields = prepareUserContext(payload.userQuestion, payload.reflectionsText, payload.cardsInfo, payload.userContextInputStats, payload.decisionPaths);
    const label = payload.decisionPaths.a;
    // Use the actual final user-prompt rebuild. Its component budget is below
    // a provider cap, whose independent hard-cap behavior is checked above.
    let truncated = null;
    for (let budget = config.truncateUserBudget; budget <= 1600; budget += 10) {
      const candidate = truncateUserPromptSafely(built.userPrompt, budget, { spreadKey: 'decision' });
      const partial = parseUserContext(candidate.text).get('pathA');
      if (partial?.omittedForBudget && partial.head.length >= 8 && partial.tail.length >= 8) {
        truncated = { ...candidate, budget };
        break;
      }
    }
    assert.ok(truncated, 'final rebuilt prompt must retain a partial path rather than merely omit it');
    const retention = summarizeUserContext(fields, truncated.text);
    assert.equal(retention.pathA.budgetTruncated, true);
    assert.ok(retention.pathA.includedLength > 0 && retention.pathA.includedLength < label.length);
    assert.ok(estimateTokenCount(truncated.text) <= truncated.budget);
    summary.boundaries[boundary] = { partial: true, includedLength: retention.pathA.includedLength, eligibleLength: retention.pathA.eligibleLength, userBudget: truncated.budget };
  } else if (boundary === 'removed-memory' || boundary === 'removed-highlights') {
    const themes = config.repeatThemeContext ? { ...payload.analysis.themes, suitFocus: `${payload.analysis.themes.suitFocus || 'Card patterns support reflective interpretation.'} `.repeat(config.repeatThemeContext) } : payload.analysis.themes;
    built = buildEnhancedClaudePrompt(promptArguments(payload, config.budgetTarget, { themes }));
    if (boundary === 'removed-memory') {
      assert.equal(built.promptMeta.memories.selectedCount, 1);
      assert.equal(built.promptMeta.memories.retainedCount, 0);
      assert.equal(parseMemoryBlocks(built.userPrompt).size, 0);
      assert.deepEqual(built.memoryRetention.retainedSlots, []);
      for (const memory of payload.memories) assert.ok(!built.userPrompt.includes(memory.text));
      summary.boundaries[boundary] = { selected: 1, retained: 0 };
    } else {
      const usage = built.promptMeta.sourceUsage.patterns;
      assert.ok(usage.patternsProvided > 0);
      assert.equal(usage.patternsUsedInPrompt, 0);
      summary.boundaries[boundary] = { provided: usage.patternsProvided, used: 0 };
    }
  } else if (['embedding-outage', 'quality-bypass', 'beyond-old-shortlist'].includes(boundary)) {
    clearEmbeddingCache();
    const graphKeys = payload.analysis.themes.knowledgeGraph.graphKeys;
    const candidates = collectPassageCandidates(graphKeys, { deckStyle: payload.deckStyle });
    const target = candidates.find(candidate => candidate.type === 'dyad' && candidate.patternId === '13-17');
    const query = boundary === 'beyond-old-shortlist' ? 'Quelle direction mérite mon attention?' : 'career interview';
    let calls = 0;
    const env = { ...(boundary === 'quality-bypass' ? { DISABLE_QUALITY_FILTERING: 'true' } : {}), AI: { run: async (_model, { text }) => {
      calls++;
      if (boundary === 'embedding-outage') throw new Error('Synthetic embedding outage');
      return { data: text.map(input => input === query || input === target?.promptText ? [1, 0] : [0, 1]) };
    } } };
    const selected = await retrievePassagesWithQuality(graphKeys, { env, userQuery: query, maxPassages: 1, deckStyle: payload.deckStyle, enableSemanticScoring: true });
    const stats = buildQualityRetrievalSummary(graphKeys, selected);
    if (boundary === 'embedding-outage') {
      assert.equal(stats.scoringMethod, 'keyword');
      assert.equal(stats.qualityMetrics.semanticScoringAttempted, true);
      assert.equal(stats.qualityMetrics.semanticScoringUsed, false);
      assert.ok(stats.semanticScoringFallbackReason);
      assert.ok(calls > 0);
    } else if (boundary === 'quality-bypass') {
      assert.equal(stats.scoringMethod, 'bypassed');
      assert.equal(calls, 0);
    } else {
      assert.ok(candidates.indexOf(target) >= 2, 'winner must be beyond the old two-candidate shortlist');
      assert.equal(selected[0].patternId, '13-17');
      assert.equal(stats.scoringMethod, 'semantic');
      assert.equal(stats.candidatesScored, candidates.length);
    }
    built = buildEnhancedClaudePrompt(promptArguments(payload, 'claude', { graphRAGPayload: { ...payload.graphRAGPayload, passages: selected, maxPassages: 1, retrievalSummary: stats } }));
    summary.boundaries[boundary] = { scoringMethod: stats.scoringMethod, candidatesScored: stats.candidatesScored, patternId: selected[0]?.patternId, fallback: Boolean(stats.semanticScoringFallbackReason) };
    clearEmbeddingCache();
  } else if (boundary === 'local-composer') {
    buildEnhancedClaudePrompt(promptArguments(payload));
    payload.memoryRetention = { retainedSlots: ['memory-0'], slotToId: {} };
    const result = await composeReadingEnhanced(payload, BASE_ENV);
    assert.equal(result.promptMeta.sourceUsage.graphRAG.mode, 'none');
    assert.equal(result.promptMeta.memories.retainedCount, 0);
    assert.deepEqual(payload.memoryRetention.retainedSlots, []);
    summary.boundaries[boundary] = { graphMode: 'none', retainedMemories: 0 };
  } else if (boundary === 'safe-fallback') {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'Death, Temperance, and The Star invite reflection. Your choices shape outcomes.' } }] });
    try {
      const work = [];
      const response = await onRequestPost({
        request: new Request('https://qualification.test/api/tarot-reading', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ spreadInfo: payload.spreadInfo, cardsInfo: payload.cardsInfo, userQuestion: payload.userQuestion, reflectionsText: payload.reflectionsText }) }),
        env: { ...BASE_ENV, MODAL_ENDPOINT_URL: 'https://synthetic.invalid', MODAL_PROXY_TOKEN: 'synthetic', MODAL_MODEL: 'synthetic', EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'true', AI: { run: async () => ({ response: JSON.stringify({ personalization: 4, tarot_coherence: 4, tone: 4, safety: 1, overall: 1, safety_flag: true }) }) } },
        waitUntil: promise => work.push(promise)
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.provider, 'safe-fallback');
      assert.equal(body.sourceUsage, null);
      await Promise.all(work);
      summary.boundaries[boundary] = { provider: body.provider, sourceUsage: null };
    } finally { globalThis.fetch = originalFetch; }
  } else throw new Error(`Unexercised qualification boundary: ${boundary}`);
  if (built) verifyFinalPrompt(built, payload, config.budgetTarget || 'claude', fixture.id);
}

/** Offline qualification: actual pipeline, fixed synthetic sources, no provider requests. */
export async function runDeterministicQualification({ corpus = JSON.parse(readFileSync(FIXTURES_URL, 'utf8')), quiet = true } = {}) {
  const originalLog = console.log;
  const originalWarn = console.warn;
  if (quiet) { console.log = () => {}; console.warn = () => {}; }
  try {
    assert.equal(new Set(corpus.cases.map(fixture => fixture.id)).size, corpus.cases.length);
    const paired = corpus.cases.filter(fixture => corpus.pairedCaseIds.includes(fixture.id));
    const pairedFixtureHash = hash(JSON.stringify([corpus.pairedCaseIds, paired]));
    assert.equal(pairedFixtureHash, PAIRED_HASH, 'Frozen paired fixtures or order changed');
    const summary = { casesChecked: 0, partialPairsChecked: 0, completeTriadsChecked: 0, pairedCasesChecked: paired.length, providerBuildsChecked: 0, providerBudgets: { claude: 25000, openai: 20000, modal: null }, fixtureHash: hash(JSON.stringify(corpus)), pairedFixtureHash, ...verifyCanonProjections(), boundaries: {} };
    for (const fixture of corpus.cases) {
      try {
        const payload = await prepareNarrativeSamplePayload(fixture, { env: BASE_ENV });
        const sources = prepareReadingContextSources({ ...payload, spreadKey: fixture.spreadKey, focusAreas: payload.personalization?.focusAreas });
        const selection = resolveContextSelection({ sources }, fixture.spreadKey);
        const candidates = collectPassageCandidates(payload.analysis.themes.knowledgeGraph?.graphKeys, { deckStyle: payload.deckStyle });
        verifyFixtureExpectations(fixture, payload, selection, candidates);
        for (const target of TARGETS) {
          const built = buildEnhancedClaudePrompt(promptArguments(payload, target));
          verifyFinalPrompt(built, payload, target, fixture.id);
          if (fixture.expected?.memoriesSelected !== undefined) {
            assert.equal(built.promptMeta.memories.selectedCount, fixture.expected.memoriesSelected);
            assert.equal(built.promptMeta.memories.retainedCount, fixture.expected.memoriesSelected);
          }
          if (target === 'modal') {
            for (const card of payload.cardsInfo) assert.ok(built.userPrompt.includes(card.card), `${fixture.id}: canonical card omitted`);
            if (fixture.expected?.currentNote) assert.ok(built.userPrompt.includes(fixture.expected.currentNote));
          }
          summary.providerBuildsChecked++;
        }
        await exerciseBoundary(fixture, payload, summary);
        if (fixture.id.startsWith('partial-')) summary.partialPairsChecked++;
        if (fixture.id.startsWith('complete-')) summary.completeTriadsChecked++;
        summary.casesChecked++;
      } catch (error) { throw new Error(`${fixture.id}: ${error.message}`, { cause: error }); }
    }
    assert.equal(summary.partialPairsChecked, 30);
    assert.equal(summary.completeTriadsChecked, 10);
    assert.equal(summary.pairedCasesChecked, 18);
    return summary;
  } finally { console.log = originalLog; console.warn = originalWarn; clearEmbeddingCache(); }
}

async function main() {
  const result = await runDeterministicQualification();
  if (process.argv.includes('--json')) console.log(JSON.stringify(result));
  else console.log(`Narrative prompt assembly checks passed: ${result.casesChecked} fixtures, ${result.providerBuildsChecked} provider builds, ${result.partialPairsChecked} partial pairs, ${result.completeTriadsChecked} complete triads, ${result.deckProjectionsChecked} canon/deck projections, ${Object.keys(result.boundaries).length} exercised boundaries.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error('Narrative prompt assembly checks failed:', error.message); process.exitCode = 1; });
