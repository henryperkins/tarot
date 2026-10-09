import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { getVectorGestureDetails } from '../../../src/data/cardGestureArtwork.js';

const KINDS = ['identity', 'literal', 'interpretation', 'balance', 'relationship'];
const PARTITIONS = ['development', 'reserved-regression', 'standalone-regression', 'outside-review-regression'];
const EDITION = 'rws-immanuelle-vector';
const DEFAULT_ROOT = resolve(import.meta.dirname, '../../..');
const DEFAULT_MANIFEST = 'scripts/evaluation/fixtures/readingCueQualification.json';
const sha = text => createHash('sha256').update(text).digest('hex');
const canonical = value => JSON.stringify(sortJSON(value));
function sortJSON(value) {
  if (Array.isArray(value)) return value.map(sortJSON);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortJSON(value[key])]));
}
function sourcePath(root, path) {
  const resolved = resolve(root, path);
  if (isAbsolute(path) || relative(root, resolved).startsWith('..')) throw new Error('Source must be repo-relative');
  return resolved;
}
function fieldValue(value, path) {
  if (!/^[a-zA-Z0-9_]+(?:\[\d+\]|\.[a-zA-Z0-9_]+)*$/.test(path)) throw new Error('Invalid source field path');
  return path.replace(/\[(\d+)\]/g, '.$1').split('.').reduce((at, key) => at?.[key], value);
}
function exactSpan(raw, span) {
  return Number.isInteger(span?.start) && Number.isInteger(span?.end) && span.start >= 0
    && span.end > span.start && span.end <= raw.length && typeof span.quote === 'string'
    && raw.slice(span.start, span.end) === span.quote;
}
function contextValid(c, context) {
  if (!context) return true;
  const sources = { question: c.question, 'querent-reflection': c.reflections,
    'card-reflection': c.cards.find(card => card.spreadIndex === context.spreadIndex)?.reflection,
    'recorded-fixture-context': c.recordedContext?.reflectionsText };
  return typeof context.quote === 'string' && context.quote.length > 0
    && typeof sources[context.type] === 'string' && sources[context.type].includes(context.quote);
}
function targetKeys(targets) {
  return targets.flatMap(t => (Array.isArray(t.detailIds) && t.detailIds.length ? t.detailIds : [null])
    .map(id => `${t.spreadIndex}:${id ?? '@identity'}`)).sort();
}
function sameTargets(a, b) { return canonical(targetKeys(a)) === canonical(targetKeys(b)); }
function targetProblem(c, target) {
  if (!target || !Number.isInteger(target.spreadIndex)) return 'wrong-card';
  const card = c.cards.find(card => card.spreadIndex === target.spreadIndex);
  if (!card) return 'wrong-card';
  if (target.canonicalName && target.canonicalName !== card.canonicalName) return 'wrong-card';
  if (!Array.isArray(target.detailIds) || new Set(target.detailIds).size !== target.detailIds.length) return 'unsupported-detail';
  if (!target.detailIds.length) return null;
  if (c.deckStyle !== 'rws-1909' || c.artworkEdition !== EDITION || card.artwork?.edition !== EDITION) return 'non-rws-detail-leakage';
  const owned = getVectorGestureDetails(card.canonicalName).map(d => d.id);
  return target.detailIds.every(id => owned.includes(id)) ? null : 'unsupported-detail';
}

/** Read-only source resolution. Raw hashes are UTF-8; span offsets are UTF-16. */
export async function loadReadingCueCases({ root = DEFAULT_ROOT, manifest = DEFAULT_MANIFEST } = {}) {
  const data = typeof manifest === 'string'
    ? JSON.parse(await readFile(isAbsolute(manifest) ? manifest : sourcePath(root, manifest), 'utf8'))
    : structuredClone(manifest);
  const { manifestSha256, ...content } = data;
  if (manifestSha256 && sha(canonical(content)) !== manifestSha256) throw new Error('Manifest hash mismatch');
  const sources = new Map();
  for (const source of data.sourceDigests) {
    // Mutable review documents retain their frozen provenance hashes. Runtime
    // inputs, source fixtures, catalog/registry, and artwork remain byte-pinned.
    if (source.path.startsWith('docs/')) continue;
    const bytes = await readFile(sourcePath(root, source.path));
    if (sha(bytes) !== source.sha256) throw new Error(`Source file hash mismatch: ${source.path}`);
    sources.set(source.path, { bytes, sha256: source.sha256 });
  }
  const cases = [];
  for (const entry of data.cases) {
    const p = entry.provenance;
    const source = sources.get(p.sourcePath);
    if (!source || source.sha256 !== p.sourceFileSha256) throw new Error(`Unpinned source hash: ${entry.id}`);
    const raw = fieldValue(JSON.parse(source.bytes.toString('utf8')), p.sourceFieldPath);
    if (typeof raw !== 'string') throw new Error(`Missing exact raw source field: ${entry.id}`);
    for (const card of entry.cards) {
      if (!card.artwork) continue;
      if (sha(await readFile(sourcePath(root, card.artwork.assetPath))) !== card.artwork.assetSha256) {
        throw new Error(`Artwork hash mismatch: ${entry.id}`);
      }
    }
    cases.push({ ...entry, raw, labelProvenance: { reviewer: data.reviewer, labelRevision: data.labelRevision,
      status: data.status, complete: data.complete, manifestSha256, labelContentSha256: data.labelContentSha256 } });
  }
  validateReadingCueCases(cases, { requireVariantParents: true });
  return cases;
}

/** Reject source/ownership/anchor/dependency corruption before any inference. */
export function validateReadingCueCases(cases, { requireVariantParents = false } = {}) {
  const ids = new Set(); const families = new Map(); const opportunityIds = new Set();
  for (const c of cases) {
    if (ids.has(c.id)) throw new Error('Duplicate case ID'); ids.add(c.id);
    if (typeof c.raw !== 'string' || sha(c.raw) !== c.rawSha256) throw new Error(`Raw text hash mismatch: ${c.id}`);
    if (!PARTITIONS.includes(c.partition)) throw new Error(`Unknown partition: ${c.partition}`);
    if (families.has(c.familyId) && families.get(c.familyId) !== c.partition) throw new Error('Source family split across partitions');
    families.set(c.familyId, c.partition);
    if (new Set(c.cards.map(card => card.spreadIndex)).size !== c.cards.length) throw new Error('Duplicate spread occurrence');
    const opportunities = new Map(c.opportunities.map(o => [o.id, o]));
    for (const o of c.opportunities) {
      if (opportunityIds.has(o.id) || o.caseId !== c.id) throw new Error('Duplicate or crossing opportunity ID');
      opportunityIds.add(o.id);
      if (!KINDS.includes(o.kind)) throw new Error('Unknown opportunity category');
      if (!o.targets?.length || o.targets.some(t => targetProblem(c, t))) throw new Error('Invalid opportunity target ownership/edition');
      if (!o.anchors?.length || o.anchors.some(a => !exactSpan(c.raw, a))) throw new Error(`Invalid UTF-16 anchor: ${o.id}`);
      if (!contextValid(c, o.personalContext)) throw new Error(`Invalid opportunity context: ${o.id}`);
      for (const id of o.establishedByOpportunityIds) {
        const prior = opportunities.get(id);
        if (!prior || prior.kind !== 'literal' || Math.max(...prior.anchors.map(a => a.end)) > Math.min(...o.anchors.map(a => a.start))) {
          throw new Error(`Unresolved earlier literal dependency: ${o.id}`);
        }
        if (!targetKeys(prior.targets).every(key => targetKeys(o.targets).includes(key))) throw new Error('Dependency detail ownership mismatch');
      }
    }
    if (c.provenance.sourceKind === 'derived-context-variant') {
      const parent = cases.find(entry => entry.id === c.provenance.derivedFromCaseId);
      if ((requireVariantParents && !parent) || c.reflections !== null || (parent && (parent.familyId !== c.familyId
        || parent.raw !== c.raw || parent.question !== c.question || canonical(parent.cards) !== canonical(c.cards)))) {
        throw new Error('Invalid context variant provenance');
      }
    }
  }
  return true;
}

export function wilsonInterval(numerator, denominator) {
  if (!denominator) return null;
  if (numerator < 0 || numerator > denominator) throw new Error('Invalid proportion counts');
  const z = 1.959963984540054; const p = numerator / denominator; const divisor = 1 + z * z / denominator;
  const center = (p + z * z / (2 * denominator)) / divisor;
  const half = z * Math.sqrt(p * (1 - p) / denominator + z * z / (4 * denominator * denominator)) / divisor;
  return { lower: Math.max(0, center - half), upper: Math.min(1, center + half) };
}
function proportion(numerator, denominator) {
  return { numerator, denominator, value: denominator ? numerator / denominator : null,
    wilson95: wilsonInterval(numerator, denominator) };
}
function emptyCounts() {
  return { acceptedCues: 0, supportedCues: 0, emittedTargets: 0, supportedTargets: 0,
    requiredOpportunities: 0, matchedRequiredOpportunities: 0, matchedOpportunities: 0, extras: 0, structuralFailures: 0 };
}
function finishCounts(c) {
  return { ...c, cuePrecision: proportion(c.supportedCues, c.acceptedCues),
    targetPrecision: proportion(c.supportedTargets, c.emittedTargets),
    requiredRecall: proportion(c.matchedRequiredOpportunities, c.requiredOpportunities) };
}
function maximumMatches(c, supported) {
  const cues = [...supported].sort((a, b) => a.passage.start - b.passage.start || a.passage.end - b.passage.end || a.id.localeCompare(b.id));
  const candidates = cues.map(q => c.opportunities.filter(o => q.kind === o.kind && sameTargets(q.targets, o.targets)
    && canonical(q.personalContext ?? null) === canonical(o.personalContext)
    && o.anchors.some(a => q.passage.start >= a.start && q.passage.end <= a.end))
    .sort((a, b) => a.id.localeCompare(b.id)));
  let best = []; let bestKey = null;
  const assigned = new Map();
  function visit(index) {
    if (assigned.size + cues.length - index < best.length) return;
    if (index === cues.length) {
      const result = [...assigned.entries()].map(([opportunityId, cueId]) => ({ caseId: c.id, opportunityId, cueId }))
        .sort((a, b) => a.opportunityId.localeCompare(b.opportunityId) || a.cueId.localeCompare(b.cueId));
      const key = canonical(result);
      if (result.length > best.length || (result.length === best.length && (bestKey === null || key < bestKey))) { best = result; bestKey = key; }
      return;
    }
    const q = cues[index];
    for (const o of candidates[index]) {
      if (assigned.has(o.id)) continue;
      const expected = o.establishedByOpportunityIds.map(id => assigned.get(id));
      if (expected.some(id => !id) || canonical([...expected].sort()) !== canonical([...(q.establishedBy || [])].sort())) continue;
      assigned.set(o.id, q.id); visit(index + 1);
      assigned.delete(o.id);
    }
    visit(index + 1);
  }
  visit(0); return best;
}

function scoreTrial({ cases, ledgers, reviews, reviewer }) {
  const hardFailures = []; const semanticFailures = []; const incompleteReasons = []; const matches = []; const extras = [];
  const counts = emptyCounts(); const byKind = Object.fromEntries([...KINDS, 'context'].map(k => [k, emptyCounts()]));
  const byPartition = {}; const byLanguage = {}; const byEdition = {}; const byCase = {};
  const fail = (code, caseId, cueId = null) => hardFailures.push({ code, caseId, cueId });
  const missing = reason => incompleteReasons.push(reason);
  if (!reviewer?.id || reviewer.authoredVisualPrompt !== false || reviewer.testedModel !== false || reviewer.blinded !== true) missing('Independent blinded reviewer required');
  for (const ledger of ledgers) if (!cases.some(c => c.id === ledger.caseId)) fail('source-ownership-crossing', ledger.caseId);
  for (const c of cases) {
    const groups = [counts, byPartition[c.partition] ||= emptyCounts(), byLanguage[c.language] ||= emptyCounts(),
      byEdition[c.artworkEdition || 'identity-only'] ||= emptyCounts(), byCase[c.id] ||= emptyCounts()];
    const label = c.labelProvenance;
    if (!c.reviewComplete || c.unresolvedDecisions?.length || (label && (!label.complete || label.status !== 'frozen-before-inference'
      || label.reviewer?.authoredVisualPrompt !== false || label.reviewer?.accessedCandidateOutputs !== false))) missing(`Incomplete independent labels: ${c.id}`);
    for (const o of c.opportunities) if (o.required) {
      for (const group of [...groups, byKind[o.kind], ...(o.personalContext ? [byKind.context] : [])]) group.requiredOpportunities++;
    }
    const entries = ledgers.filter(l => l.caseId === c.id);
    if (!entries.length) missing(`Missing case ledger: ${c.id}`);
    const unique = new Map(); const rejected = new Set();
    for (const entry of entries) {
      const ledger = entry.ledger || entry;
      if (ledger.raw !== c.raw) fail('prose-mutation', c.id);
      for (const q of ledger.cues || []) {
        if (unique.has(q.id) && canonical(unique.get(q.id)) !== canonical(q)) fail('duplicate-cue-conflict', c.id, q.id);
        else unique.set(q.id, q);
      }
      for (const [index, receipt] of (ledger.receipts || []).entries()) {
        for (const [at, rejection] of (receipt.rejected || []).entries()) rejected.add(`${receipt.batchId ?? index}:${at}:${canonical(rejection)}`);
      }
      for (const [index, rejection] of (entry.rejected || []).entries()) rejected.add(`direct:${index}:${canonical(rejection)}`);
    }
    for (const group of groups) group.structuralFailures += rejected.size;
    const supported = [];
    for (const q of unique.values()) {
      const cueGroups = [...groups, ...(byKind[q.kind] ? [byKind[q.kind]] : []), ...(q.personalContext ? [byKind.context] : [])];
      for (const group of cueGroups) group.acceptedCues++;
      let valid = true;
      if (!q.id || !KINDS.includes(q.kind)) { missing(`Unknown cue identity/category: ${c.id}/${q.id}`); valid = false; }
      if (!exactSpan(c.raw, q.passage)) { fail('source-ownership-crossing', c.id, q.id); valid = false; }
      if (!contextValid(c, q.personalContext)) { fail('fabricated-context', c.id, q.id); valid = false; }
      if (!q.targets?.length) { missing(`Missing cue targets: ${c.id}/${q.id}`); valid = false; }
      const targets = q.targets || [];
      for (const t of targets) { const problem = targetProblem(c, t); if (problem) { fail(problem, c.id, q.id); valid = false; } }
      const known = c.opportunities.filter(o => o.kind === q.kind && o.anchors.some(anchor =>
        q.passage?.start >= anchor.start && q.passage?.end <= anchor.end));
      if (known.length && targets.some(t => known.every(o => !o.targets.some(target => target.spreadIndex === t.spreadIndex)))) {
        fail('wrong-card', c.id, q.id); valid = false;
      }
      for (const id of q.establishedBy || []) {
        const prior = unique.get(id);
        if (!prior || prior.kind !== 'literal' || prior.passage.end > q.passage.start
          || !targetKeys(prior.targets).every(key => targetKeys(targets).includes(key))) {
          fail('invalid-dependency', c.id, q.id); valid = false;
        }
      }
      if (c.regressionPolarity === 'negative' && q.kind === 'literal' && targets.some(t => t.detailIds.length)) { fail('negative-trap', c.id, q.id); valid = false; }
      const keys = targetKeys(targets); for (const group of cueGroups) group.emittedTargets += keys.length;
      const adjudication = reviews.filter(a => a.caseId === c.id && a.cueId === q.id);
      if (adjudication.length !== 1) { missing(`Missing or duplicate adjudication: ${c.id}/${q.id}`); continue; }
      const a = adjudication[0];
      if (!['supported', 'incorrect', 'uncertain'].includes(a.verdict) || a.verdict === 'uncertain'
        || typeof a.spanAdequate !== 'boolean' || typeof a.contextSupported !== 'boolean' || !a.rationale?.trim()) {
        missing(`Unresolved cue review: ${c.id}/${q.id}`); valid = false;
      }
      const targetReviews = a.targetVerdicts || [];
      const reviewKeys = targetReviews.map(t => `${t.spreadIndex}:${t.detailId ?? '@identity'}`).sort();
      if (canonical(reviewKeys) !== canonical(keys)) { missing(`Incomplete target review: ${c.id}/${q.id}`); valid = false; }
      for (const t of targetReviews) {
        if (!['supported', 'incorrect', 'uncertain'].includes(t.verdict) || t.verdict === 'uncertain') { missing(`Unresolved target review: ${c.id}/${q.id}`); valid = false; }
        if (t.verdict === 'incorrect') {
          semanticFailures.push({ code: 'incorrect-target', caseId: c.id, cueId: q.id,
            spreadIndex: t.spreadIndex, detailId: t.detailId ?? null });
          valid = false;
        }
      }
      if (a.verdict === 'incorrect') { semanticFailures.push({ code: 'unsupported-association', caseId: c.id, cueId: q.id }); valid = false; }
      if (q.personalContext && !a.contextSupported) { fail('fabricated-context-relevance', c.id, q.id); valid = false; }
      if (a.spanAdequate === false) semanticFailures.push({ code: 'inadequate-span', caseId: c.id, cueId: q.id });
      if (!a.spanAdequate || (q.personalContext && !a.contextSupported)) valid = false;
      const sourceValid = exactSpan(c.raw, q.passage);
      const targetReviewComplete = canonical(reviewKeys) === canonical(keys);
      const supportedTargetCount = sourceValid && targetReviewComplete ? targetReviews.filter(t => t.verdict === 'supported'
        && !targetProblem(c, targets.find(target => target.spreadIndex === t.spreadIndex
          && (t.detailId === null || target.detailIds.includes(t.detailId))))).length : 0;
      for (const group of cueGroups) group.supportedTargets += supportedTargetCount;
      if (valid && a.verdict === 'supported') {
        supported.push(q); for (const group of cueGroups) group.supportedCues++;
      }
    }
    const caseMatches = maximumMatches(c, supported); matches.push(...caseMatches);
    for (const m of caseMatches) {
      const o = c.opportunities.find(o => o.id === m.opportunityId);
      for (const group of [...groups, byKind[o.kind], ...(o.personalContext ? [byKind.context] : [])]) {
        group.matchedOpportunities++; if (o.required) group.matchedRequiredOpportunities++;
      }
    }
    for (const q of supported.filter(q => !caseMatches.some(m => m.cueId === q.id))) {
      extras.push({ caseId: c.id, cueId: q.id });
      for (const group of [...groups, byKind[q.kind], ...(q.personalContext ? [byKind.context] : [])]) group.extras++;
    }
  }
  const finishGroups = groups => Object.fromEntries(Object.entries(groups).map(([key, count]) => [key, finishCounts(count)]));
  return { counts: finishCounts(counts), byKind: finishGroups(byKind), byPartition: finishGroups(byPartition),
    byLanguage: finishGroups(byLanguage), byEdition: finishGroups(byEdition), byCase: finishGroups(byCase),
    hardFailures, semanticFailures, incompleteReasons, matches, extras };
}

function mergeCounts(rows) {
  const result = emptyCounts();
  for (const row of rows) for (const key of Object.keys(result)) result[key] += row[key];
  return finishCounts(result);
}
function gateQuality(counts) {
  return counts.cuePrecision.value >= .95 && counts.targetPrecision.value >= .95 && counts.requiredRecall.value >= .80
    && counts.cuePrecision.value !== null && counts.targetPrecision.value !== null && counts.requiredRecall.value !== null;
}

/**
 * Independent repeats use trialId (runId alias); reconnects share that ID.
 * Adjudication target identity is detailId:null. Every emitted target is reviewed.
 * Semantic gates only: browser/continuity/accounting gates belong to the runner.
 */
export function scoreReadingCueRun({ cases, ledgers = [], adjudications = {}, gates = {}, expectedTrials }) {
  if ((gates.precisionThreshold !== undefined && gates.precisionThreshold !== .95)
    || (gates.requiredRecallThreshold !== undefined && gates.requiredRecallThreshold !== .80)) throw new Error('Cannot change predeclared qualification thresholds');
  validateReadingCueCases(cases);
  const trialOf = entry => entry.trialId ?? entry.runId ?? 'default';
  const observedTrials = [...new Set(ledgers.map(trialOf))]; if (!observedTrials.length) observedTrials.push('default');
  const plan = expectedTrials ?? observedTrials.map(trialId => ({ trialId, caseIds: cases.map(c => c.id) }));
  const caseIds = new Set(cases.map(c => c.id));
  if (!plan.length || new Set(plan.map(trialOf)).size !== plan.length || plan.some(t => !Array.isArray(t.caseIds)
    || !t.caseIds.length || new Set(t.caseIds).size !== t.caseIds.length || t.caseIds.some(id => !caseIds.has(id)))) {
    throw new Error('Invalid expected case-by-trial plan');
  }
  const trialIds = plan.map(trialOf);
  const trialCases = plan.map(t => t.caseIds.map(id => cases.find(c => c.id === id)));
  const byTrial = Object.fromEntries(trialIds.map((trialId, index) => [trialId, scoreTrial({ cases: trialCases[index],
    ledgers: ledgers.filter(l => trialOf(l) === trialId),
    reviews: (adjudications.cues || []).filter(a => trialOf(a) === trialId), reviewer: adjudications.reviewer })]));
  const trials = Object.values(byTrial);
  const counts = mergeCounts(trials.map(t => t.counts));
  counts.completeRecordedReadings = new Set(cases.filter(c => c.provenance.sourceKind === 'recorded-reading'
    && c.independentReading !== false && !c.contextVariant).map(c => c.familyId)).size;
  counts.independentReadings = counts.completeRecordedReadings;
  counts.sourceFamilies = new Set(cases.map(c => c.familyId)).size;
  counts.primaryCases = cases.filter(c => ['recorded-reading', 'recorded-excerpt'].includes(c.provenance.sourceKind)).length;
  counts.caseEvaluations = trialCases.reduce((total, selected) => total + selected.length, 0);
  const groups = key => Object.fromEntries([...new Set(trials.flatMap(t => Object.keys(t[key])))].map(name =>
    [name, mergeCounts(trials.flatMap(t => t[key][name] ? [t[key][name]] : []))]));
  const byKind = groups('byKind'); const byPartition = groups('byPartition'); const byLanguage = groups('byLanguage');
  const hardFailures = trials.flatMap((t, i) => t.hardFailures.map(f => ({ ...f, trialId: trialIds[i] })));
  const semanticFailures = trials.flatMap((t, i) => t.semanticFailures.map(f => ({ ...f, trialId: trialIds[i] })));
  const incompleteReasons = trials.flatMap((t, i) => t.incompleteReasons.map(reason => `${trialIds[i]}: ${reason}`));
  for (const id of caseIds) if (!plan.some(t => t.caseIds.includes(id))) incompleteReasons.push(`Case absent from expected trial plan: ${id}`);
  for (const entry of ledgers) if (!trialIds.includes(trialOf(entry))) {
    hardFailures.push({ code: 'unplanned-trial', trialId: trialOf(entry), caseId: entry.caseId });
    incompleteReasons.push(`Unplanned trial ledger: ${trialOf(entry)}/${entry.caseId}`);
  }
  const reservedCases = cases.filter(c => c.partition === 'reserved-regression' && c.language === 'en' && c.artworkEdition === EDITION);
  const reserved = mergeCounts(trials.flatMap(t => reservedCases.flatMap(c => t.byCase[c.id] ? [t.byCase[c.id]] : [])));
  const centralIds = ['star-2347-excerpt', 'five-card-creative-project'];
  const centralMissing = trials.flatMap((t, index) => centralIds.flatMap(id => {
    if (cases.some(c => c.id === id) && !plan[index].caseIds.includes(id)) return [];
    const c = trialCases[index].find(c => c.id === id);
    return c ? c.opportunities.filter(o => o.required && !t.matches.some(m => m.opportunityId === o.id))
      .map(o => ({ trialId: trialIds[index], caseId: id, opportunityId: o.id })) : [{ trialId: trialIds[index], caseId: id, reason: 'missing-central-case' }];
  }));
  const trapCases = cases.filter(c => c.regressionPolarity === 'negative');
  const semanticGates = {
    integrity: { passed: hardFailures.length === 0, failures: hardFailures },
    traps: { passed: trapCases.length === 22 && !hardFailures.some(f => f.code === 'negative-trap'), cases: trapCases.length },
    overall: { passed: gateQuality(counts), counts },
    reservedRwsEnglish: { passed: gateQuality(reserved), counts: reserved, caseIds: reservedCases.map(c => c.id) },
    central: { passed: centralMissing.length === 0, missing: centralMissing },
    categories: { passed: KINDS.every(k => byKind[k].requiredOpportunities > 0),
      unqualified: KINDS.filter(k => byKind[k].requiredOpportunities === 0) },
    context: { passed: !hardFailures.some(f => f.code.startsWith('fabricated-context'))
      && cases.filter(c => c.contextVariant === 'question-only').length === 2 }
  };
  const incomplete = incompleteReasons.length > 0;
  const spanish = byLanguage.es;
  return { counts, byKind, byPartition, byLanguage, byEdition: groups('byEdition'), byTrial,
    reservedRwsEnglish: reserved, hardFailures, semanticFailures, incomplete, incompleteReasons, gates: semanticGates,
    adjudications: structuredClone(adjudications),
    expectedTrials: structuredClone(plan),
    semanticPassed: !incomplete && Object.values(semanticGates).every(g => g.passed),
    spanishSupport: spanish && gateQuality(spanish) && !incomplete ? 'detail-qualified' : 'identity-only',
    matches: trials.flatMap((t, i) => t.matches.map(m => ({ ...m, trialId: trialIds[i] }))),
    extras: trials.flatMap((t, i) => t.extras.map(e => ({ ...e, trialId: trialIds[i] }))),
    variability: Object.fromEntries(['requiredRecall', 'cuePrecision', 'targetPrecision'].map(key => {
      const values = trials.map(t => t.counts[key].value).filter(v => v !== null);
      return [key, { values: trials.map(t => t.counts[key].value), min: values.length ? Math.min(...values) : null,
        max: values.length ? Math.max(...values) : null }];
    })) };
}

/** fullyQualified attests all relevant gates, including browser and accounting. */
export function rankReadingCueCandidates(candidates, candidateOrder = candidates.map(c => c.id)) {
  const value = (candidate, key) => candidate.score?.counts?.[key]?.value;
  return candidates.filter(c => c.fullyQualified === true && candidateOrder.includes(c.id) && ['requiredRecall', 'cuePrecision', 'targetPrecision']
    .every(key => Number.isFinite(value(c, key))) && Number.isFinite(c.receiptLagP95Ms) && Number.isFinite(c.estimatedCost))
    .sort((a, b) => value(b, 'requiredRecall') - value(a, 'requiredRecall') || value(b, 'cuePrecision') - value(a, 'cuePrecision')
      || value(b, 'targetPrecision') - value(a, 'targetPrecision') || a.receiptLagP95Ms - b.receiptLagP95Ms
      || a.estimatedCost - b.estimatedCost || candidateOrder.indexOf(a.id) - candidateOrder.indexOf(b.id));
}
