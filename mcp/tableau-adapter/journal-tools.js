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
const coordinates = { latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) };
const drawSchema = z.strictObject({
  spreadInfo: z.strictObject({ name: z.string().min(1), key: spreadKey }),
  userQuestion: z.string().optional(), reflectionsText: z.string().optional(),
  reversalFrameworkOverride: z.string().optional(), deckStyle: z.string().optional(),
  allowReversals: z.boolean().optional(), seed: seedSchema.optional(),
  personalization: personalization.optional(),
  location: z.strictObject({
    ...coordinates,
    timezone: z.string().optional(), accuracy: z.number().optional(),
    source: z.enum(['browser', 'manual']).optional()
  }).optional(),
  persistLocationToJournal: z.boolean().optional(), includePromptDebug: z.boolean().optional()
});
const saveSchema = z.strictObject({
  spread: z.string().min(1).describe('spreadInfo.name from the completed reading.'), spreadKey,
  question: z.string().optional().describe('Original userQuestion.'),
  cards: z.array(z.strictObject({
    position: z.string().min(1),
    name: z.string().min(1).describe('The canonical card: CardInfo.canonicalName when present, else CardInfo.card. Omit meaning.'),
    displayName: z.string().min(1).optional().describe('CardInfo.card when the deck labels the card differently from name.'),
    orientation: z.enum(['Upright', 'Reversed']), number: z.number().int().nullish(),
    suit: z.string().nullish(), rank: z.string().nullish(), rankValue: z.number().int().nullish(),
    canonicalName: z.string().optional().describe('Preserve the returned canonical card identity.'),
    canonicalKey: z.string().optional()
  })).min(1),
  personalReading: z.string().min(1).describe('The complete backend reading, verbatim. Never omit, summarize or rewrite.'),
  themes: z.record(z.string(), z.unknown()).nullable().optional(),
  context: contextSchema.optional(),
  provider: z.string().optional(), requestId: z.string().optional(),
  sessionSeed: seedSchema.optional().describe('Only as prepared in a draw\'s savePayload; numeric seeds are stored as strings. Omit for supplied-card jobs.'),
  deckId: z.string().optional().describe('Original deckStyle, or rws-1909 when none was chosen.'),
  userPreferences: z.record(z.string(), z.unknown()).nullable().optional().describe('Original personalization.'),
  location: z.strictObject({ ...coordinates, timezone: z.string().nullable().optional() }).optional()
    .describe('Only when the user explicitly asked to keep their location with this reading.'),
  persistLocationConsent: z.literal(true).optional().describe('Required with location.')
}).refine(input => !input.location || input.persistLocationConsent === true, 'location requires persistLocationConsent: true');

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
    // Journal `name` is the canonical card, as in app saves: analytics, shared
    // views and stats all key on it. The deck's own label is kept for display.
    const name = card.canonicalName || card.card;
    const mapped = { name, position: card.position,
      orientation: card.orientation?.toLowerCase() === 'upright' ? 'Upright'
        : card.orientation?.toLowerCase() === 'reversed' ? 'Reversed' : card.orientation };
    if (card.card && card.card !== name) mapped.displayName = card.card;
    for (const field of ['number', 'suit', 'rank', 'rankValue', 'canonicalName', 'canonicalKey']) {
      if (card[field] != null) mapped[field] = card[field];
    }
    return mapped;
  });
  const payload = saveSchema.safeParse({
    spread: spread.name, spreadKey: spread.key, cards, personalReading: result.reading,
    question: input.userQuestion, userPreferences: input.personalization,
    // The backend draws with rws-1909 unless asked otherwise; record that deck.
    deckId: input.deckStyle?.trim() || 'rws-1909',
    context: contextSchema.safeParse(result.context).data,
    themes: result.themes, provider: result.provider, requestId: result.requestId,
    // A caller's seed hashes to the same value on every draw, so key dedupe on
    // this draw: repeated saves of it match, and a later draw never does.
    sessionSeed: result.seed == null ? undefined : `${result.seed}:${result.requestId}`,
    ...(input.persistLocationToJournal === true && input.location ? {
      location: { latitude: input.location.latitude, longitude: input.location.longitude, timezone: input.location.timezone ?? null },
      persistLocationConsent: true
    } : {})
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
    'Draw real cards and generate one backend reading. May consume quota. Do not invent cards or retry an uncertain draw. After explicit consent, pass the returned savePayload unchanged to saveReadingToJournal; it preserves the narrative, cards, canonical deck identities, seed and metadata. If gateReason is crisis_gate, share only its support message.',
    drawSchema, async input => {
      const result = await backend.call('/api/tarot-reading/draw', { method: 'POST', body: JSON.stringify(input) });
      // Crisis support replaces the reading: never show, interpret or save cards for it.
      if (result?.gateReason === 'crisis_gate' || result?.provider === 'safety-gate') {
        return { gateBlocked: true, gateReason: 'crisis_gate', reading: result.reading, provider: result.provider,
          requestId: result.requestId, savePayload: null,
          guidance: 'Share this support message with care. Do not draw, show or interpret cards, and do not save it as a reading.' };
      }
      if (!result?.reading || !Array.isArray(result.cardsInfo) || !result.cardsInfo.length || !result.provider || !result.requestId) {
        throw new BackendError('The draw result could not be confirmed. Do not retry; check the Tableu app.', { outcome: 'unknown' });
      }
      // The draw already consumed quota and is not in the journal yet: never
      // lose the reading because its journal payload could not be prepared.
      try {
        return { ...result, savePayload: drawSavePayload(result, input) };
      } catch {
        return { ...result, savePayload: null,
          savePayloadError: 'This reading could not be prepared for the journal. Show it to the user; do not repeat the draw.' };
      }
    });

  register('saveReadingToJournal',
    'Save only with explicit user consent. For a draw pass its savePayload unchanged. Otherwise preserve the complete narrative and all cards in order: use canonicalName (else card) as name and a different card label as displayName, capitalize orientation, omit meaning/null metadata and preserve canonicalName/canonicalKey when provided. Carry spreadInfo.name/key, userQuestion, deckStyle, personalization, themes, provider and requestId into journal fields. Use only a returned draw seed; omit sessionSeed for supplied-card readings. A deduplicated result preserves the original entry unchanged. Reuse its entry.id. Never retry an uncertain save; check the app.',
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
