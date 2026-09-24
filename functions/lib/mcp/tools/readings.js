/**
 * Reading tools (spec §6.1–6.3): draw_tarot_reading, start_tarot_reading,
 * get_tarot_reading_status, wait_for_tarot_reading and cancel_tarot_reading.
 *
 * Every call returns well inside ChatGPT's ~60 s tool limit: draws and
 * starts return at once, and waiting polls for at most 45 s.
 */
import * as z from 'zod';

import { ReadingCardResolutionError, resolveReadingCards } from '../../readingCardResolution.js';
import { cancelMcpJob, getMcpJobSnapshot, startReadingJob } from '../../readingJobs.js';
import { drawForSpread } from '../../serverDraw.js';
import { REFLECTIONS_TEXT_MAX_LENGTH, USER_QUESTION_MAX_LENGTH } from '../../../../shared/contracts/readingSchema.js';
import { toPublicCard } from '../journalMapping.js';
import {
  anyOrientationSchema,
  deckStyleSchema,
  personalizationSchema,
  publicCardSchema,
  spreadInfoOutputSchema,
  spreadKeySchema
} from '../schemas.js';
import { DESTRUCTIVE, READ_ONLY, WRITE, fail, ok, toolMeta } from './common.js';

export const WAIT_DEFAULT_SECONDS = 40;
export const WAIT_MAX_SECONDS = 45;
const POLL_INTERVAL_MS = 1000;
const SEED_MAX_LENGTH = 256;
const MAX_CARDS = 78;
const DEFAULT_DECK = 'rws-1909';

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * MCP returns the 32-bit draw seed as decimal text. Convert that form back
 * to a number so it replays exactly through serverDraw.coerceSeed. All other
 * text remains a phrase seed and keeps the existing seeded-hash behavior.
 * This conversion is MCP-only; /api/tarot-reading/draw still hashes every
 * string seed, including numeric strings (Task 8).
 */
function normalizeMcpDrawSeed(seed) {
  if (seed === undefined) return undefined;
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(seed)) {
    const numeric = Number(seed);
    if (!/^\d+$/.test(seed) || !Number.isSafeInteger(numeric) || numeric > 0xffffffff) {
      throw new RangeError('seed must be an unsigned 32-bit decimal integer');
    }
    return numeric;
  }
  return seed;
}

const spreadInfoInput = z.object({
  name: z.string().trim().min(1),
  key: spreadKeySchema
}).strict();

const readingContext = {
  userQuestion: z.string().max(USER_QUESTION_MAX_LENGTH).optional(),
  reflectionsText: z.string().max(REFLECTIONS_TEXT_MAX_LENGTH).optional(),
  reversalFrameworkOverride: z.string().min(1).optional(),
  deckStyle: deckStyleSchema.optional(),
  personalization: personalizationSchema.optional()
};

const drawInput = z.object({
  spreadInfo: spreadInfoInput,
  ...readingContext,
  allowReversals: z.boolean().optional(),
  seed: z.string().trim().min(1).max(SEED_MAX_LENGTH).optional()
}).strict();

const suppliedCard = z.object({
  position: z.string().trim().min(1),
  card: z.string().trim().min(1),
  orientation: anyOrientationSchema,
  meaning: z.string().trim().min(1),
  number: z.number().int().optional(),
  suit: z.string().optional(),
  rank: z.string().optional(),
  rankValue: z.number().int().optional()
}).strict();

const startInput = z.object({
  spreadInfo: spreadInfoInput,
  cardsInfo: z.array(suppliedCard).min(1).max(MAX_CARDS),
  ...readingContext
}).strict();

const jobRef = {
  jobId: z.string().min(1),
  jobToken: z.string().min(1)
};
const jobRefInput = z.object(jobRef).strict();
const waitInput = z.object({
  ...jobRef,
  timeoutSeconds: z.number().int().min(1).max(WAIT_MAX_SECONDS).optional()
}).strict();

const statusOutput = z.object({
  jobId: z.string(),
  status: z.enum(['running', 'complete', 'error']),
  spreadInfo: spreadInfoOutputSchema.nullable(),
  cardsInfo: z.array(publicCardSchema),
  seed: z.string().optional(),
  reading: z.string().optional(),
  provider: z.string().nullable().optional(),
  requestId: z.string().nullable().optional(),
  themes: z.record(z.string(), z.unknown()).optional(),
  gateBlocked: z.boolean().optional(),
  gateReason: z.string().nullable().optional(),
  error: z.string().optional(),
  timedOut: z.boolean().optional()
});

const drawOutput = z.object({
  jobId: z.string(),
  jobToken: z.string(),
  status: z.literal('running'),
  spreadInfo: spreadInfoOutputSchema,
  cardsInfo: z.array(publicCardSchema),
  seed: z.string(),
  deckStyle: z.string()
});

const startOutput = z.object({
  jobId: z.string(),
  jobToken: z.string(),
  status: z.literal('running')
});

const cancelOutput = z.object({
  jobId: z.string(),
  status: z.enum(['cancelled', 'complete', 'error'])
});

function jobStatus(status) {
  return status === 'complete' || status === 'error' ? status : 'running';
}

/**
 * Model-facing job status: the snapshot's cards are ground truth, and the
 * large analysis metadata is left out.
 */
export function toCompactStatus(data) {
  const snapshot = data?.snapshot || {};
  const status = jobStatus(data?.status);
  const compact = {
    jobId: String(data?.jobId ?? ''),
    status,
    spreadInfo: snapshot.spreadInfo ?? null,
    cardsInfo: Array.isArray(snapshot.cardsInfo) ? snapshot.cardsInfo : []
  };
  if (snapshot.seed) compact.seed = String(snapshot.seed);
  if (status === 'complete' && data?.result) {
    if (typeof data.result.reading === 'string') compact.reading = data.result.reading;
    compact.provider = data.result.provider ?? null;
    compact.requestId = data.result.requestId ?? null;
    if (data.meta?.themes && typeof data.meta.themes === 'object') compact.themes = data.meta.themes;
    if (data.result.gateBlocked) {
      compact.gateBlocked = true;
      compact.gateReason = data.result.gateReason ?? null;
    }
  }
  if (status === 'error') compact.error = data?.error || 'The reading failed.';
  return compact;
}

function describeCards(cards) {
  return cards
    .map((card) => `${card.position} — ${card.card} (${String(card.orientation).toLowerCase()})`)
    .join('; ');
}

function statusText(compact) {
  if (compact.status === 'complete') {
    return `The reading is complete (requestId ${compact.requestId ?? 'unknown'}). Present the narrative in \`reading\` with the cards: ${describeCards(compact.cardsInfo)}.`;
  }
  if (compact.status === 'error') return `The reading failed: ${compact.error}`;
  return 'The reading is still being written; call wait_for_tarot_reading again with the same jobId and jobToken; do not start a new reading.';
}

function lookupFailure(result) {
  if (result.status === 404) return fail('Reading job not found.');
  if (result.status === 410) return fail('This reading job has expired.');
  return fail(`Could not check the reading: ${result.error || 'the reading service is unavailable.'}`);
}

/**
 * @param {McpServer} server
 * @param {object} deps
 * @param {object} deps.env - Worker bindings (READING_JOBS)
 * @param {object} deps.user - The resolved Tableu user
 * @param {(ms: number) => Promise<void>} [deps.sleep]
 * @param {() => number} [deps.now]
 */
export function registerReadingTools(server, { env, user, sleep = defaultSleep, now = Date.now }) {
  const principal = { userId: user.id };

  server.registerTool(
    'draw_tarot_reading',
    {
      title: 'Draw a tarot reading',
      description:
        "Draws cards on the Tableu backend for one of the six spreads and starts writing the reading. Returns the drawn cards at once, with a jobId and jobToken; then call wait_for_tarot_reading. Use only when the user has not supplied cards, and never invent cards. Uses one reading from the user's quota. A phrase seed is deterministic; pass the returned decimal seed back to replay the exact cards and orientations.",
      inputSchema: drawInput,
      outputSchema: drawOutput,
      annotations: WRITE,
      _meta: toolMeta({ invoking: 'Shuffling and drawing cards…', invoked: 'Cards drawn' })
    },
    async (input) => {
      let drawSeed;
      try {
        drawSeed = normalizeMcpDrawSeed(input.seed);
      } catch (error) {
        return fail(`Not started: ${error.message}`);
      }
      const drawn = drawForSpread({
        spreadInfo: input.spreadInfo,
        seed: drawSeed,
        allowReversals: input.allowReversals,
        deckStyle: input.deckStyle
      });
      if (!drawn.ok) return fail(`Not started: ${drawn.error}`);

      const cardsInfo = drawn.cardsInfo.map((card) => toPublicCard(card));
      const seed = String(drawn.seed);
      const started = await startReadingJob({
        env,
        payload: {
          spreadInfo: drawn.spreadInfo,
          cardsInfo: drawn.cardsInfo,
          userQuestion: input.userQuestion,
          reflectionsText: input.reflectionsText,
          reversalFrameworkOverride: input.reversalFrameworkOverride,
          deckStyle: drawn.deckStyle,
          personalization: input.personalization
        },
        principal,
        snapshot: {
          spreadInfo: drawn.spreadInfo,
          cardsInfo,
          userQuestion: input.userQuestion ?? null,
          deckStyle: drawn.deckStyle,
          personalization: input.personalization ?? null,
          seed
        }
      });
      if (!started.ok) return fail(`Not started: ${started.error}`);

      return ok(
        {
          jobId: started.jobId,
          jobToken: started.jobToken,
          status: 'running',
          spreadInfo: drawn.spreadInfo,
          cardsInfo,
          seed,
          deckStyle: drawn.deckStyle
        },
        `Drew ${cardsInfo.length} card${cardsInfo.length === 1 ? '' : 's'} for ${drawn.spreadInfo.name}: ${describeCards(cardsInfo)}. The reading is being written; call wait_for_tarot_reading with this jobId and jobToken.`
      );
    }
  );

  server.registerTool(
    'start_tarot_reading',
    {
      title: 'Start a reading from supplied cards',
      description:
        "Starts a Tableu reading for cards the user supplies: a physical deck, a photo, or an earlier draw. Keep their cards, positions and orientations exactly. Returns a jobId and jobToken at once; then call wait_for_tarot_reading. Uses one reading from the user's quota.",
      inputSchema: startInput,
      outputSchema: startOutput,
      annotations: WRITE,
      _meta: toolMeta({ invoking: 'Laying out your cards…', invoked: 'Reading started' })
    },
    async (input) => {
      const deckStyle = input.deckStyle || DEFAULT_DECK;
      const cardsInfo = input.cardsInfo.map((card) => ({
        ...card,
        orientation: card.orientation.toLowerCase() === 'reversed' ? 'Reversed' : 'Upright'
      }));

      // The same check the reading pipeline makes, done before any quota is used.
      let catalog;
      try {
        catalog = resolveReadingCards(cardsInfo, deckStyle);
      } catch (error) {
        if (error instanceof ReadingCardResolutionError) return fail(`Not started: ${error.message}`);
        throw error;
      }

      const started = await startReadingJob({
        env,
        payload: {
          spreadInfo: input.spreadInfo,
          cardsInfo,
          userQuestion: input.userQuestion,
          reflectionsText: input.reflectionsText,
          reversalFrameworkOverride: input.reversalFrameworkOverride,
          deckStyle,
          personalization: input.personalization
        },
        principal,
        snapshot: {
          spreadInfo: { name: input.spreadInfo.name, key: input.spreadInfo.key },
          cardsInfo: cardsInfo.map((card, index) => toPublicCard(card, catalog[index])),
          userQuestion: input.userQuestion ?? null,
          deckStyle,
          personalization: input.personalization ?? null,
          seed: null
        }
      });
      if (!started.ok) return fail(`Not started: ${started.error}`);

      return ok(
        { jobId: started.jobId, jobToken: started.jobToken, status: 'running' },
        'Reading started. Call wait_for_tarot_reading with this jobId and jobToken.'
      );
    }
  );

  server.registerTool(
    'get_tarot_reading_status',
    {
      title: 'Check a reading',
      description: 'Checks a reading job once. To wait for it to finish, use wait_for_tarot_reading instead.',
      inputSchema: jobRefInput,
      outputSchema: statusOutput,
      annotations: READ_ONLY,
      _meta: toolMeta({ invoking: 'Checking the reading…', invoked: 'Reading checked' })
    },
    async ({ jobId, jobToken }) => {
      const result = await getMcpJobSnapshot({ env, jobId, jobToken, userId: user.id });
      if (!result.ok) return lookupFailure(result);
      const compact = toCompactStatus(result.data);
      return ok(compact, statusText(compact));
    }
  );

  server.registerTool(
    'wait_for_tarot_reading',
    {
      title: 'Wait for a reading',
      description: `Waits up to timeoutSeconds (default ${WAIT_DEFAULT_SECONDS}, at most ${WAIT_MAX_SECONDS}) for a reading job to finish, then returns its status. When it is complete, \`reading\` holds the narrative. If it is still running, call this again with the same jobId and jobToken; never start a second reading for the same request.`,
      inputSchema: waitInput,
      outputSchema: statusOutput,
      annotations: READ_ONLY,
      _meta: toolMeta({ invoking: 'Waiting for the reading…', invoked: 'Reading checked' })
    },
    async ({ jobId, jobToken, timeoutSeconds = WAIT_DEFAULT_SECONDS }) => {
      const deadline = now() + timeoutSeconds * 1000;
      for (;;) {
        const result = await getMcpJobSnapshot({ env, jobId, jobToken, userId: user.id });
        if (!result.ok) return lookupFailure(result);
        const compact = toCompactStatus(result.data);
        if (compact.status !== 'running') return ok(compact, statusText(compact));
        if (now() + POLL_INTERVAL_MS >= deadline) {
          const pending = { ...compact, timedOut: true };
          return ok(pending, statusText(pending));
        }
        await sleep(POLL_INTERVAL_MS);
      }
    }
  );

  server.registerTool(
    'cancel_tarot_reading',
    {
      title: 'Cancel a reading',
      description: 'Cancels a reading job that is still being written. A finished reading is left as it is.',
      inputSchema: jobRefInput,
      outputSchema: cancelOutput,
      annotations: DESTRUCTIVE,
      _meta: toolMeta({ invoking: 'Cancelling the reading…', invoked: 'Reading cancelled' })
    },
    async ({ jobId, jobToken }) => {
      const result = await cancelMcpJob({ env, jobId, jobToken, userId: user.id });
      if (!result.ok) {
        return fail(result.status === 404 ? 'Not cancelled: Reading job not found.' : `Not cancelled: ${result.error}`);
      }
      const status = result.data?.status === 'complete' || result.data?.status === 'error'
        ? result.data.status
        : 'cancelled';
      return ok(
        { jobId, status },
        status === 'cancelled' ? 'Reading cancelled.' : `The reading had already finished (${status}); nothing was cancelled.`
      );
    }
  );
}
