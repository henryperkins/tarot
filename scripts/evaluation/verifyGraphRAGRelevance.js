#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildGraphContext } from '../../functions/lib/graphContext.js';
import { resolveContextSelection } from '../../functions/lib/contextDetection.js';
import {
  collectPassageCandidates,
  selectPassageCandidates,
  passageContextMatch,
  scoreKeywordRelevance,
  retrievalQueryTerms
} from '../../functions/lib/graphRAGCandidates.js';
import { getPassageCountForSpread } from '../../functions/lib/graphRAG.js';
import {
  composeRelevanceScore,
  composeLegacyWeightedRelevanceScore,
  DEFAULT_RELEVANCE_THRESHOLD,
  RELEVANCE_SCORING_POLICY_ID
} from '../../functions/lib/graphRAGScoring.js';
import { cosineSimilarity } from '../../functions/lib/embeddings.js';
import { PARTIAL_PROJECTION_VERSION } from '../../functions/lib/knowledgeBasePartialProjections.js';

export const LEXICAL_NORMALIZATION_VERSION = 'graphrag-lexical-v1';
export const PROJECTION_VERSION = `meaning-v1/${PARTIAL_PROJECTION_VERSION}`;

export function sha256Hex(value) {
  return createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

function isValidVector(vec, expectedDim = null) {
  return (
    Array.isArray(vec) &&
    vec.length > 0 &&
    (expectedDim === null || vec.length === expectedDim) &&
    vec.every((v) => typeof v === 'number' && Number.isFinite(v)) &&
    vec.some((v) => v !== 0)
  );
}

export function evaluateGraphRAGRelevance({ fixturesDoc, evidenceDoc, fixturesRaw = '' }) {
  const errors = [];
  if (!fixturesDoc || !Array.isArray(fixturesDoc.cases) || fixturesDoc.cases.length === 0) {
    errors.push('Invalid or empty fixtures document.');
  }
  if (!evidenceDoc || typeof evidenceDoc !== 'object') {
    errors.push('Missing or invalid frozen embedding evidence document.');
  }
  if (errors.length > 0) {
    return {
      ok: false,
      status: 'failed_missing_or_mismatched_evidence',
      errors
    };
  }

  const expectedCaseOrder = fixturesDoc.cases.map((c) => c.id);
  if (
    !Array.isArray(evidenceDoc.caseOrder) ||
    JSON.stringify(evidenceDoc.caseOrder) !== JSON.stringify(expectedCaseOrder)
  ) {
    errors.push(
      `Evidence caseOrder ${JSON.stringify(evidenceDoc.caseOrder || null)} does not match fixture case order ${JSON.stringify(expectedCaseOrder)}.`
    );
  }
  if (!evidenceDoc.model || typeof evidenceDoc.model !== 'string') {
    errors.push('Evidence is missing required embedding model identifier.');
  }

  const vectorsByHash =
    evidenceDoc.vectorsByTextHash && typeof evidenceDoc.vectorsByTextHash === 'object'
      ? evidenceDoc.vectorsByTextHash
      : {};
  const cosinesByCaseAndCandidate =
    evidenceDoc.cosinesByCase && typeof evidenceDoc.cosinesByCase === 'object'
      ? evidenceDoc.cosinesByCase
      : {};

  let vectorDimension = null;
  const perCase = [];
  const changedSelections = [];

  for (const fixture of fixturesDoc.cases) {
    const spreadKey = fixture.spreadKey || 'general';
    const deckStyle = fixture.deck || 'rws-1909';
    const maxPassages = getPassageCountForSpread(spreadKey, 'plus');
    const selection = resolveContextSelection({ userQuestion: fixture.acceptedQuery }, spreadKey);
    const graphContext = buildGraphContext(fixture.cards, { deckStyle });
    const candidates = collectPassageCandidates(graphContext?.graphKeys || {}, {
      deckStyle,
      questionContext: selection.graphRAGContext,
      includeMetadata: true
    });
    const queryHash = sha256Hex(selection.retrievalQuery);
    const queryTerms = retrievalQueryTerms(selection.retrievalContentText);

    const caseEvidence = cosinesByCaseAndCandidate[fixture.id] || null;
    if (caseEvidence?.queryHash && caseEvidence.queryHash !== queryHash) {
      errors.push(`Case ${fixture.id}: queryHash mismatch (expected ${queryHash}, got ${caseEvidence.queryHash}).`);
    }

    const queryVec = vectorsByHash[queryHash] || null;
    if (queryVec) {
      if (!isValidVector(queryVec, vectorDimension)) {
        errors.push(`Case ${fixture.id}: invalid query vector for hash ${queryHash}.`);
      } else if (vectorDimension === null) {
        vectorDimension = queryVec.length;
      }
    }

    const baselineScored = [];
    const candidateScored = [];
    const scoreComponents = [];

    for (const candidate of candidates) {
      const promptTextHash = sha256Hex(candidate.promptText);
      let cosine = null;
      if (queryVec && vectorsByHash[promptTextHash]) {
        const candVec = vectorsByHash[promptTextHash];
        if (!isValidVector(candVec, vectorDimension)) {
          errors.push(`Case ${fixture.id}: invalid candidate vector for ${candidate.candidateId}.`);
        } else {
          cosine = cosineSimilarity(queryVec, candVec);
        }
      } else if (
        caseEvidence?.candidates &&
        Object.hasOwn(caseEvidence.candidates, candidate.candidateId) &&
        caseEvidence.candidates[candidate.candidateId]?.promptTextHash === promptTextHash &&
        typeof caseEvidence.candidates[candidate.candidateId]?.cosine === 'number' &&
        Number.isFinite(caseEvidence.candidates[candidate.candidateId].cosine)
      ) {
        cosine = caseEvidence.candidates[candidate.candidateId].cosine;
      } else {
        errors.push(
          `Case ${fixture.id}: missing or mismatched frozen embedding for candidate ${candidate.candidateId} (promptTextHash ${promptTextHash}).`
        );
      }

      const keywordScore = scoreKeywordRelevance(
        candidate.promptText,
        selection.retrievalContentText,
        queryTerms
      );
      const baselineScore = composeLegacyWeightedRelevanceScore({
        keywordScore,
        semanticScore: cosine
      });
      const proposedScore = composeRelevanceScore({
        keywordScore,
        semanticScore: cosine
      });
      const contextMatch = passageContextMatch(candidate, selection.graphRAGContext);

      baselineScored.push({
        ...candidate,
        relevance: keywordScore,
        relevanceScore: baselineScore,
        _semanticScoringAttempted: true,
        _semanticScoringSucceeded: cosine !== null,
        _contextMatch: contextMatch,
        _priorityOnly: false
      });

      candidateScored.push({
        ...candidate,
        relevance: keywordScore,
        relevanceScore: proposedScore,
        _semanticScoringAttempted: true,
        _semanticScoringSucceeded: cosine !== null,
        _contextMatch: contextMatch,
        _priorityOnly: false
      });

      scoreComponents.push({
        candidateId: candidate.candidateId,
        sourceId: candidate.sourceId,
        type: candidate.type,
        patternId: candidate.patternId,
        context: candidate.context || 'general',
        promptTextHash,
        keywordScore,
        semanticScore: cosine,
        baselineScore,
        candidateScore: proposedScore,
        contextMatch
      });
    }

    const baselineSelected = selectPassageCandidates(baselineScored, {
      maxPassages,
      minRelevanceScore: DEFAULT_RELEVANCE_THRESHOLD,
      enableDeduplication: true
    });
    const candidateSelected = selectPassageCandidates(candidateScored, {
      maxPassages,
      minRelevanceScore: DEFAULT_RELEVANCE_THRESHOLD,
      enableDeduplication: true
    });

    const expectedRelevant = new Set(fixture.expectedRelevantCandidateIds || []);
    const expectedIrrelevant = new Set(fixture.expectedIrrelevantCandidateIds || []);

    const computeMetrics = (selected) => {
      const strongSelected = selected.filter((p) => p.belowRelevanceThreshold !== true);
      const strongIds = strongSelected.map((p) => p.candidateId);
      const relevantHits = strongIds.filter((id) => expectedRelevant.has(id));
      const falsePositives = strongIds.filter((id) => expectedIrrelevant.has(id));
      const recallTarget = Math.min(maxPassages, expectedRelevant.size);
      const recall = recallTarget === 0 ? 1 : relevantHits.length / recallTarget;
      const precision =
        strongIds.length === 0 ? (expectedRelevant.size === 0 ? 1 : 0) : (strongIds.length - falsePositives.length) / strongIds.length;
      return {
        selectedIds: selected.map((p) => p.candidateId),
        strongSelectedIds: strongIds,
        weakFloorIds: selected.filter((p) => p.belowRelevanceThreshold === true).map((p) => p.candidateId),
        relevantHits,
        falsePositives,
        recall,
        precision,
        capHonored: selected.length <= maxPassages
      };
    };

    const baselineMetrics = computeMetrics(baselineSelected);
    const candidateMetrics = computeMetrics(candidateSelected);
    const selectionChanged =
      JSON.stringify(baselineMetrics.selectedIds) !== JSON.stringify(candidateMetrics.selectedIds) ||
      JSON.stringify(baselineMetrics.strongSelectedIds) !== JSON.stringify(candidateMetrics.strongSelectedIds);

    if (selectionChanged) {
      changedSelections.push({
        id: fixture.id,
        fixtureClass: fixture.fixtureClass,
        baselineSelectedIds: baselineMetrics.selectedIds,
        baselineStrongIds: baselineMetrics.strongSelectedIds,
        candidateSelectedIds: candidateMetrics.selectedIds,
        candidateStrongIds: candidateMetrics.strongSelectedIds,
        newFalsePositives: candidateMetrics.falsePositives.filter(
          (id) => !baselineMetrics.falsePositives.includes(id)
        )
      });
    }

    perCase.push({
      id: fixture.id,
      fixtureClass: fixture.fixtureClass,
      deck: deckStyle,
      spreadKey,
      maxPassages,
      graphRAGContext: selection.graphRAGContext,
      queryHash,
      projectionVersion: PROJECTION_VERSION,
      scoreComponents,
      baseline: baselineMetrics,
      candidate: candidateMetrics,
      selectionChanged
    });
  }

  if (errors.length > 0) {
    return {
      ok: false,
      status: 'failed_missing_or_mismatched_evidence',
      errors,
      perCase
    };
  }

  const byClass = {};
  for (const row of perCase) {
    if (!byClass[row.fixtureClass]) {
      byClass[row.fixtureClass] = [];
    }
    byClass[row.fixtureClass].push(row);
  }

  const macroByClass = Object.fromEntries(
    Object.entries(byClass).map(([cls, rows]) => {
      const avg = (vals) => vals.reduce((s, v) => s + v, 0) / vals.length;
      return [
        cls,
        {
          caseCount: rows.length,
          baselineMacroRecall: avg(rows.map((r) => r.baseline.recall)),
          candidateMacroRecall: avg(rows.map((r) => r.candidate.recall)),
          baselineMacroPrecision: avg(rows.map((r) => r.baseline.precision)),
          candidateMacroPrecision: avg(rows.map((r) => r.candidate.precision)),
          newFalsePositives: rows.flatMap((r) =>
            r.candidate.falsePositives.filter((id) => !r.baseline.falsePositives.includes(id))
          )
        }
      ];
    })
  );

  const zeroOverlapCases = perCase.filter((r) => r.fixtureClass === 'multilingual_retrieval');
  const zeroOverlapPositivesPass =
    zeroOverlapCases.length > 0 &&
    zeroOverlapCases.every((r) => r.candidate.strongSelectedIds.length > 0 && r.candidate.recall > 0);
  const newFalsePositives = changedSelections.flatMap((c) => c.newFalsePositives);
  const recallRegressions = perCase
    .filter((r) => r.candidate.recall < r.baseline.recall)
    .map((r) => r.id);
  const capRegressions = perCase.filter((r) => !r.candidate.capHonored).map((r) => r.id);

  const acceptancePassed =
    zeroOverlapPositivesPass &&
    newFalsePositives.length === 0 &&
    recallRegressions.length === 0 &&
    capRegressions.length === 0;

  return {
    ok: acceptancePassed,
    status: acceptancePassed ? 'passed' : 'failed_acceptance_criteria',
    policy: {
      id: RELEVANCE_SCORING_POLICY_ID,
      formula: 's + 0.3 * k * (1 - s)',
      baselineFormula: '0.3 * k + 0.7 * s',
      threshold: DEFAULT_RELEVANCE_THRESHOLD,
      lexicalVersion: LEXICAL_NORMALIZATION_VERSION,
      projectionVersion: PROJECTION_VERSION
    },
    evidenceMetadata: {
      model: evidenceDoc.model,
      providerMetadata: evidenceDoc.providerMetadata || null,
      fixturesHash: sha256Hex(fixturesRaw || JSON.stringify(fixturesDoc)),
      caseOrder: expectedCaseOrder
    },
    acceptanceChecks: {
      zeroOverlapPositivesPass,
      newFalsePositives,
      recallRegressions,
      capRegressions
    },
    macroByClass,
    changedSelections,
    perCase
  };
}

function parseArgs(argv) {
  const args = {
    fixtures: 'tests/fixtures/graph-rag-relevance-cases.json',
    embeddings: null,
    json: false
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--fixtures' && argv[i + 1]) {
      args.fixtures = argv[++i];
    } else if (arg === '--embeddings' && argv[i + 1]) {
      args.embeddings = argv[++i];
    } else if (arg === '--json') {
      args.json = true;
    }
  }
  return args;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv);
  if (!args.embeddings) {
    const errPayload = {
      ok: false,
      status: 'failed_missing_or_mismatched_evidence',
      errors: ['Missing required --embeddings <frozen-evidence-path> argument. No implicit live-provider mode is permitted.']
    };
    if (args.json) {
      console.log(JSON.stringify(errPayload, null, 2));
    } else {
      console.error(errPayload.errors[0]);
    }
    process.exit(1);
  }

  let fixturesRaw = '';
  let fixturesDoc = null;
  let evidenceDoc = null;
  try {
    fixturesRaw = fs.readFileSync(args.fixtures, 'utf8');
    fixturesDoc = JSON.parse(fixturesRaw);
    evidenceDoc = JSON.parse(fs.readFileSync(args.embeddings, 'utf8'));
  } catch (err) {
    const errPayload = {
      ok: false,
      status: 'failed_missing_or_mismatched_evidence',
      errors: [`Failed to read fixtures or frozen embeddings: ${err.message}`]
    };
    if (args.json) {
      console.log(JSON.stringify(errPayload, null, 2));
    } else {
      console.error(errPayload.errors[0]);
    }
    process.exit(1);
  }

  const report = evaluateGraphRAGRelevance({ fixturesDoc, evidenceDoc, fixturesRaw });
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Status: ${report.status} (ok=${report.ok})`);
    if (report.errors?.length) {
      for (const e of report.errors) console.error(`  - ${e}`);
    }
  }
  process.exit(report.ok ? 0 : 1);
}
