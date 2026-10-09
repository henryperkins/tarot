import { z } from 'zod';
import { personalContextReferenceSchema, validatePassageAssociationsPayload } from './readingPassageAssociations.js';

export const generatedPassageAnnotationSchema = z.object({
  id: z.string().min(1).max(100),
  kind: z.enum(['identity', 'literal', 'interpretation', 'balance', 'relationship']),
  quote: z.string().min(1).max(1500),
  occurrence: z.number().int().nonnegative().optional(),
  targets: z.array(z.object({
    spreadIndex: z.number().int().nonnegative(),
    detailIds: z.array(z.string().min(1)).max(2)
  })).min(1).max(2),
  establishedBy: z.array(z.string().min(1)).max(8).optional(),
  personalContext: personalContextReferenceSchema.optional()
});

export const generatedPassageDocumentSchema = z.object({
  version: z.literal(1),
  artworkEdition: z.string().min(1),
  raw: z.string().min(1).max(120000),
  annotations: z.array(generatedPassageAnnotationSchema).max(240)
});

function locateQuote(raw, quote, occurrence) {
  const matches = [];
  for (let at = raw.indexOf(quote); at >= 0; at = raw.indexOf(quote, at + 1)) matches.push(at);
  if (occurrence === undefined && matches.length !== 1) return null;
  const start = matches[occurrence ?? 0];
  return start === undefined ? null : { start, end: start + quote.length, quote };
}

/**
 * Compile model-supplied, exact quotations into source-addressed associations.
 * No keywords infer meaning here. Every return must refer to an earlier literal
 * cue for the same occurrence and detail. This proves structural grounding,
 * not that a model's interpretation is psychologically true or appropriate.
 */
export function compilePassageAnnotations(document, options = {}) {
  const parsed = generatedPassageDocumentSchema.safeParse(document);
  if (!parsed.success) return { payload: null, errors: parsed.error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })) };
  const { raw, artworkEdition, annotations } = parsed.data;
  const errors = [];
  const reject = (id, message) => errors.push({ id, message });
  const ids = new Map();
  annotations.forEach(cue => ids.set(cue.id, (ids.get(cue.id) || 0) + 1));
  const candidates = [];
  for (const cue of annotations) {
    if (ids.get(cue.id) !== 1) { reject(cue.id, 'Duplicate annotation ID'); continue; }
    const passage = locateQuote(raw, cue.quote, cue.occurrence);
    if (!passage) { reject(cue.id, 'Quote is missing or ambiguous; specify occurrence for repeated text'); continue; }
    const targets = [];
    for (const target of cue.targets) {
      const card = options.cards?.find((card, index) => (card.index ?? index) === target.spreadIndex);
      const canonicalName = card?.canonicalName || card?.name || card?.card;
      const supported = new Set((options.getSupportedDetails?.(canonicalName, artworkEdition) || []).map(detail => typeof detail === 'string' ? detail : detail.id));
      const details = [...new Set(target.detailIds)];
      if (!canonicalName || (details.length && card.artworkEdition && card.artworkEdition !== artworkEdition)
        || details.some(id => !supported.has(id)) || (cue.kind === 'identity' && details.length)) break;
      targets.push({ spreadIndex: target.spreadIndex, canonicalName, detailIds: details });
    }
    if (targets.length !== cue.targets.length || new Set(targets.map(target => target.spreadIndex)).size !== targets.length) {
      reject(cue.id, 'Unknown/duplicate occurrence or unsupported artwork detail'); continue;
    }
    if (['literal', 'interpretation', 'balance'].includes(cue.kind) && targets.some(target => !target.detailIds.length)) {
      reject(cue.id, 'This association requires a supported detail for every target'); continue;
    }
    candidates.push({ ...cue, passage, targets });
  }

  const accepted = [];
  const established = new Map();
  for (const cue of candidates.sort((a, b) => a.passage.start - b.passage.start)) {
    if (accepted.some(prior => cue.passage.start < prior.passage.end)) { reject(cue.id, 'Overlapping annotation'); continue; }
    if (!['identity', 'literal'].includes(cue.kind)) {
      const evidence = (cue.establishedBy || []).map(id => established.get(id)).filter(Boolean);
      const supported = cue.targets.every(target => target.detailIds.every(id => evidence.some(prior =>
        prior.passage.end <= cue.passage.start && prior.targets.some(item => item.spreadIndex === target.spreadIndex && item.detailIds.includes(id)))));
      if (!supported) { reject(cue.id, 'A return requires an earlier accepted literal cue for each occurrence and detail'); continue; }
    }
    const { quote: _quote, occurrence: _occurrence, establishedBy: _references, ...association } = cue;
    accepted.push(association);
    if (cue.kind === 'literal') established.set(cue.id, cue);
  }

  const introductions = [];
  for (const card of options.cards || []) {
    const spreadIndex = card.index ?? options.cards.indexOf(card);
    const first = accepted.find(cue => cue.targets.some(target => target.spreadIndex === spreadIndex));
    if (!first) continue;
    const literal = accepted.find(cue => cue.kind === 'literal' && cue.targets.some(target => target.spreadIndex === spreadIndex));
    const namedEnd = first.kind === 'identity' ? first.passage.end : first.passage.start;
    const descriptionStart = Math.max(namedEnd, literal?.passage.start ?? namedEnd);
    const end = Math.max(descriptionStart, literal?.passage.end ?? namedEnd);
    introductions.push({ spreadIndex, canonicalName: card.canonicalName || card.name || card.card,
      start: first.passage.start, namedEnd, descriptionStart, midpoint: Math.round((descriptionStart + end) / 2), end });
  }
  const validated = validatePassageAssociationsPayload({ artworkEdition, expectedRaw: raw,
    associations: accepted, introductions, metadata: { source: 'generated-annotations', version: 1 } },
  { ...options, rawText: raw, sourceComplete: true });
  return { payload: validated.payload, errors: [...errors, ...validated.errors] };
}
