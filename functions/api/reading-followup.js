/**
 * Follow-Up Questions API Endpoint
 * 
 * POST /api/reading-followup
 * 
 * Enables users to ask questions about their personalized tarot reading
 * after it's generated, with optional journal context integration.
 */

import { validateSession, getSessionFromCookie } from '../lib/auth.js';
import { jsonResponse, readJsonBody, safeJsonParse } from '../lib/utils.js';
import { buildTierLimitedPayload, isEntitled, getSubscriptionContext } from '../lib/entitlements.js';
import { buildFollowUpPrompt } from '../lib/followUpPrompt.js';
import { findSimilarJournalEntries, getRecurringCardPatterns } from '../lib/journalSearch.js';
import { insertFollowUps } from '../lib/journalFollowups.js';
import { callAzureResponses } from '../lib/azureResponses.js';
import {
  callAzureResponsesStream,
  callAzureResponsesStreamWithConversation,
  buildToolContinuationConversation,
  transformAzureStream,
  createSSEResponse,
  createSSEErrorResponse
} from '../lib/azureResponsesStream.js';
import { getMemories, consolidateSessionMemories } from '../lib/userMemory.js';
import { MEMORY_TOOL_AZURE_RESPONSES_FORMAT, handleMemoryToolCall } from '../lib/memoryTool.js';

// Rate limits by tier
const FOLLOW_UP_LIMITS = {
  free: { perReading: 1, perDay: 3 },
  plus: { perReading: 3, perDay: 15 },
  pro: { perReading: 10, perDay: 50 }
};

/**
 * Health check endpoint
 */
export const onRequestGet = async () => {
  return jsonResponse({
    status: 'ok',
    endpoint: 'reading-followup',
    timestamp: new Date().toISOString()
  });
};

/**
 * Main follow-up question handler
 */
export const onRequestPost = async ({ request, env, ctx }) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  console.log(`[${requestId}] === FOLLOW-UP REQUEST START ===`);
  
  try {
    if (env?.FEATURE_FOLLOW_UP_ENABLED !== 'true') {
      return jsonResponse({ error: 'Feature not available' }, { status: 404 });
    }

    // Auth check
    const cookieHeader = request.headers.get('Cookie');
    const token = getSessionFromCookie(cookieHeader);
    const user = await validateSession(env.DB, token);
    
    if (!user) {
      console.log(`[${requestId}] Unauthenticated request`);
      return jsonResponse({ error: 'Not authenticated' }, { status: 401 });
    }
    
    console.log(`[${requestId}] User authenticated`);
    
    // Parse request body
    const body = await readJsonBody(request);
    const {
      requestId: readingRequestId,
      followUpQuestion,
      conversationHistory = [],
      readingContext,
      options = {}
    } = body;

    const journalContextEnabled = env?.FEATURE_FOLLOW_UP_JOURNAL_CONTEXT === 'true';
    const memoryEnabled = env?.FEATURE_FOLLOW_UP_MEMORY !== 'false'; // Enabled by default
    
    // Validate required fields
    if (!followUpQuestion || typeof followUpQuestion !== 'string' || followUpQuestion.trim().length < 3) {
      console.log(`[${requestId}] Invalid follow-up question`);
      return jsonResponse({ error: 'Invalid follow-up question' }, { status: 400 });
    }

    // Enforce max length to prevent prompt inflation/abuse (matches frontend 500-char cap)
    const MAX_QUESTION_LENGTH = 500;
    if (followUpQuestion.length > MAX_QUESTION_LENGTH) {
      console.log(`[${requestId}] Follow-up question too long: ${followUpQuestion.length} chars`);
      return jsonResponse({ error: `Question too long (max ${MAX_QUESTION_LENGTH} characters)` }, { status: 400 });
    }
    
    // readingRequestId is required for authoritative per-reading limit tracking
    if (!readingRequestId) {
      console.log(`[${requestId}] Missing readingRequestId`);
      return jsonResponse({ error: 'readingRequestId is required' }, { status: 400 });
    }

    if (!readingContext) {
      console.log(`[${requestId}] Missing reading context`);
      return jsonResponse({ error: 'readingContext is required' }, { status: 400 });
    }

    // Get user tier and check limits
    const subscription = getSubscriptionContext(user);
    const tier = subscription.effectiveTier || 'free';
    const limits = FOLLOW_UP_LIMITS[tier] || FOLLOW_UP_LIMITS.free;
    const canPersistFollowups = isEntitled(user, 'plus');

    console.log(`[${requestId}] User tier: ${tier}, limits: ${JSON.stringify(limits)}`);

    // Check per-reading limit using server-side tracking (prevents client manipulation)
    const actualTurns = await getPerReadingFollowUpCount(env.DB, user.id, readingRequestId);
    const turnNumber = actualTurns + 1;
    console.log(`[${requestId}] Server-verified turn: ${turnNumber}/${limits.perReading} (DB count: ${actualTurns})`);

    if (turnNumber > limits.perReading) {
      console.log(`[${requestId}] Per-reading limit exceeded: ${turnNumber}/${limits.perReading}`);

      // Note: Memory consolidation now happens after each successful follow-up (see onComplete).
      // This redundant call ensures any stragglers are caught if user hits limit on a failed request.
      if (memoryEnabled && readingRequestId) {
        const consolidationPromise = consolidateSessionMemories(env.DB, user.id, readingRequestId)
          .then(result => {
            if (result.promoted > 0 || result.pruned > 0) {
              console.log(`[${requestId}] Final consolidation: promoted=${result.promoted}, pruned=${result.pruned}`);
            }
          })
          .catch(err => {
            console.warn(`[${requestId}] Memory consolidation failed:`, err.message);
          });
        if (ctx?.waitUntil) {
          ctx.waitUntil(consolidationPromise);
        }
      }

      return jsonResponse(
        buildTierLimitedPayload({
          message: `You've reached the ${limits.perReading} follow-up limit for this reading`,
          user,
          requiredTier: tier === 'free' ? 'plus' : 'pro'
        }),
        { status: 403 }
      );
    }
    
    // Check daily limit
    const dailyUsage = await getDailyFollowUpCount(env.DB, user.id);
    if (dailyUsage >= limits.perDay) {
      console.log(`[${requestId}] Daily limit exceeded: ${dailyUsage}/${limits.perDay}`);
      return jsonResponse(
        buildTierLimitedPayload({
          message: `You've reached your daily limit of ${limits.perDay} follow-up questions`,
          user,
          requiredTier: tier === 'free' ? 'plus' : 'pro'
        }),
        { status: 429 }
      );
    }
    
    // Fetch original reading context if requestId provided
    // Merge stored context with client-provided context (stored wins, client fills gaps)
    let effectiveContext = readingContext;
    if (readingRequestId) {
      const storedContext = await fetchReadingContext(env, readingRequestId, user.id);
      if (storedContext) {
        effectiveContext = {
          cardsInfo: storedContext.cardsInfo?.length ? storedContext.cardsInfo : readingContext?.cardsInfo,
          userQuestion: storedContext.userQuestion || readingContext?.userQuestion,
          narrative: storedContext.narrative || readingContext?.narrative,
          themes: storedContext.themes || readingContext?.themes || {},
          spreadKey: storedContext.spreadKey || readingContext?.spreadKey,
          deckStyle: storedContext.deckStyle || readingContext?.deckStyle
        };
        console.log(`[${requestId}] Merged stored context for ${readingRequestId}`);
      }
    }
    
    // Require card context to keep follow-ups grounded
    if (!effectiveContext?.cardsInfo || effectiveContext.cardsInfo.length === 0) {
      console.log(`[${requestId}] Missing card context after merge; rejecting follow-up`);
      return jsonResponse(
        { error: 'Reading context unavailable. Please regenerate your reading before asking follow-up questions.' },
        { status: 400 }
      );
    }
    
    // Journal context (Plus+ only)
    const shouldIncludeJournalContext =
      Boolean(options.includeJournalContext) &&
      journalContextEnabled &&
      isEntitled(user, 'plus');

    let journalContext = null;
    if (shouldIncludeJournalContext) {
      console.log(`[${requestId}] Building journal context...`);
      journalContext = await buildJournalContext(env, user.id, {
        question: followUpQuestion,
        currentCards: effectiveContext?.cardsInfo?.map(c => c.card || c.name) || [],
        maxEntries: options.maxJournalEntries || 3,
        requestId
      });
      console.log(`[${requestId}] Journal context: ${journalContext?.patterns?.length || 0} patterns found`);
    }
    
    // Get user preferences for personalization
    const personalization = await getUserPreferences(env.DB, user.id);

    // Fetch persistent memories for personalization
    let memories = [];
    if (memoryEnabled) {
      try {
        memories = await getMemories(env.DB, user.id, {
          scope: 'all',
          sessionId: readingRequestId,
          limit: 10
        });
        console.log(`[${requestId}] Fetched ${memories.length} memories for personalization`);
      } catch (memErr) {
        console.warn(`[${requestId}] Memory fetch failed (non-fatal):`, memErr.message);
      }
    }

    // Build prompt with all context
    const { systemPrompt, userPrompt } = buildFollowUpPrompt({
      originalReading: effectiveContext,
      followUpQuestion: followUpQuestion.trim(),
      conversationHistory,
      journalContext,
      personalization,
      memories,
      memoryOptions: {
        includeMemoryTool: memoryEnabled // Enable tool-based memory capture
      }
    });
    
    console.log(`[${requestId}] Prompt built: system=${systemPrompt.length}chars, user=${userPrompt.length}chars`);

    // Check if streaming is requested
    const useStreaming = options.stream === true;

    // Memory tool only works with streaming (tool calls require the streaming API)
    const enableMemoryTool = memoryEnabled && useStreaming;

    // Rebuild prompt if memory tool availability changed
    // (non-streaming shouldn't tell the model about tools it can't use)
    let effectiveSystemPrompt = systemPrompt;
    let effectiveUserPrompt = userPrompt;
    if (memoryEnabled && !useStreaming) {
      // Rebuild without memory tool instructions for non-streaming
      const rebuiltPrompts = buildFollowUpPrompt({
        originalReading: effectiveContext,
        followUpQuestion: followUpQuestion.trim(),
        conversationHistory,
        journalContext,
        personalization,
        memories,
        memoryOptions: {
          includeMemoryTool: false // No tool support in non-streaming
        }
      });
      effectiveSystemPrompt = rebuiltPrompts.systemPrompt;
      effectiveUserPrompt = rebuiltPrompts.userPrompt;
    }

    if (useStreaming) {
      // === STREAMING PATH ===
      console.log(`[${requestId}] Using streaming response`);

      try {
        // Prepare tools array if memory is enabled
        const tools = enableMemoryTool ? [MEMORY_TOOL_AZURE_RESPONSES_FORMAT] : null;

        // If memory tool is enabled, we need to handle potential tool round-trips
        // The model might call save_memory_note, and we need to:
        // 1. Execute the tool
        // 2. Send the result back to Azure
        // 3. Get the continuation response with actual text
        let transformedStream;

        if (enableMemoryTool) {
          // Create a stream that handles tool calls with proper round-trip
          transformedStream = await createToolRoundTripStream(env, {
            instructions: effectiveSystemPrompt,
            userInput: effectiveUserPrompt,
            tools,
            maxTokens: 400,
            verbosity: 'medium',
            requestId,
            onToolCall: async (callId, name, args) => {
              if (name === 'save_memory_note') {
                console.log(`[${requestId}] Memory tool called: category=${args?.category || 'unknown'}, len=${args?.text?.length || 0}`);
                const result = await handleMemoryToolCall(env.DB, user.id, readingRequestId, args);
                return result;
              }
              return { success: false, message: 'Unknown tool' };
            }
          });
        } else {
          const azureStream = await callAzureResponsesStream(env, {
            instructions: effectiveSystemPrompt,
            input: effectiveUserPrompt,
            maxTokens: 400,
            verbosity: 'medium',
            tools: null
          });
          transformedStream = transformAzureStream(azureStream);
        }

        // Wrap with metadata injection and usage tracking
        const wrappedStream = wrapStreamWithMetadata(transformedStream, {
          turn: turnNumber,
          journalContext: journalContext ? {
            entriesSearched: journalContext.entriesSearched,
            patternsFound: journalContext.patterns
          } : null,
          memoryEnabled,
          meta: {
            provider: 'azure-responses-stream',
            requestId
          },
          ctx, // Pass context for waitUntil
          // Usage tracking callback - will be called when stream completes successfully
          onComplete: async (fullText) => {
            const latencyMs = Date.now() - startTime;
            console.log(`[${requestId}] Streaming completed in ${latencyMs}ms, ${fullText.length} chars`);

            // Defensive guard: don't track/persist empty responses (e.g., tool-only)
            if (!fullText || !fullText.trim()) {
              console.log(`[${requestId}] Skipping tracking - empty response`);
              return;
            }

            const trackingPromise = trackFollowUpUsage(env.DB, {
              userId: user.id,
              requestId,
              readingRequestId,
              turnNumber,
              questionLength: followUpQuestion.length,
              responseLength: fullText.length,
              journalContextUsed: Boolean(journalContext),
              patternsFound: journalContext?.patterns?.length || 0
            });

            const persistPromise = canPersistFollowups
              ? persistFollowUpToJournal(env, user.id, readingRequestId, {
                  turnNumber,
                  question: followUpQuestion,
                  answer: fullText,
                  journalContext,
                  requestId
                })
              : Promise.resolve();

            // Consolidate session memories to global scope after each successful follow-up.
            // This ensures memories are promoted even if user doesn't hit their turn limit.
            // Without this, session memories would expire after 24h and never personalize future readings.
            const consolidationPromise = memoryEnabled && readingRequestId
              ? consolidateSessionMemories(env.DB, user.id, readingRequestId)
                  .then(result => {
                    if (result.promoted > 0 || result.pruned > 0) {
                      console.log(`[${requestId}] Memory consolidation: promoted=${result.promoted}, pruned=${result.pruned}`);
                    }
                  })
                  .catch(err => {
                    console.warn(`[${requestId}] Memory consolidation failed:`, err.message);
                  })
              : Promise.resolve();

            await Promise.allSettled([trackingPromise, persistPromise, consolidationPromise]);
          }
        });

        return createSSEResponse(wrappedStream);

      } catch (streamError) {
        console.error(`[${requestId}] Streaming error: ${streamError.message}`);
        return createSSEErrorResponse('Failed to generate response. Please try again.', 503);
      }

    } else {
      // === NON-STREAMING PATH (existing behavior) ===
      let responseText;

      try {
        responseText = await callAzureResponses(env, {
          instructions: effectiveSystemPrompt,
          input: effectiveUserPrompt,
          maxTokens: 400,  // ~250-300 words, aligned with response format guidance
          reasoningEffort: 'low',
          verbosity: 'medium'
        });

        console.log(`[${requestId}] LLM response received: ${responseText?.length || 0} chars`);
      } catch (llmError) {
        console.error(`[${requestId}] LLM error: ${llmError.message}`);
        return jsonResponse(
          { error: 'Failed to generate response. Please try again.' },
          { status: 503 }
        );
      }

      // Track usage
      const trackingPromise = trackFollowUpUsage(env.DB, {
        userId: user.id,
        requestId,
        readingRequestId: readingRequestId || null,
        turnNumber,
        questionLength: followUpQuestion.length,
        responseLength: responseText?.length || 0,
        journalContextUsed: Boolean(journalContext),
        patternsFound: journalContext?.patterns?.length || 0
      });

      const persistPromise = canPersistFollowups
        ? persistFollowUpToJournal(env, user.id, readingRequestId, {
            turnNumber,
            question: followUpQuestion,
            answer: responseText,
            journalContext,
            requestId
          })
        : Promise.resolve();

      const combined = Promise.allSettled([trackingPromise, persistPromise]);
      if (ctx?.waitUntil) {
        ctx.waitUntil(combined);
      } else {
        await combined;
      }

      const latencyMs = Date.now() - startTime;
      console.log(`[${requestId}] Follow-up completed in ${latencyMs}ms`);
      console.log(`[${requestId}] === FOLLOW-UP REQUEST END ===`);

      return jsonResponse({
        response: responseText,
        turn: turnNumber,
        journalContext: journalContext ? {
          entriesSearched: journalContext.entriesSearched,
          patternsFound: journalContext.patterns
        } : null,
        meta: {
          provider: 'azure-responses',
          latencyMs,
          requestId
        }
      });
    }
    
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error(`[${requestId}] Follow-up error after ${latencyMs}ms:`, error.message);
    console.log(`[${requestId}] === FOLLOW-UP REQUEST END (ERROR) ===`);
    return jsonResponse({ error: 'Failed to generate follow-up response' }, { status: 500 });
  }
};

/**
 * Get count of follow-up questions for a specific reading (server-side tracking)
 * This prevents clients from manipulating conversation history to bypass limits
 */
async function getPerReadingFollowUpCount(db, userId, readingRequestId) {
  if (!db || !readingRequestId) return 0;

  try {
    const result = await db.prepare(`
      SELECT COUNT(*) as count FROM follow_up_usage
      WHERE user_id = ? AND reading_request_id = ?
    `).bind(userId, readingRequestId).first();
    return result?.count || 0;
  } catch (error) {
    console.warn(`[getPerReadingFollowUpCount] Error: ${error.message}`);
    return 0;
  }
}

/**
 * Get count of follow-up questions used today by user
 */
async function getDailyFollowUpCount(db, userId) {
  if (!db) return 0;

  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await db.prepare(`
      SELECT COUNT(*) as count FROM follow_up_usage
      WHERE user_id = ? AND DATE(datetime(created_at, 'unixepoch')) = ?
    `).bind(userId, today).first();
    return result?.count || 0;
  } catch (error) {
    console.warn(`[getDailyFollowUpCount] Error: ${error.message}`);
    return 0;
  }
}

/**
 * Fetch reading context from journal or metrics store
 */
async function fetchReadingContext(env, requestId, userId) {
  if (!env?.DB) return null;
  
  try {
    // Try journal_entries first (most common case)
    const journalEntry = await env.DB.prepare(`
      SELECT cards_json, question, narrative, themes_json, spread_key, deck_id
      FROM journal_entries 
      WHERE request_id = ? AND user_id = ?
    `).bind(requestId, userId).first();
    
    if (journalEntry) {
      return {
        cardsInfo: safeJsonParse(journalEntry.cards_json, []),
        userQuestion: journalEntry.question,
        narrative: journalEntry.narrative,
        themes: safeJsonParse(journalEntry.themes_json, {}),
        spreadKey: journalEntry.spread_key,
        deckStyle: journalEntry.deck_id
      };
    }

    // NOTE: We intentionally do NOT fall back to METRICS_DB here.
    // METRICS_DB keys are not user-scoped, so reading from them would allow
    // any authenticated user who knows a requestId to retrieve another user's
    // reading context. The client always provides readingContext as a fallback.

    return null;
  } catch (error) {
    console.warn(`[fetchReadingContext] Error: ${error.message}`);
    return null;
  }
}

/**
 * Build journal context for cross-reading insights
 */
async function buildJournalContext(env, userId, options) {
  const { question, currentCards, maxEntries, requestId } = options;
  
  try {
    // Get recurring card patterns
    const cardPatterns = await getRecurringCardPatterns(env.DB, userId, currentCards);
    
    // Semantic search for similar questions/themes
    const similarEntries = await findSimilarJournalEntries(env, userId, question, {
      limit: maxEntries,
      requestId
    });
    
    const patterns = [];
    
    // Add recurring card insights
    cardPatterns.forEach(pattern => {
      if (pattern.count >= 3) {
        patterns.push({
          type: 'recurring_card',
          description: `${pattern.card} has appeared ${pattern.count} times in recent readings`,
          contexts: pattern.contexts.slice(0, 3)
        });
      }
    });
    
    // Add thematic connections
    if (similarEntries.length > 0) {
      patterns.push({
        type: 'similar_themes',
        description: `Found ${similarEntries.length} past readings with similar themes`,
        entries: similarEntries.map(e => ({
          date: e.created_at ? new Date(e.created_at * 1000).toLocaleDateString() : 'Unknown',
          question: e.question,
          similarity: e.similarity
        }))
      });
    }
    
    return {
      entriesSearched: similarEntries.length + cardPatterns.length,
      patterns,
      similarEntries,
      cardPatterns
    };
  } catch (error) {
    console.warn(`[${requestId}] buildJournalContext error: ${error.message}`);
    return { entriesSearched: 0, patterns: [], similarEntries: [], cardPatterns: [] };
  }
}

/**
 * Get user preferences for personalization
 */
async function getUserPreferences(db, userId) {
  if (!db) return null;
  
  try {
    const result = await db.prepare(`
      SELECT display_name, reading_tone, spiritual_frame, preferred_spread_depth
      FROM users WHERE id = ?
    `).bind(userId).first();
    
    if (!result) return null;
    
    return {
      displayName: result.display_name,
      readingTone: result.reading_tone,
      spiritualFrame: result.spiritual_frame,
      preferredSpreadDepth: result.preferred_spread_depth
    };
  } catch (error) {
    console.warn(`[getUserPreferences] Error: ${error.message}`);
    return null;
  }
}

/**
 * Track follow-up usage for rate limiting and analytics
 */
async function trackFollowUpUsage(db, data) {
  if (!db) return;
  
  const {
    userId,
    requestId,
    readingRequestId,
    turnNumber,
    questionLength,
    responseLength,
    journalContextUsed,
    patternsFound
  } = data;
  
  try {
    await db.prepare(`
      INSERT INTO follow_up_usage (
        id, user_id, request_id, reading_request_id,
        turn_number, question_length, response_length,
        journal_context_used, patterns_found, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      userId,
      requestId,
      readingRequestId,
      turnNumber,
      questionLength,
      responseLength,
      journalContextUsed ? 1 : 0,
      patternsFound,
      Math.floor(Date.now() / 1000)
    ).run();
  } catch (error) {
    // Table may not exist yet - don't fail the request
    console.warn(`[trackFollowUpUsage] Error: ${error.message}`);
  }
}

/**
 * Persist a follow-up turn to the matching journal entry (if it exists).
 */
async function persistFollowUpToJournal(env, userId, readingRequestId, followUp) {
  if (!env?.DB || !userId || !readingRequestId) return;

  try {
    const entry = await env.DB.prepare(`
      SELECT id FROM journal_entries WHERE user_id = ? AND request_id = ?
    `).bind(userId, readingRequestId).first();

    if (!entry?.id) return;

    await insertFollowUps(env.DB, userId, entry.id, [followUp], {
      readingRequestId,
      requestId: followUp?.requestId || null
    });
  } catch (error) {
    console.warn('[persistFollowUpToJournal] Error:', error?.message || error);
  }
}

/**
 * Create a stream that handles tool calls with proper Azure round-trips
 *
 * When the model calls a tool (e.g., save_memory_note), we need to:
 * 1. Collect all text and tool calls from the initial response
 * 2. Execute tool calls locally
 * 3. Send tool results back to Azure for a continuation
 * 4. Stream the continuation response (which contains the actual answer)
 *
 * @param {Object} env - Environment bindings
 * @param {Object} options - Stream options
 * @param {string} options.instructions - System prompt
 * @param {string} options.userInput - User's follow-up question
 * @param {Array} options.tools - Tool definitions for Azure
 * @param {number} options.maxTokens - Max output tokens
 * @param {string} options.verbosity - Text verbosity
 * @param {string} options.requestId - Request ID for logging
 * @param {Function} options.onToolCall - Callback to execute tool calls
 * @returns {ReadableStream} Transformed SSE stream with tool round-trip handled
 */
function createToolRoundTripStream(env, {
  instructions,
  userInput,
  tools,
  maxTokens,
  verbosity,
  requestId,
  onToolCall
}) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      let initialText = '';
      let continuationText = '';
      const toolCalls = [];
      const toolCallArgs = new Map();
      let currentCallId = null;

      const processAzureChunk = (chunkText, { emitDeltas }) => {
        const events = chunkText.split(/\r?\n\r?\n/);
        const remainder = events.pop() || '';
        let deltaText = '';

        for (const eventBlock of events) {
          if (!eventBlock.trim()) continue;

          const lines = eventBlock.split(/\r?\n/);
          let eventType = '';
          const dataLines = [];

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataLines.push(line.slice(5).trim());
            }
          }

          const eventData = dataLines.join('\n');
          if (!eventData) continue;

          let parsed;
          try {
            parsed = JSON.parse(eventData);
          } catch {
            continue;
          }

          const dataType = parsed.type || eventType;

          if (dataType === 'response.output_text.delta') {
            const delta = parsed.delta || '';
            if (delta) {
              if (emitDeltas) {
                controller.enqueue(encoder.encode(formatSSEEvent('delta', { text: delta })));
              }
              deltaText += delta;
            }
          } else if (dataType === 'response.output_item.added' && parsed.item?.type === 'function_call') {
            currentCallId = parsed.item.call_id;
            toolCallArgs.set(currentCallId, { name: parsed.item.name || '', arguments: '' });
          } else if (dataType === 'response.function_call_arguments.delta') {
            const callId = parsed.call_id || currentCallId;
            if (callId && toolCallArgs.has(callId)) {
              toolCallArgs.get(callId).arguments += parsed.delta || '';
            }
          } else if (dataType === 'response.function_call_arguments.done') {
            const callId = parsed.call_id || currentCallId;
            if (callId && toolCallArgs.has(callId)) {
              const tc = toolCallArgs.get(callId);
              let parsedArgs = {};
              try {
                parsedArgs = JSON.parse(tc.arguments || '{}');
              } catch {
                parsedArgs = {};
              }
              toolCalls.push({ callId, name: tc.name, arguments: parsedArgs });
            }
          } else if (dataType === 'response.error' || eventType === 'error') {
            const errorMsg = parsed?.error?.message || parsed?.message || 'Unknown error';
            controller.enqueue(encoder.encode(formatSSEEvent('error', { message: errorMsg })));
            controller.close();
            return { remainder: '', closed: true };
          }
        }

        return { remainder, deltaText };
      };

      let azureStream;
      try {
        azureStream = await callAzureResponsesStream(env, {
          instructions,
          input: userInput,
          maxTokens,
          verbosity,
          tools
        });
      } catch (err) {
        controller.enqueue(encoder.encode(formatSSEEvent('error', { message: err?.message || 'Failed to start stream' })));
        controller.close();
        return;
      }

      const reader = azureStream.getReader();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const result = processAzureChunk(buffer, { emitDeltas: true });
          if (result?.closed) {
            return;
          }

          initialText += result?.deltaText || '';
          buffer = result.remainder || '';
        }
      } finally {
        reader.releaseLock();
      }

      console.log(`[${requestId}] Initial stream completed: text=${initialText.length} chars, toolCalls=${toolCalls.length}`);

      if (toolCalls.length === 0) {
        const isEmpty = !initialText || !initialText.trim();
        controller.enqueue(encoder.encode(formatSSEEvent('done', { fullText: initialText, isEmpty })));
        controller.close();
        return;
      }

      console.log(`[${requestId}] Executing ${toolCalls.length} tool call(s)`);
      const toolResults = [];
      for (const tc of toolCalls) {
        try {
          const result = await onToolCall(tc.callId, tc.name, tc.arguments);
          toolResults.push({ callId: tc.callId, result });
        } catch (err) {
          console.warn(`[${requestId}] Tool call error:`, err.message);
          toolResults.push({ callId: tc.callId, result: { success: false, message: err.message } });
        }
      }

      const conversation = buildToolContinuationConversation(userInput, toolCalls, toolResults);
      console.log(`[${requestId}] Making continuation request with ${conversation.length} conversation items`);

      let continuationStream;
      try {
        continuationStream = await callAzureResponsesStreamWithConversation(env, {
          instructions,
          conversation,
          maxTokens,
          verbosity
        });
      } catch (err) {
        controller.enqueue(encoder.encode(formatSSEEvent('error', { message: err?.message || 'Continuation request failed' })));
        controller.close();
        return;
      }

      const contReader = continuationStream.getReader();
      buffer = '';

      try {
        while (true) {
          const { done, value } = await contReader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const result = processAzureChunk(buffer, { emitDeltas: true });
          if (result?.closed) {
            return;
          }

          continuationText += result?.deltaText || '';
          buffer = result.remainder || '';
        }
      } finally {
        contReader.releaseLock();
      }

      const fullText = `${initialText}${continuationText}`;
      const isEmpty = !fullText || !fullText.trim();
      controller.enqueue(encoder.encode(formatSSEEvent('done', { fullText, isEmpty })));
      controller.close();
    }
  });
}

/**
 * Wrap a transformed SSE stream with metadata and completion tracking
 *
 * Adds:
 * - Initial 'meta' event with turn/journalContext info
 * - Passes through 'delta' events
 * - Tracks full text for usage logging
 * - Calls onComplete callback when done (via waitUntil for guaranteed execution)
 *
 * @param {ReadableStream} stream - Transformed SSE stream
 * @param {Object} options - Wrapper options
 * @param {number} options.turn - Turn number
 * @param {Object} options.journalContext - Journal context info
 * @param {Object} options.meta - Response metadata
 * @param {Object} options.ctx - Request context for waitUntil
 * @param {Function} options.onComplete - Callback(fullText) when stream ends
 * @returns {ReadableStream} Wrapped SSE stream
 */
function wrapStreamWithMetadata(stream, { turn, journalContext, meta, ctx, onComplete }) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let fullText = '';
  let sawError = false;
  // Buffer for SSE events that may be split across chunks
  let sseBuffer = '';

  // Helper to process complete SSE events from buffer
  function processCompleteEvents(buffer, isFinal = false) {
    const events = buffer.split(/\r?\n\r?\n/);
    // Keep the last element as potential incomplete event (unless final)
    const remainder = isFinal ? '' : (events.pop() || '');

    for (const eventBlock of events) {
      if (!eventBlock.trim()) continue;

      const lines = eventBlock.split(/\r?\n/);
      let eventType = '';
      let eventData = '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          eventData = line.slice(5).trim();
        }
      }

      // Check for error events
      if (eventType === 'error') {
        sawError = true;
      }

      // Extract text from delta events
      if (eventType === 'delta' && eventData) {
        try {
          const data = JSON.parse(eventData);
          if (data.text) {
            fullText += data.text;
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    return remainder;
  }

  return new ReadableStream({
    async start(controller) {
      // Send initial metadata event
      const metaEvent = formatSSEEvent('meta', {
        turn,
        journalContext,
        ...meta
      });
      controller.enqueue(encoder.encode(metaEvent));

      const reader = stream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // Process any remaining buffered content
            if (sseBuffer.length > 0) {
              processCompleteEvents(sseBuffer, true);
            }

            // Only call completion callback if no error was seen AND we have content
            // This prevents:
            // 1. Users losing follow-up turns due to provider errors
            // 2. Empty responses being tracked when model only made tool calls
            const hasContent = fullText && fullText.trim().length > 0;
            if (onComplete && !sawError && hasContent) {
              // Use waitUntil to guarantee the usage tracking completes
              // even if the client disconnects
              const trackingPromise = onComplete(fullText).catch(err => {
                console.warn('[wrapStreamWithMetadata] onComplete error:', err.message);
              });
              if (ctx?.waitUntil) {
                ctx.waitUntil(trackingPromise);
              }
            } else if (sawError) {
              console.log('[wrapStreamWithMetadata] Skipping usage tracking due to error event');
            } else if (!hasContent) {
              console.log('[wrapStreamWithMetadata] Skipping usage tracking - empty response (tool-only?)');
            }
            controller.close();
            break;
          }

          // Decode the chunk and add to buffer
          const chunk = decoder.decode(value, { stream: true });
          sseBuffer += chunk;

          // Process complete SSE events, keeping any trailing incomplete event
          // This handles events that span multiple chunks (common on slow networks)
          sseBuffer = processCompleteEvents(sseBuffer, false);

          // Pass through the chunk unchanged to the client
          controller.enqueue(value);
        }
      } catch (error) {
        console.error('[wrapStreamWithMetadata] Stream error:', error.message);

        // Send error event
        const errorEvent = formatSSEEvent('error', { message: error.message });
        controller.enqueue(encoder.encode(errorEvent));

        // Do NOT call onComplete on errors - usage should only be tracked for successful responses
        // This prevents users from losing follow-up turns due to server errors

        controller.close();
      } finally {
        reader.releaseLock();
      }
    }
  });
}

/**
 * Format an SSE event string
 */
function formatSSEEvent(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
export { createToolRoundTripStream };
