import { compilePassageAnnotations } from '../contracts/generatedPassageAnnotations.js';
import {
  canonicalVisualCueJSON, hashVisualCueText, issuedVisualCueRequestSchema,
  sameVisualCueBinding, visualCueBindingSchema, visualCueProposalSchema, visualCueResponseSchema
} from '../contracts/visualCueBatches.js';

export function createVisualCueLedger(binding) {
  return { version: 1, binding: visualCueBindingSchema.parse(binding), ledgerRevision: 0,
    cues: [], introductions: [], receipts: [], raw: '', analyzedEnd: 0, analyzedHash: null };
}

function locate(raw, quote, occurrence) {
  const starts = [];
  for (let at = raw.indexOf(quote); at >= 0; at = raw.indexOf(quote, at + 1)) starts.push(at);
  if (occurrence === undefined && starts.length !== 1) return null;
  const start = starts[occurrence ?? 0];
  return start === undefined ? null : { start, end: start + quote.length, quote };
}

function asAnnotation(cue, raw) {
  let occurrence = 0;
  for (let at = raw.indexOf(cue.passage.quote); at >= 0 && at < cue.passage.start;
    at = raw.indexOf(cue.passage.quote, at + 1)) occurrence++;
  return { id: cue.id, kind: cue.kind, quote: cue.passage.quote, occurrence,
    targets: cue.targets.map(({ spreadIndex, detailIds }) => ({ spreadIndex, detailIds })),
    establishedBy: cue.establishedBy, ...(cue.personalContext ? { personalContext: cue.personalContext } : {}) };
}

function introductionsFor(cues, cards) {
  return cards.flatMap((card, index) => {
    const spreadIndex = card.index ?? index;
    const first = cues.find(cue => cue.targets.some(target => target.spreadIndex === spreadIndex));
    if (!first) return [];
    const literal = cues.find(cue => cue.kind === 'literal'
      && cue.targets.some(target => target.spreadIndex === spreadIndex));
    const namedEnd = first.kind === 'identity' ? first.passage.end : first.passage.start;
    const descriptionStart = Math.max(namedEnd, literal?.passage.start ?? namedEnd);
    const end = Math.max(descriptionStart, literal?.passage.end ?? namedEnd);
    return [{ spreadIndex, canonicalName: card.canonicalName || card.name || card.card,
      start: first.passage.start, namedEnd, descriptionStart, midpoint: Math.round((descriptionStart + end) / 2), end }];
  });
}

/**
 * Apply one model response to an application-owned cumulative ledger. The host
 * must retrieve issuedRequest from its own active request registry and serialize
 * this call with other commits. This pure utility neither authenticates a caller
 * nor persists state; commit the returned ledger before publishing it.
 */
export async function applyVisualCueBatch({ ledger, issuedRequest, response, authoritativeRaw, validationContext = {} }) {
  const unchanged = (code, message) => ({ ledger, addedCueIds: [], rejected: [{ code, message }], duplicate: false });
  const parsedRequest = issuedVisualCueRequestSchema.safeParse(issuedRequest);
  if (!parsedRequest.success) return unchanged('invalid-request', 'An active application-issued request is required');
  const request = parsedRequest.data;
  if (!sameVisualCueBinding(ledger.binding, request.binding)) return unchanged('binding-mismatch', 'Request belongs to another source binding');
  if (request.baseLedgerRevision > ledger.ledgerRevision) return unchanged('future-ledger', 'Request refers to an unavailable ledger revision');
  if (typeof authoritativeRaw !== 'string' || request.analyzedEnd > authoritativeRaw.length
    || !authoritativeRaw.startsWith(ledger.raw)) return unchanged('source-mismatch', 'Analyzed source is not an authoritative prefix');
  const analyzedRaw = authoritativeRaw.slice(0, request.analyzedEnd);
  if (await hashVisualCueText(analyzedRaw) !== request.analyzedHash) return unchanged('source-mismatch', 'Analyzed prefix hash does not match authoritative source');
  if (!Array.isArray(validationContext.cards)) return unchanged('invalid-context', 'The authoritative spread is required');

  let payloadDigest;
  try { payloadDigest = await hashVisualCueText(canonicalVisualCueJSON(response)); }
  catch { return unchanged('invalid-response', 'Response must be JSON serializable'); }
  const priorReceipt = ledger.receipts.find(receipt => receipt.batchId === request.batchId);
  if (priorReceipt) {
    if (priorReceipt.payloadDigest !== payloadDigest || priorReceipt.requestSequence !== request.requestSequence
      || priorReceipt.analyzedEnd !== request.analyzedEnd || priorReceipt.analyzedHash !== request.analyzedHash
      || priorReceipt.baseLedgerRevision !== request.baseLedgerRevision) {
      return unchanged('batch-conflict', 'Batch ID was already applied with another request or payload');
    }
    return { ledger, addedCueIds: [], rejected: priorReceipt.rejected, duplicate: true };
  }

  const rejected = [];
  const reject = (localAlias, code, message) => rejected.push({
    ...(typeof localAlias === 'string' ? { localAlias } : {}), code, message
  });
  const responseResult = visualCueResponseSchema.safeParse(response);
  const candidates = [];
  const proposals = responseResult.success ? responseResult.data.proposals : [];
  if (!responseResult.success) reject(null, 'invalid-response', 'Expected a proposal-only response');
  const aliasCounts = new Map();
  for (const proposal of proposals) if (typeof proposal?.localAlias === 'string') {
    aliasCounts.set(proposal.localAlias, (aliasCounts.get(proposal.localAlias) || 0) + 1);
  }
  for (const [proposalIndex, proposal] of proposals.entries()) {
    const parsed = visualCueProposalSchema.safeParse(proposal);
    if (!parsed.success) { reject(proposal?.localAlias, 'invalid-proposal', 'Proposal does not satisfy the visual cue contract'); continue; }
    const cue = parsed.data;
    if (aliasCounts.get(cue.localAlias) !== 1) { reject(cue.localAlias, 'duplicate-alias', 'Local aliases must be unique within a batch'); continue; }
    const passage = locate(analyzedRaw, cue.quote, cue.occurrence);
    if (!passage) { reject(cue.localAlias, 'invalid-quote', 'Quote is absent or ambiguous in the analyzed prefix'); continue; }
    const targets = cue.targets.map(target => {
      const card = validationContext.cards.find((card, index) => (card.index ?? index) === target.spreadIndex);
      return { spreadIndex: target.spreadIndex, canonicalName: card?.canonicalName || card?.name || card?.card || '',
        detailIds: [...new Set(target.detailIds)].sort() };
    }).sort((a, b) => a.spreadIndex - b.spreadIndex);
    const id = `vc:${await hashVisualCueText(canonicalVisualCueJSON({ binding: ledger.binding, passage, kind: cue.kind, targets }))}`;
    candidates.push({ ...cue, id, passage, targets, proposalIndex });
  }

  const accepted = [...ledger.cues];
  const byId = new Map(accepted.map(cue => [cue.id, cue]));
  const aliases = new Map();
  const addedCueIds = [];
  candidates.sort((a, b) => a.passage.start - b.passage.start || a.passage.end - b.passage.end || a.proposalIndex - b.proposalIndex);
  for (const candidate of candidates) {
    const references = (candidate.establishedBy || []).map(reference =>
      reference.acceptedCueId || aliases.get(reference.localAlias));
    const evidence = references.map(id => byId.get(id));
    if (evidence.some(cue => !cue || cue.kind !== 'literal' || cue.passage.end > candidate.passage.start
      || !cue.targets.some(prior => candidate.targets.some(target => target.spreadIndex === prior.spreadIndex
        && target.detailIds.some(detail => prior.detailIds.includes(detail)))))) {
      reject(candidate.localAlias, 'invalid-dependency', 'Every reference must be an earlier accepted literal of the same occurrence and detail'); continue;
    }
    const establishedBy = [...new Set(references)];
    // Equivalent cues keep their first immutable context, provenance and identity.
    if (byId.has(candidate.id)) { aliases.set(candidate.localAlias, candidate.id); continue; }
    if (accepted.some(prior => candidate.passage.start < prior.passage.end && candidate.passage.end > prior.passage.start)) {
      reject(candidate.localAlias, 'overlap', 'An accepted cue already occupies this passage'); continue;
    }
    // Compile each new cue with all of its literal evidence. This uses the same
    // quote/geometry/context checks as complete documents without imposing that
    // document's 240-item batch limit on the lifetime cumulative ledger.
    const compiled = compilePassageAnnotations({ version: 1, artworkEdition: ledger.binding.artworkEdition,
      raw: analyzedRaw, annotations: [...new Map(evidence.map(cue => [cue.id, cue])).values()]
        .map(cue => asAnnotation(cue, analyzedRaw)).concat(asAnnotation({ ...candidate, establishedBy }, analyzedRaw))
    }, { ...validationContext, artworkEdition: ledger.binding.artworkEdition });
    const association = compiled.payload?.associations.find(cue => cue.id === candidate.id);
    if (!association) { reject(candidate.localAlias, 'invalid-association', 'Unsupported targets or missing accepted literal grounding'); continue; }
    const cue = { ...association, establishedBy, provenance: { batchId: request.batchId,
      requestSequence: request.requestSequence, analyzedEnd: request.analyzedEnd, analyzedHash: request.analyzedHash } };
    accepted.push(cue);
    byId.set(cue.id, cue);
    aliases.set(candidate.localAlias, cue.id);
    addedCueIds.push(cue.id);
  }

  accepted.sort((a, b) => a.passage.start - b.passage.start || a.passage.end - b.passage.end || a.id.localeCompare(b.id));
  const receipt = { batchId: request.batchId, payloadDigest, requestSequence: request.requestSequence,
    baseLedgerRevision: request.baseLedgerRevision,
    analyzedEnd: request.analyzedEnd, analyzedHash: request.analyzedHash,
    aliases: Object.fromEntries(aliases), addedCueIds, rejected };
  return { ledger: { ...ledger, ledgerRevision: ledger.ledgerRevision + (addedCueIds.length ? 1 : 0),
    cues: accepted, introductions: introductionsFor(accepted, validationContext.cards), receipts: [...ledger.receipts, receipt],
    ...(request.analyzedEnd > ledger.analyzedEnd ? { raw: analyzedRaw, analyzedEnd: request.analyzedEnd, analyzedHash: request.analyzedHash } : {})
  }, addedCueIds, rejected, duplicate: false };
}
