/** zod schemas shared by the MCP tools (spec §6). */
import * as z from 'zod';

import { DECK_CATALOG } from '../../../shared/vision/deckCatalog.js';
import { PERSONALIZATION_DISPLAY_NAME_MAX_LENGTH } from '../../../shared/contracts/personalizationConstants.js';
import { JOURNAL_CONTEXTS, SPREAD_KEYS } from './journalMapping.js';

export const spreadKeySchema = z.enum(SPREAD_KEYS);
export const deckStyleSchema = z.enum(Object.keys(DECK_CATALOG));
export const journalContextSchema = z.enum(JOURNAL_CONTEXTS);
export const orientationSchema = z.enum(['Upright', 'Reversed']);
export const anyOrientationSchema = z.enum(['upright', 'reversed', 'Upright', 'Reversed']);

/** The contract's Personalization object. */
export const personalizationSchema = z.object({
  displayName: z.string().trim().max(PERSONALIZATION_DISPLAY_NAME_MAX_LENGTH).optional(),
  readingTone: z.enum(['gentle', 'balanced', 'blunt']).optional(),
  spiritualFrame: z.enum(['psychological', 'spiritual', 'mixed', 'playful']).optional(),
  tarotExperience: z.enum(['newbie', 'intermediate', 'experienced']).optional(),
  preferredSpreadDepth: z.enum(['short', 'standard', 'deep']).optional(),
  focusAreas: z.array(z.string().trim().min(1)).optional()
}).strict();

export const spreadInfoOutputSchema = z.object({
  name: z.string(),
  key: spreadKeySchema
});

/** A card as the tools show it: deck label plus catalog metadata. */
export const publicCardSchema = z.object({
  position: z.string(),
  card: z.string(),
  orientation: orientationSchema,
  meaning: z.string().nullable(),
  number: z.number().int().nullable(),
  suit: z.string().nullable(),
  rank: z.string().nullable(),
  rankValue: z.number().int().nullable()
});
