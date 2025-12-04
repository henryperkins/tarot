import { z } from 'zod';

const trimmedString = (label) =>
  z
    .string({
      required_error: `${label || 'Value'} is required`,
      invalid_type_error: `${label || 'Value'} must be a string`
    })
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, `${label || 'Value'} is required`);

const orientationSchema = z.enum(['Upright', 'Reversed'], {
  errorMap: () => ({ message: 'orientation must be "Upright" or "Reversed"' })
});

const optionalNumber = () => z.number().int().optional().nullable();

const optionalCleanString = () =>
  z.preprocess((value) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().optional());

export const cardInfoSchema = z
  .object({
    position: trimmedString('position'),
    card: trimmedString('card name'),
    canonicalName: z.string().min(1).optional().nullable(),
    canonicalKey: z.string().min(1).optional().nullable(),
    aliases: z.array(z.string().min(1)).optional().default([]),
    orientation: orientationSchema,
    meaning: trimmedString('meaning'),
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
      }, z.string().min(1).nullable()),
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
    displayName: z.string().trim().max(50).optional(),
    readingTone: z.enum(['gentle', 'balanced', 'blunt']).optional(),
    spiritualFrame: z.enum(['psychological', 'spiritual', 'mixed', 'playful']).optional(),
    tarotExperience: z.enum(['newbie', 'intermediate', 'experienced']).optional(),
    preferredSpreadDepth: z.enum(['short', 'standard', 'deep']).optional(),
    focusAreas: z.array(z.string().trim().min(1)).optional()
  })
  .catchall(z.unknown());

export const readingRequestSchema = z.object({
  spreadInfo: spreadInfoSchema,
  cardsInfo: z.array(cardInfoSchema).min(1, 'cardsInfo must include at least one card'),
  userQuestion: optionalCleanString(),
  reflectionsText: optionalCleanString(),
  reversalFrameworkOverride: optionalCleanString(),
  deckStyle: optionalCleanString(),
  visionProof: optionalVisionProofSchema.optional(),
  personalization: personalizationSchema.optional()
});

export const readingResponseSchema = z.object({
  reading: trimmedString('reading'),
  spreadAnalysis: z.record(z.any()).nullable().optional(),
  themes: z.record(z.any()).nullable().optional(),
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
