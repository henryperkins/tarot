/**
 * AI-Enhanced Coach Suggestion System
 *
 * Uses Workers AI to extract actionable next steps from tarot reading narratives
 * and generate embeddings for semantic clustering. Heavy AI work is done once
 * per reading (on save), enabling fast client-side assembly of contextual
 * suggestions that respect journal filters.
 *
 * Architecture:
 * - On reading save: Extract steps + generate embeddings (waitUntil)
 * - On journal load: Client clusters pre-computed data, picks top theme
 */

const EXTRACTION_MODEL = '@cf/meta/llama-3-8b-instruct-awq';
const EMBEDDING_MODEL = '@cf/qwen/qwen3-embedding-0.6b';
const DEFAULT_TIMEOUT_MS = 8000;
const EXTRACTION_VERSION = 'v1';

// Maximum narrative length to process (prevents context overflow)
const MAX_NARRATIVE_LENGTH = 4000;

// ============================================================================
// Prompts
// ============================================================================

const EXTRACT_STEPS_SYSTEM = `You extract actionable next steps from tarot reading narratives.

Rules:
- Extract 1-5 concrete, actionable steps the reading suggests
- Look for sections like "Gentle Next Steps", "Suggestions", "Moving Forward", or embedded advice
- Preserve the step's essence but normalize phrasing to first-person imperatives
- Convert second-person ("you should", "consider trying") to first-person ("Set...", "Practice...")
- Ignore vague platitudes ("trust the process", "believe in yourself")
- If no clear action steps exist, return an empty array

Example input:
"The Queen of Swords suggests clear communication is needed. Consider setting a boundary around your time this week. You might also journal about what 'enough' means to you."

Example output:
["Set a boundary around my time", "Practice clear communication", "Journal about what 'enough' means to me"]`;

const EXTRACT_STEPS_USER = `Extract actionable next steps from this tarot reading narrative:

---
{{narrative}}
---

Return ONLY a valid JSON array of 0-5 strings. No explanation, no markdown, just the array.`;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Extract actionable next steps from a narrative using Workers AI.
 *
 * @param {Object} env - Worker environment with AI binding
 * @param {string} narrative - The reading narrative text
 * @param {string} requestId - Request ID for logging
 * @returns {Promise<{steps: string[], status: string, error?: string}>}
 */
export async function extractNextStepsWithAI(env, narrative, requestId = 'unknown') {
  if (!env?.AI) {
    console.log(`[${requestId}] [coach] AI binding not available`);
    return { steps: [], status: 'missing_ai' };
  }

  if (!narrative || typeof narrative !== 'string' || narrative.trim().length < 50) {
    console.log(`[${requestId}] [coach] Narrative too short for extraction`);
    return { steps: [], status: 'too_short' };
  }

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    // Truncate narrative if needed
    const truncatedNarrative = narrative.length > MAX_NARRATIVE_LENGTH
      ? narrative.slice(0, MAX_NARRATIVE_LENGTH) + '...[truncated]'
      : narrative;

    const prompt = EXTRACT_STEPS_USER.replace('{{narrative}}', truncatedNarrative);

    const response = await env.AI.run(
      EXTRACTION_MODEL,
      {
        messages: [
          { role: 'system', content: EXTRACT_STEPS_SYSTEM },
          { role: 'user', content: prompt }
        ],
        max_tokens: 256,
        temperature: 0.1
      },
      { signal: controller.signal }
    );

    const latencyMs = Date.now() - startTime;
    const responseText = response?.response || '';

    // Parse JSON array from response
    const match = responseText.match(/\[[\s\S]*\]/);
    if (!match) {
      console.warn(`[${requestId}] [coach] No JSON array in response (${latencyMs}ms): ${responseText.slice(0, 100)}`);
      // Use parse_error (retriable) instead of no_steps (permanent) for malformed AI output
      return { steps: [], status: 'parse_error', error: 'no_json_array' };
    }

    let steps;
    try {
      steps = JSON.parse(match[0]);
    } catch (parseErr) {
      console.warn(`[${requestId}] [coach] Invalid JSON in response (${latencyMs}ms): ${parseErr.message}`);
      return { steps: [], status: 'parse_error', error: 'invalid_json' };
    }

    if (!Array.isArray(steps)) {
      console.warn(`[${requestId}] [coach] Response not an array (${latencyMs}ms)`);
      return { steps: [], status: 'parse_error', error: 'not_array' };
    }

    // Filter to valid strings only
    const validSteps = steps
      .filter(s => typeof s === 'string' && s.trim().length > 0)
      .map(s => s.trim())
      .slice(0, 5); // Cap at 5 steps

    console.log(`[${requestId}] [coach] Extracted ${validSteps.length} steps in ${latencyMs}ms`);
    return { steps: validSteps, status: validSteps.length ? 'ok' : 'no_steps' };

  } catch (err) {
    const latencyMs = Date.now() - startTime;

    if (err.name === 'AbortError') {
      console.warn(`[${requestId}] [coach] Extraction timeout after ${DEFAULT_TIMEOUT_MS}ms`);
      return { steps: [], status: 'timeout', error: err.message };
    }

    console.error(`[${requestId}] [coach] Extraction error (${latencyMs}ms): ${err.message}`);
    return { steps: [], status: 'error', error: err.message };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Embedding timeout - shorter than extraction since embeddings are typically faster
const EMBEDDING_TIMEOUT_MS = 5000;

/**
 * Generate embeddings for a list of text strings using Workers AI.
 *
 * @param {Object} env - Worker environment with AI binding
 * @param {string[]} texts - Array of text strings to embed
 * @param {string} requestId - Request ID for logging
 * @returns {Promise<number[][]>} Array of embedding vectors (empty on failure)
 */
export async function generateEmbeddings(env, texts, requestId = 'unknown') {
  if (!env?.AI) {
    console.log(`[${requestId}] [coach] AI binding not available for embeddings`);
    return [];
  }

  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);

  try {
    const response = await env.AI.run(
      EMBEDDING_MODEL,
      { text: texts },
      { signal: controller.signal }
    );

    const latencyMs = Date.now() - startTime;
    const embeddings = response?.data || [];

    if (embeddings.length !== texts.length) {
      console.warn(`[${requestId}] [coach] Embedding count mismatch: ${embeddings.length} vs ${texts.length} (${latencyMs}ms)`);
      return [];
    }

    console.log(`[${requestId}] [coach] Generated ${embeddings.length} embeddings in ${latencyMs}ms`);
    return embeddings;

  } catch (err) {
    const latencyMs = Date.now() - startTime;

    if (err.name === 'AbortError') {
      console.warn(`[${requestId}] [coach] Embedding timeout after ${EMBEDDING_TIMEOUT_MS}ms`);
      return [];
    }

    console.error(`[${requestId}] [coach] Embedding error (${latencyMs}ms): ${err.message}`);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extract steps and generate embeddings for a journal entry.
 * This is the main function called from the journal save handler.
 *
 * @param {Object} env - Worker environment
 * @param {string} narrative - The reading narrative
 * @param {string} requestId - Request ID for logging
 * @returns {Promise<{steps: string[], embeddings: number[][], version: string | null, status: string}>}
 */
export async function extractAndEmbed(env, narrative, requestId = 'unknown') {
  // Step 1: Extract actionable steps
  const extraction = await extractNextStepsWithAI(env, narrative, requestId);

  if (extraction.status === 'no_steps') {
    console.log(`[${requestId}] [coach] No steps extracted, marking empty extraction`);
    return {
      steps: [],
      embeddings: [],
      version: `${EXTRACTION_VERSION}-empty`,
      status: 'no_steps'
    };
  }

  if (extraction.status !== 'ok') {
    console.warn(`[${requestId}] [coach] Extraction failed (${extraction.status}), skipping embeddings`);
    return { steps: [], embeddings: [], version: null, status: extraction.status };
  }

  const steps = extraction.steps;

  // Step 2: Generate embeddings
  const embeddings = await generateEmbeddings(env, steps, requestId);

  if (embeddings.length !== steps.length) {
    console.warn(`[${requestId}] [coach] Embedding generation failed or mismatched; storing steps without embeddings`);
    return { steps, embeddings: [], version: `${EXTRACTION_VERSION}-steps-only`, status: 'steps_only' };
  }

  return {
    steps,
    embeddings,
    version: EXTRACTION_VERSION,
    status: 'ok'
  };
}

/**
 * Schedule async extraction and embedding for a journal entry.
 * Called from journal POST handler via waitUntil.
 *
 * @param {Object} env - Worker environment
 * @param {string} entryId - Journal entry ID
 * @param {string} narrative - Reading narrative text
 * @param {Object} options - Options
 * @param {Function} options.waitUntil - waitUntil function from request context
 * @param {string} options.requestId - Request ID for logging
 */
export function scheduleCoachExtraction(env, entryId, narrative, options = {}) {
  const { waitUntil, requestId = 'unknown' } = options;

  if (!env?.AI) {
    console.log(`[${requestId}] [coach] Skipped: AI binding not available`);
    return;
  }

  if (!env?.DB) {
    console.log(`[${requestId}] [coach] Skipped: DB binding not available`);
    return;
  }

  if (!narrative || narrative.trim().length < 100) {
    console.log(`[${requestId}] [coach] Skipped: narrative too short`);
    return;
  }

  const runner = async () => {
    try {
      const result = await extractAndEmbed(env, narrative, requestId);

      if (!result || !result.status) {
        console.warn(`[${requestId}] [coach] Extraction returned no result`);
        return;
      }

      if (result.status === 'ok') {
        // Store in D1
        await env.DB.prepare(`
          UPDATE journal_entries
          SET extracted_steps = ?1, step_embeddings = ?2, extraction_version = ?3
          WHERE id = ?4
        `).bind(
          JSON.stringify(result.steps),
          JSON.stringify(result.embeddings),
          result.version,
          entryId
        ).run();

        console.log(`[${requestId}] [coach] Stored ${result.steps.length} steps for entry ${entryId}`);
        return;
      }

      if (result.status === 'no_steps') {
        await env.DB.prepare(`
          UPDATE journal_entries
          SET extracted_steps = '[]', step_embeddings = '[]', extraction_version = ?
          WHERE id = ?
        `).bind(`${EXTRACTION_VERSION}-empty`, entryId).run();
        console.log(`[${requestId}] [coach] Stored empty extraction for entry ${entryId}`);
        return;
      }

      if (result.status === 'steps_only') {
        await env.DB.prepare(`
          UPDATE journal_entries
          SET extracted_steps = ?1, step_embeddings = NULL, extraction_version = ?2
          WHERE id = ?3
        `).bind(
          JSON.stringify(result.steps),
          result.version || `${EXTRACTION_VERSION}-steps-only`,
          entryId
        ).run();
        console.log(`[${requestId}] [coach] Stored ${result.steps.length} steps without embeddings for entry ${entryId}`);
        return;
      }

      console.warn(`[${requestId}] [coach] Extraction not stored due to status: ${result.status}`);

    } catch (err) {
      console.error(`[${requestId}] [coach] Schedule failed: ${err.message}`);
    }
  };

  if (typeof waitUntil === 'function') {
    waitUntil(runner());
    return;
  }

  // Fallback: run inline (not ideal but better than nothing)
  console.warn(`[${requestId}] [coach] waitUntil unavailable; running extraction inline`);
  return runner();
}
