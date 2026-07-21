import { z } from 'zod';
import {
  PERSONALIZATION_DISPLAY_NAME_MAX_LENGTH,
  PERSONALIZATION_REQUEST_FIELDS,
  PERSONALIZATION_REQUEST_EXPLICIT_FIELDS_KEY
} from './personalizationConstants.js';

// Bounds keep a single request from inflating the response past the 100,000
// character ceiling GPT Actions enforces. These strings are counted twice: once
// echoed back in `cardsInfo`, and again inside the assembled prompt that
// promptDebug can return. Sized so the largest spread (10 cards) at every
// maximum still leaves ~30% headroom — see the end-to-end size test in
// tests/promptDebugHardening.test.mjs. Real values are far smaller: deck
// meanings run ~100 characters.
export const CARD_MEANING_MAX_LENGTH = 1000;
export const CARD_REFLECTION_MAX_LENGTH = 2000;
export const USER_QUESTION_MAX_LENGTH = 2000;
export const REFLECTIONS_TEXT_MAX_LENGTH = 5000;
// A reading cannot contain more cards than exist in the deck (78).
export const MAXIMUM_CARD_COUNT = 78;

const trimmedString = (label, maxLength = null) => {
  const base = z
    .string({
      required_error: `${label || 'Value'} is required`,
      invalid_type_error: `${label || 'Value'} must be a string`
    })
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, `${label || 'Value'} is required`);
  if (!maxLength) return base;
  return base.refine(
    (val) => val.length <= maxLength,
    `${label || 'Value'} must be at most ${maxLength} characters`
  );
};

const orientationSchema = z.enum(['Upright', 'Reversed'], {
  errorMap: () => ({ message: 'orientation must be "Upright" or "Reversed"' })
});

const optionalNumber = () => z.number().int().optional().nullable();

const optionalCleanString = (maxLength = null) =>
  z.preprocess((value) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, maxLength ? z.string().max(maxLength).optional() : z.string().optional());

export const cardInfoSchema = z
  .object({
    position: trimmedString('position'),
    card: trimmedString('card name'),
    canonicalName: z.string().min(1).optional().nullable(),
    canonicalKey: z.string().min(1).optional().nullable(),
    aliases: z.array(z.string().min(1)).optional().default([]),
    orientation: orientationSchema,
    meaning: trimmedString('meaning', CARD_MEANING_MAX_LENGTH),
    number: optionalNumber(),
    suit: z.string().min(1).optional().nullable(),
    rank: z.string().min(1).optional().nullable(),
    rankValue: optionalNumber(),
    userReflection: z
      .preprocess((value) => {
        if (value === null || value === undefined) return null;
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
      }, z.string().min(1).max(CARD_REFLECTION_MAX_LENGTH).nullable()),
    deckStyle: z.string().optional(),
    canonicalId: z.string().optional()
  })
  .catchall(z.unknown());

export const spreadInfoSchema = z
  .object({
    name: trimmedString('spread name'),
    key: z.string().trim().optional(),
    deckStyle: z.string().trim().optional()
  })
  .catchall(z.unknown());

const optionalVisionProofSchema = z
  .object({
    id: z.string().min(1),
    signature: z.string().min(1),
    createdAt: z.string().optional(),
    expiresAt: z.string().optional(),
    insights: z.array(z.unknown()).optional(),
    deckStyle: z.string().optional()
  })
  .catchall(z.unknown());

const personalizationSchema = z
  .object({
    displayName: z.string().trim().max(PERSONALIZATION_DISPLAY_NAME_MAX_LENGTH).optional(),
    readingTone: z.enum(['gentle', 'balanced', 'blunt']).optional(),
    spiritualFrame: z.enum(['psychological', 'spiritual', 'mixed', 'playful']).optional(),
    tarotExperience: z.enum(['newbie', 'intermediate', 'experienced']).optional(),
    preferredSpreadDepth: z.enum(['short', 'standard', 'deep']).optional(),
    focusAreas: z.array(z.string().trim().min(1)).optional(),
    [PERSONALIZATION_REQUEST_EXPLICIT_FIELDS_KEY]: z.array(z.enum(PERSONALIZATION_REQUEST_FIELDS)).optional()
  })
  .catchall(z.unknown());

const locationSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    timezone: z.string().min(1).max(64).optional(),
    accuracy: z.number().positive().optional(),
    source: z.enum(['browser', 'manual']).optional()
  })
  .strict()
  .optional();

export const readingRequestSchema = z.object({
  spreadInfo: spreadInfoSchema,
  cardsInfo: z
    .array(cardInfoSchema)
    .min(1, 'cardsInfo must include at least one card')
    .max(MAXIMUM_CARD_COUNT, `cardsInfo must not exceed the ${MAXIMUM_CARD_COUNT}-card deck`),
  userQuestion: optionalCleanString(USER_QUESTION_MAX_LENGTH),
  reflectionsText: optionalCleanString(REFLECTIONS_TEXT_MAX_LENGTH),
  reversalFrameworkOverride: optionalCleanString(),
  deckStyle: optionalCleanString(),
  visionProof: optionalVisionProofSchema.optional(),
  personalization: personalizationSchema.optional(),
  location: locationSchema,
  persistLocationToJournal: z.boolean().optional(),
  // Opt-in diagnostic flag: request the assembled system/user prompt back in
  // the response. Only honored for the trusted first-party service account and
  // when PROMPT_DEBUG_ENABLED is set (see resolvePromptDebugAccess in
  // functions/api/tarot-reading.js). Ignored otherwise.
  includePromptDebug: z.boolean().optional()
});

export const readingResponseSchema = z.object({
  reading: trimmedString('reading'),
  spreadAnalysis: z.record(z.any()).nullable().optional(),
  themes: z.record(z.any()).nullable().optional(),
  reasoning: z.record(z.any()).nullable().optional(),
  analysisContext: z.record(z.any()).nullable().optional(),
  visionInsights: z.array(z.any()).optional(),
  provider: z.string().optional(),
  requestId: z.string().optional()
}).catchall(z.unknown());

export function formatZodError(error) {
  if (!error?.issues?.length) return 'Invalid payload.';
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'payload'}: ${issue.message}`)
    .join('; ');
}

export function safeParseReadingRequest(payload) {
  const result = readingRequestSchema.safeParse(payload);
  if (!result.success) {
    return { success: false, error: formatZodError(result.error) };
  }
  return { success: true, data: result.data };
}

export const MINIMUM_CARD_COUNT = 1;
