/**
 * Production Passage Associations Contract
 *
 * Defines the canonical data contract, Zod schemas, and runtime invariants
 * for connecting arbitrary reading narrative passages with tarot card occurrences,
 * literal details, interpretations, and user reflections.
 *
 * Shared between Cloudflare Worker and React frontend.
 */
import { z } from 'zod';

export const PASSAGE_ASSOCIATION_KINDS = Object.freeze([
  'identity',
  'literal',
  'interpretation',
  'balance',
  'relationship'
]);

export const passageAssociationKindSchema = z.enum(PASSAGE_ASSOCIATION_KINDS, {
  errorMap: () => ({
    message: `kind must be one of: ${PASSAGE_ASSOCIATION_KINDS.join(', ')}`
  })
});

export const passageSpanSchema = z
  .object({
    start: z.number().int().nonnegative('start offset must be non-negative'),
    end: z.number().int().positive('end offset must be positive'),
    quote: z.string().min(1, 'quote must not be empty')
  })
  .refine((span) => span.end > span.start, {
    message: 'end offset must be strictly greater than start offset'
  });

export const passageTargetSchema = z.object({
  spreadIndex: z.number().int().nonnegative('spreadIndex must be non-negative'),
  canonicalName: z.string().min(1, 'canonicalName must be provided'),
  detailIds: z.array(z.string().min(1)).default([])
});

export const personalContextReferenceSchema = z.object({
  type: z.enum([
    'question',
    'card-reflection',
    'querent-reflection',
    'recorded-fixture-context'
  ]),
  spreadIndex: z.number().int().nonnegative().optional(),
  quote: z.string().min(1, 'personalContext quote must not be empty')
});

export const passageAssociationSchema = z.object({
  id: z.string().min(1, 'id is required'),
  label: z.string().min(1).optional(),
  kind: passageAssociationKindSchema,
  targets: z.array(passageTargetSchema).min(1, 'at least one target is required'),
  passage: passageSpanSchema,
  meaningRange: passageSpanSchema.optional(),
  personalContext: personalContextReferenceSchema.optional()
});

export const cardIntroductionSchema = z
  .object({
    spreadIndex: z.number().int().nonnegative('spreadIndex must be non-negative'),
    canonicalName: z.string().min(1, 'canonicalName must be provided'),
    start: z.number().int().nonnegative('start must be non-negative'),
    namedEnd: z.number().int().nonnegative('namedEnd must be non-negative'),
    descriptionStart: z.number().int().nonnegative('descriptionStart must be non-negative'),
    midpoint: z.number().int().nonnegative('midpoint must be non-negative'),
    end: z.number().int().nonnegative('end must be non-negative'),
    dynamic: z.boolean().optional(),
    pending: z.boolean().optional()
  })
  .refine(
    (intro) =>
      intro.start <= intro.namedEnd &&
      intro.namedEnd <= intro.descriptionStart &&
      intro.descriptionStart <= intro.midpoint &&
      intro.midpoint <= intro.end,
    {
      message:
        'Introduction boundaries must progress in order: start <= namedEnd <= descriptionStart <= midpoint <= end'
    }
  );

export const passageAssociationsPayloadSchema = z.object({
  artworkEdition: z.string().min(1).default('rws-immanuelle-vector'),
  expectedRaw: z.string().optional(),
  associations: z.array(passageAssociationSchema).default([]),
  introductions: z.array(cardIntroductionSchema).default([]),
  recordedContext: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional()
});

/**
 * Validate candidate associations before exposing them to the reading renderer.
 * The default source is a streaming prefix. `sourceComplete` additionally rejects
 * future ranges and requires exact equality when expectedRaw is declared.
 *
 * `cards` omitted means no spread identity check; an explicit empty array means
 * there are no valid targets. Supported geometry is checked independently.
 * Optional personal context is retained only when its exact quote occurs in its
 * declared source; an absent source never substantiates a personal claim.
 *
 * @param {unknown} payload
 * @param {Object} [options]
 * @param {string} [options.rawText] Full source or its current streaming prefix.
 * @param {boolean} [options.sourceComplete=false] Whether no more source may arrive.
 * @param {Array<Object>} [options.cards] Spread cards, identified by index or array position.
 * @param {string} [options.artworkEdition] Required artwork edition.
 * @param {Function} [options.getSupportedDetails] (canonicalName, artworkEdition) => detail IDs or objects.
 * @param {string} [options.userQuestion] Actual supplied question text.
 * @param {string} [options.reflections] Actual supplied general reflection text.
 * @returns {{valid: boolean, payload: Object|null, associations: Array<Object>, introductions: Array<Object>, errors: Array<Object>, droppedAssociationIds: Array<string>}}
 */
export function validatePassageAssociationsPayload(payload, options = {}) {
  const parseResult = passageAssociationsPayloadSchema.safeParse(payload);
  if (!parseResult.success) {
    return {
      valid: false,
      payload: null,
      associations: [],
      introductions: [],
      errors: parseResult.error.issues.map((issue) => ({
        field: issue.path.join('.'), message: issue.message
      })),
      droppedAssociationIds: []
    };
  }

  const data = parseResult.data;
  const {
    rawText, sourceComplete = false, cards, artworkEdition,
    getSupportedDetails, userQuestion, reflections
  } = options;
  const errors = [];
  const associations = [];
  const introductions = [];
  const droppedIds = new Set();
  const error = (field, message, id) => errors.push({ field, message, ...(id ? { id } : {}) });
  const rejectPayload = () => ({
    valid: false, payload: null, associations: [], introductions: [], errors,
    droppedAssociationIds: [...new Set(data.associations.map((association) => association.id))]
  });

  if (artworkEdition && data.artworkEdition !== artworkEdition) {
    error('artworkEdition', `artworkEdition mismatch: payload is "${data.artworkEdition}" but context requires "${artworkEdition}"`);
    return rejectPayload();
  }
  if (typeof data.expectedRaw === 'string' && typeof rawText === 'string'
    && (!data.expectedRaw.startsWith(rawText) || (sourceComplete && data.expectedRaw !== rawText))) {
    error('expectedRaw', 'rawText does not match payload expectedRaw');
    return rejectPayload();
  }

  const resolveCard = (spreadIndex) => Array.isArray(cards)
    ? cards.find((card, index) => (card?.index ?? index) === spreadIndex) : null;
  const checkTarget = (target, field, id) => {
    if (!Array.isArray(cards)) return true;
    const card = resolveCard(target.spreadIndex);
    if (!card) {
      error(field, `target spreadIndex ${target.spreadIndex} not found in spread cards`, id);
      return false;
    }
    const name = card.canonicalName || card.name || card.card;
    if (name !== target.canonicalName) {
      error(field, `canonicalName "${target.canonicalName}" does not match card name "${name || ''}" at index ${target.spreadIndex}`, id);
      return false;
    }
    return true;
  };

  // Expected text can validate future fixture geometry without making a future
  // passage available. Unknown future source must remain pending instead.
  const referenceText = typeof data.expectedRaw === 'string' ? data.expectedRaw : rawText;
  const referenceComplete = typeof data.expectedRaw === 'string' || sourceComplete;
  const checkRange = (range, field, id) => {
    if (range.end - range.start !== range.quote.length) {
      error(field, 'range length does not match its UTF-16 quote length', id);
      return false;
    }
    if (typeof referenceText !== 'string') return true;
    if (range.end > referenceText.length) {
      if (!referenceComplete) return true;
      error(field, 'range extends beyond complete source', id);
      return false;
    }
    if (referenceText.slice(range.start, range.end) !== range.quote) {
      error(field, 'passage quote mismatch with source range', id);
      return false;
    }
    return true;
  };

  // IDs are the identity of held inspection, so even a future collision makes
  // every cue sharing that ID ambiguous. Do this before availability filtering.
  const idCounts = new Map();
  for (const association of data.associations) idCounts.set(association.id, (idCounts.get(association.id) || 0) + 1);
  for (const [id, count] of idCounts) {
    if (count > 1) {
      droppedIds.add(id);
      error(`associations.${id}.id`, 'duplicate association ID', id);
    }
  }

  const claimedRanges = [];
  for (const association of data.associations) {
    const { id, passage, meaningRange, personalContext, ...rest } = association;
    if (droppedIds.has(id)) continue;
    const field = `associations.${id}`;
    const targetsValid = association.targets.every((target) => checkTarget(target, `${field}.targets`, id));
    if (!targetsValid || !checkRange(passage, `${field}.passage`, id)
      || (meaningRange && !checkRange(meaningRange, `${field}.meaningRange`, id))) {
      droppedIds.add(id);
      continue;
    }
    if (typeof rawText === 'string' && passage.end > rawText.length) continue;

    const targets = association.targets.map((target) => {
      let detailIds = association.kind === 'identity' ? [] : [...new Set(target.detailIds)];
      if (typeof getSupportedDetails === 'function') {
        const supported = new Set((getSupportedDetails(target.canonicalName, data.artworkEdition) || [])
          .map((detail) => typeof detail === 'string' ? detail : detail.id));
        if (detailIds.some((detail) => !supported.has(detail))) {
          error(`${field}.targets.${target.spreadIndex}.detailIds`, 'unsupported artwork details removed', id);
          detailIds = detailIds.filter((detail) => supported.has(detail));
        }
      }
      return { ...target, detailIds };
    });

    let validatedContext;
    if (personalContext) {
      let contextText;
      if (personalContext.type === 'question') contextText = userQuestion;
      else if (personalContext.type === 'card-reflection') {
        const card = resolveCard(personalContext.spreadIndex);
        contextText = card?.reflection || card?.userReflection;
      } else if (personalContext.type === 'querent-reflection') contextText = reflections;
      else if (personalContext.type === 'recorded-fixture-context') contextText = data.recordedContext?.reflectionsText;
      if (typeof contextText === 'string' && contextText.includes(personalContext.quote)) validatedContext = personalContext;
      else if (typeof contextText === 'string' && contextText.length > 0) {
        error(`${field}.personalContext`, 'personal context quote does not match supplied source; reference removed', id);
      }
    }

    if (claimedRanges.some((range) => passage.start < range.end && passage.end > range.start)) {
      error(`${field}.passage`, 'overlapping passage range with another association', id);
      droppedIds.add(id);
      continue;
    }
    claimedRanges.push(passage);
    const meaningAvailable = meaningRange && (typeof rawText !== 'string' || meaningRange.end <= rawText.length);
    associations.push({
      id, ...rest, targets, passage,
      ...(meaningAvailable ? { meaningRange } : {}),
      ...(validatedContext ? { personalContext: validatedContext } : {})
    });
  }

  for (const introduction of data.introductions) {
    const field = `introductions.${introduction.spreadIndex}`;
    if (!checkTarget(introduction, field)) continue;
    if (typeof referenceText === 'string' && referenceComplete && introduction.end > referenceText.length) {
      error(field, 'introduction extends beyond complete source');
      continue;
    }
    // Authored fixture schedules have already been checked against expectedRaw.
    // Open-ended streaming schedules become available once their start arrives.
    if (typeof data.expectedRaw !== 'string' && typeof rawText === 'string' && introduction.start > rawText.length) continue;
    introductions.push(introduction);
  }

  return {
    valid: errors.length === 0,
    payload: {
      artworkEdition: data.artworkEdition,
      ...(typeof data.expectedRaw === 'string' ? { expectedRaw: data.expectedRaw } : {}),
      associations,
      introductions,
      ...(data.recordedContext ? { recordedContext: data.recordedContext } : {}),
      ...(data.metadata ? { metadata: data.metadata } : {})
    },
    associations,
    introductions,
    errors,
    droppedAssociationIds: [...droppedIds]
  };
}
