import * as z from 'zod/v4';
import { BackendError, toolError } from './backend.js';

const spreadKey = z.enum(['single', 'threeCard', 'fiveCard', 'decision', 'relationship', 'celtic']);
const seedSchema = z.union([z.string().min(1), z.number().int().min(0).max(0xffffffff)]);
const contextSchema = z.enum(['love', 'career', 'self', 'spiritual', 'wellbeing', 'decision', 'general']);
const personalization = z.strictObject({
  displayName: z.string().optional(),
  readingTone: z.enum(['gentle', 'balanced', 'blunt']).optional(),
  spiritualFrame: z.enum(['psychological', 'spiritual', 'mixed', 'playful']).optional(),
  tarotExperience: z.enum(['newbie', 'intermediate', 'experienced']).optional(),
  preferredSpreadDepth: z.enum(['short', 'standard', 'deep']).optional(),
  focusAreas: z.array(z.string()).optional()
});
const drawSchema = z.strictObject({
  spreadInfo: z.strictObject({ name: z.string().min(1), key: spreadKey }),
  userQuestion: z.string().optional(), reflectionsText: z.string().optional(),
  reversalFrameworkOverride: z.string().optional(), deckStyle: z.string().optional(),
  allowReversals: z.boolean().optional(), seed: seedSchema.optional(),
  personalization: personalization.optional(),
  location: z.strictObject({
    latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
    timezone: z.string().optional(), accuracy: z.number().optional(),
    source: z.enum(['browser', 'manual']).optional()
  }).optional(),
  persistLocationToJournal: z.boolean().optional(), includePromptDebug: z.boolean().optional()
});
const saveSchema = z.strictObject({
  spread: z.string().min(1).describe('spreadInfo.name from the completed reading.'), spreadKey,
  question: z.string().optional().describe('Original userQuestion.'),
  cards: z.array(z.strictObject({
    position: z.string().min(1), name: z.string().min(1).describe('CardInfo.card, renamed to name; omit meaning.'),
    orientation: z.enum(['Upright', 'Reversed']), number: z.number().int().nullish(),
    suit: z.string().nullish(), rank: z.string().nullish(), rankValue: z.number().int().nullish(),
    canonicalName: z.string().optional().describe('Preserve the returned canonical card identity when the deck uses a different display name.'),
    canonicalKey: z.string().optional()
  })).min(1),
  personalReading: z.string().min(1).describe('The complete backend reading, verbatim. Never omit, summarize or rewrite.'),
  themes: z.record(z.string(), z.unknown()).nullable().optional(),
  context: contextSchema.optional(),
  provider: z.string().optional(), requestId: z.string().optional(),
  sessionSeed: seedSchema.optional().describe('Only the seed returned by this draw; numeric seeds are stored as strings. Omit for supplied-card jobs. requestId is not a seed.'),
  deckId: z.string().optional().describe('Original deckStyle.'),
  userPreferences: z.record(z.string(), z.unknown()).nullable().optional().describe('Original personalization.')
});

function normalizeSavePayload(input) {
  return {
    ...input,
    cards: input.cards.map(card => Object.fromEntries(Object.entries(card).filter(([, value]) => value != null))),
    ...(input.sessionSeed == null ? {} : { sessionSeed: String(input.sessionSeed) })
  };
}

function drawSavePayload(result, input) {
  const spread = result.spreadInfo || input.spreadInfo;
  const cards = result.cardsInfo.map(card => {
    const mapped = { name: card.card, position: card.position,
      orientation: card.orientation?.toLowerCase() === 'upright' ? 'Upright'
        : card.orientation?.toLowerCase() === 'reversed' ? 'Reversed' : card.orientation };
    for (const field of ['number', 'suit', 'rank', 'rankValue', 'canonicalName', 'canonicalKey']) {
      if (card[field] != null) mapped[field] = card[field];
    }
    return mapped;
  });
  const payload = saveSchema.safeParse({
    spread: spread.name, spreadKey: spread.key, cards, personalReading: result.reading,
    question: input.userQuestion, deckId: input.deckStyle, userPreferences: input.personalization,
    context: contextSchema.safeParse(result.context).data,
    themes: result.themes, provider: result.provider, requestId: result.requestId, sessionSeed: result.seed
  });
  if (!payload.success) throw new BackendError('The draw returned an invalid journal contract. Do not repeat the draw; check the Tableu app.', { outcome: 'unknown' });
  return normalizeSavePayload(payload.data);
}
const reflectionSchema = z.strictObject({
  id: z.string().min(1).describe('entry.id returned by a successful save in this conversation.'),
  text: z.string().min(1).max(2000).refine(text => Boolean(text.trim()), 'Reflection text is required'),
  scope: z.enum(['reading', 'card']), card: z.string().min(1).optional(), position: z.string().min(1).optional()
}).refine(input => input.scope !== 'card' || Boolean(input.card), 'Card scope requires the exact saved card name');

export function registerJournalTools(server, backend) {
  // Transport-session memory only, never a journal/history lookup. A restarted
  // session cannot invent an entry reference and must return to the app.
  const savedIds = new Set();
  const annotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
  const register = (name, description, inputSchema, handler) => server.registerTool(name, {
    description, inputSchema, annotations
  }, async input => {
    try {
      const result = await handler(input);
      return { structuredContent: result, content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (error) { return toolError(error); }
  });

  register('drawTarotReading',
    'Draw real cards and generate one backend reading. May consume quota. Do not invent cards or retry an uncertain draw. After explicit consent, pass the returned savePayload unchanged to saveReadingToJournal; it preserves the narrative, cards, canonical deck identities, seed and metadata.',
    drawSchema, async input => {
      const result = await backend.call('/api/tarot-reading/draw', { method: 'POST', body: JSON.stringify(input) });
      if (!result?.reading || !Array.isArray(result.cardsInfo) || !result.cardsInfo.length || !result.provider || !result.requestId) {
        throw new BackendError('The draw result could not be confirmed. Do not retry; check the Tableu app.', { outcome: 'unknown' });
      }
      return { ...result, savePayload: drawSavePayload(result, input) };
    });

  register('saveReadingToJournal',
    'Save only with explicit user consent. For a draw pass its savePayload unchanged. Otherwise preserve the complete narrative and all cards in order: card -> name, capitalize orientation, omit meaning/null metadata and preserve canonicalName/canonicalKey when provided. Carry spreadInfo.name/key, userQuestion, deckStyle, personalization, themes, provider and requestId into journal fields. Use only a returned draw seed; omit sessionSeed for supplied-card readings. A deduplicated result preserves the original entry unchanged. Reuse its entry.id. Never retry an uncertain save; check the app.',
    saveSchema, async input => {
      const result = await backend.call('/api/journal', { method: 'POST', body: JSON.stringify(normalizeSavePayload(input)) });
      if (result?.success !== true || typeof result.entry?.id !== 'string' || !result.entry.id) {
        throw new BackendError('The save could not be confirmed. Do not retry; check the Tableu app.', { outcome: 'unknown' });
      }
      savedIds.add(result.entry.id);
      return result;
    });

  register('addReflectionToJournalEntry',
    'Append only after explicit consent to attach the user\'s exact words (1–2000 characters, no trimming or summary). Requires entry.id returned by a save in this conversation. For card scope use the exact saved name and position when repeated. Never guess an entry or retry an uncertain append; check the app.',
    reflectionSchema, async ({ id, ...input }) => {
      if (!savedIds.has(id)) throw new BackendError('Save this reading first or check the Tableu app; this session has no confirmed saved entry with that id.');
      const result = await backend.call(`/api/journal/${encodeURIComponent(id)}/reflections`, { method: 'POST', body: JSON.stringify(input) });
      if (result?.success !== true || result.entry?.id !== id) {
        throw new BackendError('The reflection could not be confirmed. Do not retry; check the Tableu app.', { outcome: 'unknown' });
      }
      return result;
    });
}
