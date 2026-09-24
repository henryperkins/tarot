/**
 * Journal tools (spec §6.4–6.5): save_reading_to_journal and
 * add_reflection_to_journal_entry. Both write only on an explicit request,
 * and both are idempotent, so a retry after an unclear failure is safe.
 */
import * as z from 'zod';

import { checkJournalAccess } from '../../journalAccess.js';
import { saveReadingJournalEntry } from '../../journalEntries.js';
import { addJournalReflection, MAX_REFLECTION_LENGTH } from '../../journalReflections.js';
import { getMcpJobSnapshot } from '../../readingJobs.js';
import { buildJournalEntryFromJob, buildJournalEntryFromPayload, JournalMappingError } from '../journalMapping.js';
import { anyOrientationSchema, deckStyleSchema, journalContextSchema, spreadKeySchema } from '../schemas.js';
import { WRITE, fail, ok, toolMeta } from './common.js';

const PAYLOAD_FIELDS = Object.freeze([
  'spread', 'spreadKey', 'question', 'cards', 'personalReading', 'themes',
  'provider', 'sessionSeed', 'requestId', 'deckId', 'userPreferences'
]);

const journalCardInput = z.object({
  position: z.string().trim().min(1),
  name: z.string().trim().min(1),
  orientation: anyOrientationSchema,
  number: z.number().int().optional(),
  suit: z.string().optional(),
  rank: z.string().optional(),
  rankValue: z.number().int().optional()
}).strict();

const saveInput = z.object({
  jobId: z.string().min(1).optional(),
  jobToken: z.string().min(1).optional(),
  context: journalContextSchema.optional(),
  spread: z.string().trim().min(1).optional(),
  spreadKey: spreadKeySchema.optional(),
  question: z.string().optional(),
  cards: z.array(journalCardInput).min(1).optional(),
  personalReading: z.string().optional(),
  themes: z.record(z.string(), z.unknown()).nullable().optional(),
  provider: z.string().optional(),
  sessionSeed: z.string().optional(),
  requestId: z.string().optional(),
  deckId: deckStyleSchema.optional(),
  userPreferences: z.record(z.string(), z.unknown()).nullable().optional()
}).strict();

const saveOutput = z.object({
  outcome: z.enum(['saved', 'already_saved']),
  entry: z.object({ id: z.string(), ts: z.number() }),
  deduplicated: z.boolean(),
  seedShared: z.boolean().optional()
});

const reflectInput = z.object({
  entryId: z.string().min(1),
  text: z.string().min(1).max(MAX_REFLECTION_LENGTH),
  scope: z.enum(['reading', 'card']),
  card: z.string().trim().min(1).optional(),
  position: z.string().trim().min(1).optional()
}).strict();

const reflectOutput = z.object({
  outcome: z.enum(['added', 'already_present']),
  entryId: z.string(),
  key: z.string(),
  target: z.object({
    scope: z.enum(['reading', 'card']),
    // Reusable deck label from addJournalReflection, not the stored canonical name.
    card: z.string().nullable().optional(),
    position: z.string().nullable().optional(),
    cardIndex: z.number().int().optional()
  }),
  text: z.string()
});

const EXPIRED_JOB =
  "Not saved: this reading's job has expired. Save it with the reading fields instead: spread, spreadKey, cards (name, position, orientation, and number or suit and rankValue, exactly as the reading returned them), personalReading (the complete narrative) and requestId.";

async function entryFromJob({ env, user, input }) {
  if (!input.jobId || !input.jobToken) {
    return { failure: fail('Not saved: send both jobId and jobToken from the reading.') };
  }
  const extras = PAYLOAD_FIELDS.filter((field) => input[field] !== undefined);
  if (extras.length) {
    return {
      failure: fail(`Not saved: send either jobId and jobToken, or the reading fields, not both (also sent: ${extras.join(', ')}).`)
    };
  }
  const job = await getMcpJobSnapshot({ env, jobId: input.jobId, jobToken: input.jobToken, userId: user.id });
  if (!job.ok) {
    if (job.status === 410) return { failure: fail(EXPIRED_JOB) };
    if (job.status === 404) return { failure: fail('Not saved: reading job not found.') };
    return { failure: fail(`Not saved: ${job.error || 'the reading service is unavailable.'}`) };
  }
  return { entry: buildJournalEntryFromJob(job.data, { context: input.context }) };
}

/**
 * @param {McpServer} server
 * @param {object} deps
 * @param {object} deps.env - Worker bindings (DB, READING_JOBS)
 * @param {object} deps.user - The resolved Tableu user
 * @param {Function} [deps.waitUntil]
 */
export function registerJournalTools(server, { env, user, waitUntil }) {
  server.registerTool(
    'save_reading_to_journal',
    {
      title: 'Save a reading to the Tableu journal',
      description:
        "Saves a finished Tableu reading to the user's journal. Call only when the user explicitly asks to save, journal, keep or remember the reading, or says yes right after you offer. Send the reading's jobId and jobToken; the server copies the narrative and cards exactly. Only if the job has expired, send the reading fields instead (spread, spreadKey, cards, personalReading, requestId). Retrying once after an unclear failure is safe. Keep the returned entry id for reflections.",
      inputSchema: saveInput,
      outputSchema: saveOutput,
      annotations: WRITE,
      _meta: toolMeta({ invoking: 'Saving to your journal…', invoked: 'Saved to your journal' })
    },
    async (input) => {
      const denied = checkJournalAccess(user);
      if (denied) return fail(`Not saved: ${denied.body.error}`);

      let entry;
      try {
        const usesJob = input.jobId !== undefined || input.jobToken !== undefined;
        if (usesJob) {
          const fromJob = await entryFromJob({ env, user, input });
          if (fromJob.failure) return fromJob.failure;
          entry = fromJob.entry;
        } else {
          entry = buildJournalEntryFromPayload(input);
        }
      } catch (error) {
        if (error instanceof JournalMappingError) return fail(`Not saved: ${error.message}`);
        throw error;
      }

      const result = await saveReadingJournalEntry({ env, user, entry, waitUntil });
      switch (result.outcome) {
        case 'saved':
          return ok(
            { outcome: 'saved', entry: result.entry, deduplicated: false, ...(result.seedShared ? { seedShared: true } : {}) },
            `Saved to the Tableu journal (entry ${result.entry.id}). Keep this entry id for reflections.${
              result.seedShared ? ' Another saved reading already uses this seed, so this entry was stored without it.' : ''
            }`
          );
        case 'already_saved':
          return ok(
            { outcome: 'already_saved', entry: result.entry, deduplicated: true },
            `This reading was already in the Tableu journal (entry ${result.entry.id}); nothing was changed.`
          );
        case 'conflict':
          return fail('Not saved: your journal already holds a different reading under this request ID.');
        case 'not_saved':
          return fail('Not saved: the journal write failed. Retrying once is safe.');
        default:
          return fail('Could not confirm whether the reading was saved. Check the Tableu app before trying again.');
      }
    }
  );

  server.registerTool(
    'add_reflection_to_journal_entry',
    {
      title: 'Add a reflection to a saved reading',
      description:
        "Attaches the user's own words to a reading saved earlier in this conversation. Call only when the user explicitly asks to save, attach or note what they said, or says yes right after you offer. Send their exact words, up to 2,000 characters; never summarize. Use scope \"reading\" for the whole spread, or scope \"card\" with the card name as the reading showed it (add the position when that card appears twice). The returned target.card is that same deck label and can be sent with target.position on a retry. Notes are added, never replaced, and the same note is never added twice, so retrying once after an unclear failure is safe.",
      inputSchema: reflectInput,
      outputSchema: reflectOutput,
      annotations: WRITE,
      _meta: toolMeta({ invoking: 'Adding your reflection…', invoked: 'Reflection added' })
    },
    async (input) => {
      const denied = checkJournalAccess(user);
      if (denied) return fail(`Not added: ${denied.body.error}`);
      if (input.scope === 'card' && !input.card) {
        return fail('Not added: name the card, as the reading showed it, when scope is card.');
      }

      const result = await addJournalReflection({
        env,
        user,
        entryId: input.entryId,
        policy: 'mcp',
        input: { text: input.text, scope: input.scope, card: input.card, position: input.position }
      });

      if (result.status === 200) {
        const { entryId, key, reflection, alreadyPresent } = result.body;
        // Task 6 returns the deck label, which this tool accepts on retries.
        const target = reflection.scope === 'card'
          ? { scope: 'card', card: reflection.card, position: reflection.position, cardIndex: reflection.cardIndex }
          : { scope: 'reading' };
        return ok(
          { outcome: alreadyPresent ? 'already_present' : 'added', entryId, key, target, text: reflection.text },
          alreadyPresent
            ? 'That note is already attached to this reading; nothing was added.'
            : 'Reflection added to the journal entry.'
        );
      }
      if (result.status === 404) return fail('Not added: no saved entry with that id was found for this account.');
      if (result.status === 409) return fail('Not added: the entry changed while saving. Retrying once is safe.');

      const cards = Array.isArray(result.body?.cards)
        ? ` Cards in this entry: ${result.body.cards.map((card) => `${card.position} — ${card.label || card.name}`).join('; ')}.`
        : '';
      const error = result.body?.error || 'invalid reflection.';
      return fail(`Not added: ${error}${cards && !error.endsWith('.') ? '.' : ''}${cards}`);
    }
  );
}
