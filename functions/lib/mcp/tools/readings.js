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
import { REVERSAL_FRAMEWORK_OVERRIDES } from '../../spreadAnalysis.js';
import {
  CARD_MEANING_MAX_LENGTH,
  REFLECTIONS_TEXT_MAX_LENGTH,
  USER_QUESTION_MAX_LENGTH
} from '../../../../shared/contracts/readingSchema.js';
import { toPublicCard } from '../journalMapping.js';
import { classifyReadingResult, READING_OUTCOME } from '../readingOutcome.js';
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

// The analysis ignores any other override value, so reject it before the
// reading starts instead of reading with a lens the user did not choose.
const reversalLensInput = z.enum(REVERSAL_FRAMEWORK_OVERRIDES).describe(
  'Reversal lens for the whole reading. Send only when the user asks for one; omit it and Tableu chooses. blocked: resistance to clear; delayed: timing not ripe; internalized: inner processing; contextual: card by card; shadow: disowned feelings; mirror: projection; potentialBlocked: dormant strengths.'
);

const readingContext = {
  userQuestion: z.string().max(USER_QUESTION_MAX_LENGTH).optional(),
  reflectionsText: z.string().max(REFLECTIONS_TEXT_MAX_LENGTH).optional(),
  reversalFrameworkOverride: reversalLensInput.optional(),
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
  meaning: z.string().trim().min(1).max(CARD_MEANING_MAX_LENGTH).optional().describe(
    "The user's own meaning for this card. Omit it when they gave none; Tableu then uses the card's standard upright or reversed meaning."
  ),
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

// jobId alone identifies a job: the MCP paths serve it only to the account
// that started it.
const jobRef = {
  jobId: z.string().min(1)
};
const jobRefInput = z.object(jobRef).strict();
const waitInput = z.object({
  ...jobRef,
  timeoutSeconds: z.number().int().min(1).max(WAIT_MAX_SECONDS).optional()
}).strict();

/** The reading's pattern summary; the full analysis stays server-side. */
const THEME_FIELDS = Object.freeze({
  dominantSuit: 'string',
  dominantElement: 'string',
  majorCount: 'number',
  reversalCount: 'number',
  reversalFramework: 'string'
});

const themesOutput = z.object({
  dominantSuit: z.string().optional(),
  dominantElement: z.string().optional(),
  majorCount: z.number().int().optional(),
  reversalCount: z.number().int().optional(),
  reversalFramework: z.string().optional()
});

const statusOutput = z.object({
  jobId: z.string(),
  status: z.enum(['running', 'complete', 'error']),
  spreadInfo: spreadInfoOutputSchema.nullable(),
  cardsInfo: z.array(publicCardSchema),
  seed: z.string().optional(),
  reading: z.string().optional(),
  supportMessage: z.string().optional(),
  themes: themesOutput.optional(),
  gateBlocked: z.boolean().optional(),
  gateReason: z.enum(['crisis_gate', 'withheld']).optional(),
  error: z.string().optional(),
  timedOut: z.boolean().optional()
});

const drawOutput = z.object({
  jobId: z.string(),
  status: z.literal('running'),
  spreadInfo: spreadInfoOutputSchema,
  cardsInfo: z.array(publicCardSchema),
  seed: z.string(),
  deckStyle: z.string()
});

const startOutput = z.object({
  jobId: z.string(),
  status: z.literal('running')
});

const cancelOutput = z.object({
  jobId: z.string(),
  status: z.enum(['cancelled', 'complete', 'error'])
});

function jobStatus(status) {
  return status === 'complete' || status === 'error' ? status : 'running';
}

export const READING_LIMIT_MESSAGE =
  "This Tableu account has used all of its readings for this month, so this reading wasn't written. More become available when the monthly allowance resets.";
export const PLAN_FEATURE_MESSAGE =
  "That spread or option isn't included with this Tableu account, so the reading wasn't written. A different spread may work.";
const UNAVAILABLE_MESSAGE = 'The reading could not be written. Please try again later.';
// Plan and purchase wording never reaches ChatGPT: tool results must not
// promote upgrades or display plans. They may say a feature isn't included.
const COMMERCE_WORDING = /\b(upgrade|subscri\w*|pricing|checkout|plus|pro plan)\b/i;

/** Model-facing text for a failed reading job. */
export function readingErrorText({ error, errorCode } = {}) {
  if (errorCode === 'reading_limit_reached') return READING_LIMIT_MESSAGE;
  if (errorCode === 'plan_feature_unavailable') return PLAN_FEATURE_MESSAGE;
  const text = typeof error === 'string' ? error.trim() : '';
  if (!text) return 'The reading failed.';
  if (/monthly reading limit/i.test(text)) return READING_LIMIT_MESSAGE;
  if (!COMMERCE_WORDING.test(text)) return text;
  return /\brequires?\b/i.test(text) ? PLAN_FEATURE_MESSAGE : UNAVAILABLE_MESSAGE;
}

function toThemeSummary(themes) {
  if (!themes || typeof themes !== 'object') return null;
  const summary = {};
  for (const [field, type] of Object.entries(THEME_FIELDS)) {
    const value = themes[field];
    if (typeof value === type && (type !== 'number' || Number.isInteger(value))) summary[field] = value;
  }
  return Object.keys(summary).length ? summary : null;
}

/**
 * Model-facing job status: the snapshot's cards are ground truth, and the
 * large analysis metadata is left out. `reading` is present only when the job
 * produced a reading; a crisis response comes back as `supportMessage`, and a
 * finished job without any text is reported as failed.
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
  if (status === 'error') compact.error = readingErrorText({ error: data?.error, errorCode: data?.errorCode });
  if (status !== 'complete') return compact;

  const result = data?.result;
  const outcome = classifyReadingResult(result);
  if (outcome === READING_OUTCOME.EMPTY) {
    return { ...compact, status: 'error', error: 'The reading finished without any text.' };
  }
  if (outcome === READING_OUTCOME.READING) {
    compact.reading = result.reading;
    const themes = toThemeSummary(data.meta?.themes);
    if (themes) compact.themes = themes;
    return compact;
  }
  compact.gateBlocked = true;
  if (outcome === READING_OUTCOME.SUPPORT) {
    compact.gateReason = 'crisis_gate';
    if (typeof result.reading === 'string' && result.reading.trim()) compact.supportMessage = result.reading;
  } else {
    // The internal gate reason is diagnostic; ChatGPT only needs to know the
    // reading was held back.
    compact.gateReason = 'withheld';
  }
  return compact;
}

function describeCards(cards) {
  return cards
    .map((card) => `${card.position} — ${card.card} (${String(card.orientation).toLowerCase()})`)
    .join('; ');
}

function statusText(compact) {
  if (compact.status === 'error') return `The reading failed: ${compact.error}`;
  if (compact.status !== 'complete') {
    return 'The reading is still being written; call wait_for_tarot_reading again with the same jobId; do not start a new reading.';
  }
  if (compact.reading !== undefined) {
    return `The reading is complete. Present the narrative in \`reading\` with the cards: ${describeCards(compact.cardsInfo)}.`;
  }
  if (compact.gateReason === 'crisis_gate') {
    return 'Tableu did not write a reading: the question or reflections suggested the person may be in crisis, so it returned a support message in `supportMessage` instead. Set the cards aside and put their safety first: respond with care and share that support information. Do not interpret the cards, and do not offer to save this.';
  }
  return "Tableu held back this reading after its safety check, so there is no narrative to present. Tell the user plainly that this reading isn't available. Do not write a reading of these cards in its place, and do not start another reading unless they ask. It can't be saved to the journal.";
}

function lookupFailure(result) {
  if (result.status === 404) return fail('Reading job not found.');
  if (result.status === 410) return fail('This reading job has expired.');
  return fail(`Could not check the reading: ${result.error ? readingErrorText({ error: result.error }) : 'the reading service is unavailable.'}`);
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
        "Draws cards on the Tableu backend for one of the six spreads and starts writing the reading. Returns the drawn cards at once, with a jobId; then call wait_for_tarot_reading. Use only when the user has not supplied cards, and never invent cards. Uses one reading from the user's quota. A phrase seed is deterministic; pass the returned decimal seed back to replay the exact cards and orientations.",
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
      if (!started.ok) return fail(`Not started: ${readingErrorText({ error: started.error, errorCode: started.code })}`);

      return ok(
        {
          jobId: started.jobId,
          status: 'running',
          spreadInfo: drawn.spreadInfo,
          cardsInfo,
          seed,
          deckStyle: drawn.deckStyle
        },
        `Drew ${cardsInfo.length} card${cardsInfo.length === 1 ? '' : 's'} for ${drawn.spreadInfo.name}: ${describeCards(cardsInfo)}. The reading is being written; call wait_for_tarot_reading with this jobId.`
      );
    }
  );

  server.registerTool(
    'start_tarot_reading',
    {
      title: 'Start a reading from supplied cards',
      description:
        "Starts a Tableu reading for cards the user supplies: a physical deck, a photo, or an earlier draw. Keep their cards, positions and orientations exactly, and send a meaning only when the user gave one. Returns a jobId at once; then call wait_for_tarot_reading. Uses one reading from the user's quota.",
      inputSchema: startInput,
      outputSchema: startOutput,
      annotations: WRITE,
      _meta: toolMeta({ invoking: 'Laying out your cards…', invoked: 'Reading started' })
    },
    async (input) => {
      const deckStyle = input.deckStyle || DEFAULT_DECK;
      const suppliedCards = input.cardsInfo.map((card) => ({
        ...card,
        orientation: card.orientation.toLowerCase() === 'reversed' ? 'Reversed' : 'Upright'
      }));

      // The same check the reading pipeline makes, done before any quota is used.
      let catalog;
      try {
        catalog = resolveReadingCards(suppliedCards, deckStyle);
      } catch (error) {
        if (error instanceof ReadingCardResolutionError) return fail(`Not started: ${error.message}`);
        throw error;
      }
      // A card without the user's meaning reads with the catalog's meaning for
      // its orientation, as a drawn card does.
      const cardsInfo = suppliedCards.map((card, index) => ({
        ...card,
        meaning: card.meaning ?? catalog[index].meaning
      }));

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
      if (!started.ok) return fail(`Not started: ${readingErrorText({ error: started.error, errorCode: started.code })}`);

      return ok(
        { jobId: started.jobId, status: 'running' },
        'Reading started. Call wait_for_tarot_reading with this jobId.'
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
    async ({ jobId }) => {
      const result = await getMcpJobSnapshot({ env, jobId, userId: user.id });
      if (!result.ok) return lookupFailure(result);
      const compact = toCompactStatus(result.data);
      return ok(compact, statusText(compact));
    }
  );

  server.registerTool(
    'wait_for_tarot_reading',
    {
      title: 'Wait for a reading',
      description: `Waits up to timeoutSeconds (default ${WAIT_DEFAULT_SECONDS}, at most ${WAIT_MAX_SECONDS}) for a reading job to finish, then returns its status. When it is complete, \`reading\` holds the narrative; when Tableu returned a support message or held the reading back, \`reading\` is absent and the result text says what to do. If it is still running, call this again with the same jobId; never start a second reading for the same request.`,
      inputSchema: waitInput,
      outputSchema: statusOutput,
      annotations: READ_ONLY,
      _meta: toolMeta({ invoking: 'Waiting for the reading…', invoked: 'Reading checked' })
    },
    async ({ jobId, timeoutSeconds = WAIT_DEFAULT_SECONDS }) => {
      const deadline = now() + timeoutSeconds * 1000;
      for (;;) {
        const result = await getMcpJobSnapshot({ env, jobId, userId: user.id });
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
      // Static text shown for every outcome, including a reading that had
      // already finished, so it must not claim the cancellation happened.
      _meta: toolMeta({ invoking: 'Cancelling the reading…', invoked: 'Cancellation checked' })
    },
    async ({ jobId }) => {
      const result = await cancelMcpJob({ env, jobId, userId: user.id });
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
