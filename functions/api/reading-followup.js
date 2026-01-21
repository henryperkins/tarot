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
import { detectCrisisSignals } from '../lib/safetyChecks.js';
import { checkFollowUpSafety, generateSafeFollowUpFallback } from '../lib/evaluation.js';

// Rate limits by tier
const FOLLOW_UP_LIMITS = {
  free: { perReading: 1, perDay: 3 },
  plus: { perReading: 3, perDay: 15 },
  pro: { perReading: 10, perDay: 50 }
};
const DEFAULT_RESERVATION_TTL_SECONDS = 10 * 60;
const MIN_RESERVATION_TTL_SECONDS = 60;
const MAX_RESERVATION_TTL_SECONDS = 60 * 60;

function getReservationTtlSeconds(env) {
  const raw = env?.FOLLOW_UP_RESERVATION_TTL_SECONDS;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(Math.max(parsed, MIN_RESERVATION_TTL_SECONDS), MAX_RESERVATION_TTL_SECONDS);
  }
  return DEFAULT_RESERVATION_TTL_SECONDS;
}

function getReservationHeartbeatSeconds(env, ttlSeconds) {
  const raw = env?.FOLLOW_UP_RESERVATION_HEARTBEAT_SECONDS;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(Math.max(parsed, 10), ttlSeconds);
  }
  const safeTtlSeconds = Number.isFinite(ttlSeconds) && ttlSeconds > 0
    ? ttlSeconds
    : DEFAULT_RESERVATION_TTL_SECONDS;
  return Math.max(30, Math.floor(safeTtlSeconds / 2));
}

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
  let reservationId = null;
  let turnNumber = null;
  let reservationCompleted = false;
  let reservationReleased = false;
  const reservationTtlSeconds = getReservationTtlSeconds(env);
  const reservationHeartbeatSeconds = getReservationHeartbeatSeconds(env, reservationTtlSeconds);

  const releaseReservation = async (reason = 'unknown') => {
    if (!reservationId || reservationReleased || reservationCompleted) return;
    reservationReleased = true;
    try {
      await releaseFollowUpReservation(env.DB, reservationId);
      console.log(`[${requestId}] Released follow-up reservation (${reason})`);
    } catch (error) {
      console.warn(`[${requestId}] Failed to release follow-up reservation:`, error?.message || error);
    }
  };
  
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
      sessionSeed,
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

    // Crisis detection on follow-up question (matches tarot-reading.js pattern)
    const crisisCheck = detectCrisisSignals(followUpQuestion);
    if (crisisCheck.matched) {
      console.warn(`[${requestId}] Crisis signals in follow-up: ${crisisCheck.categories.join(', ')}`);
      // Return a compassionate response that redirects to appropriate resources
      // Note: turnNumber is unknown at this point, so we omit it from the response
      return jsonResponse({
        response: `I can hear that you're going through something really difficult right now. What you're describing deserves more support than a tarot reading can offer.

Please consider reaching out to someone who can really be there for you:
- **Crisis Text Line**: Text HOME to 741741
- **National Suicide Prevention Lifeline**: 988 (US)
- **International Association for Suicide Prevention**: https://www.iasp.info/resources/Crisis_Centres/

Your cards will be here when you're ready. Right now, please take care of yourself. 💙`,
        meta: {
          provider: 'safety-gate',
          crisisCategories: crisisCheck.categories,
          requestId
        }
      });
    }

    // Require either readingRequestId or sessionSeed to identify the reading
    // sessionSeed is available for ALL readings (including old ones without requestId)
    if (!readingRequestId && !sessionSeed) {
      console.log(`[${requestId}] Missing both readingRequestId and sessionSeed`);
      return jsonResponse({ error: 'Either requestId or sessionSeed is required' }, { status: 400 });
    }

    // Use readingRequestId if available, otherwise fall back to sessionSeed
    // This identifier is used for rate limiting, context fetching, and follow-up persistence
    const readingIdentifier = readingRequestId || sessionSeed;
    const identifierType = readingRequestId ? 'requestId' : 'sessionSeed';
    console.log(`[${requestId}] Using ${identifierType}: ${readingIdentifier}`);

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
    const actualTurns = await getPerReadingFollowUpCount(env.DB, user.id, readingIdentifier, {
      ttlSeconds: reservationTtlSeconds
    });
    console.log(`[${requestId}] Server-verified turns used: ${actualTurns}/${limits.perReading}`);

    if (actualTurns >= limits.perReading) {
      console.log(`[${requestId}] Per-reading limit exceeded: ${actualTurns}/${limits.perReading}`);

      // Note: Memory consolidation now happens after each successful follow-up (see onComplete).
      // This redundant call ensures any stragglers are caught if user hits limit on a failed request.
      if (memoryEnabled && readingIdentifier) {
        const consolidationPromise = consolidateSessionMemories(env.DB, user.id, readingIdentifier)
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
    const dailyUsage = await getDailyFollowUpCount(env.DB, user.id, {
      ttlSeconds: reservationTtlSeconds
    });
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
    
    // Fetch original reading context using requestId or sessionSeed
    // Merge stored context with client-provided context (stored wins, client fills gaps)
    let effectiveContext = readingContext;
    const storedContext = await fetchReadingContext(env, {
      requestId: readingRequestId,
      sessionSeed,
      userId: user.id
    });
    if (storedContext) {
      const storedThemes = storedContext?.themes;
      const hasStoredThemes = storedThemes && typeof storedThemes === 'object' && Object.keys(storedThemes).length > 0;
      effectiveContext = {
        cardsInfo: storedContext.cardsInfo?.length ? storedContext.cardsInfo : readingContext?.cardsInfo,
        userQuestion: storedContext.userQuestion || readingContext?.userQuestion,
        narrative: storedContext.narrative || readingContext?.narrative,
        themes: hasStoredThemes ? storedThemes : (readingContext?.themes || {}),
        spreadKey: storedContext.spreadKey || readingContext?.spreadKey,
        deckStyle: storedContext.deckStyle || readingContext?.deckStyle
      };
      console.log(`[${requestId}] Merged stored context for ${readingIdentifier}`);
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
          sessionId: readingIdentifier,
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

    const reservation = await reserveFollowUpSlot(env.DB, {
      userId: user.id,
      requestId,
      readingIdentifier,
      questionLength: followUpQuestion.length,
      limits,
      ttlSeconds: reservationTtlSeconds
    });

    if (!reservation.reserved) {
      const perReadingTurns = await getPerReadingFollowUpCount(env.DB, user.id, readingIdentifier, {
        ttlSeconds: reservationTtlSeconds
      });
      if (perReadingTurns >= limits.perReading) {
        console.log(`[${requestId}] Per-reading limit exceeded on reservation: ${perReadingTurns}/${limits.perReading}`);

        if (memoryEnabled && readingIdentifier) {
          const consolidationPromise = consolidateSessionMemories(env.DB, user.id, readingIdentifier)
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

      const dailyUsage = await getDailyFollowUpCount(env.DB, user.id, {
        ttlSeconds: reservationTtlSeconds
      });
      if (dailyUsage >= limits.perDay) {
        console.log(`[${requestId}] Daily limit exceeded on reservation: ${dailyUsage}/${limits.perDay}`);
        return jsonResponse(
          buildTierLimitedPayload({
            message: `You've reached your daily limit of ${limits.perDay} follow-up questions`,
            user,
            requiredTier: tier === 'free' ? 'plus' : 'pro'
          }),
          { status: 429 }
        );
      }

      console.warn(`[${requestId}] Failed to reserve follow-up slot`);
      return jsonResponse({ error: 'Unable to reserve follow-up slot. Please try again.' }, { status: 503 });
    }

    reservationId = reservation.reservationId;
    turnNumber = Number(reservation.turnNumber);
    if (!Number.isFinite(turnNumber)) {
      const refreshedTurns = await getPerReadingFollowUpCount(env.DB, user.id, readingIdentifier, {
        ttlSeconds: reservationTtlSeconds
      });
      turnNumber = refreshedTurns;
    }
    console.log(`[${requestId}] Reserved follow-up turn: ${turnNumber}/${limits.perReading}`);

    // Check if streaming is requested
    const useStreaming = options.stream === true;

    // Memory tool is available for both streaming and non-streaming (handled via internal streaming round-trip)
    const enableMemoryTool = memoryEnabled;
    const effectiveSystemPrompt = systemPrompt;
    const effectiveUserPrompt = userPrompt;

    let memoryToolCalled = false;
    let consolidationStarted = false;
    const consolidateOnce = () => {
      if (!enableMemoryTool || consolidationStarted || !memoryToolCalled || !readingIdentifier) {
        return Promise.resolve();
      }
      consolidationStarted = true;
      const consolidation = consolidateSessionMemories(env.DB, user.id, readingIdentifier)
        .then(result => {
          if (result.promoted > 0 || result.pruned > 0) {
            console.log(`[${requestId}] Memory consolidation: promoted=${result.promoted}, pruned=${result.pruned}`);
          }
        })
        .catch(err => {
          console.warn(`[${requestId}] Memory consolidation failed:`, err.message);
        });
      return consolidation;
    };
    const scheduleRelease = (reason) => {
      const releasePromise = releaseReservation(reason);
      if (ctx?.waitUntil) {
        ctx.waitUntil(releasePromise);
      }
      return releasePromise;
    };

    if (useStreaming) {
      // === STREAMING PATH ===
      console.log(`[${requestId}] Using streaming response`);
      const heartbeatReservation = createReservationHeartbeat({
        db: env.DB,
        reservationId,
        ctx,
        intervalSeconds: reservationHeartbeatSeconds,
        requestId,
        isActive: () => Boolean(reservationId) && !reservationReleased && !reservationCompleted
      });

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
                const result = await handleMemoryToolCall(env.DB, user.id, readingIdentifier, args);
                if (result.success) {
                  memoryToolCalled = true;
                  const consolidationPromise = consolidateOnce();
                  if (ctx?.waitUntil) {
                    ctx.waitUntil(consolidationPromise);
                  }
                }
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
          onHeartbeat: heartbeatReservation,
          // Usage tracking callback - will be called when stream completes successfully
          onComplete: async (fullText) => {
            const latencyMs = Date.now() - startTime;
            console.log(`[${requestId}] Streaming completed in ${latencyMs}ms, ${fullText.length} chars`);

            // Defensive guard: don't track/persist empty responses (e.g., tool-only)
            if (!fullText || !fullText.trim()) {
              console.log(`[${requestId}] Skipping tracking - empty response`);
              await releaseReservation('empty_response');
              return;
            }

            // Safety check for streaming responses (post-hoc logging for monitoring)
            // Note: For streaming, we can't block after sending, but we log for alerting/analysis
            const safetyCheck = checkFollowUpSafety(fullText);
            if (!safetyCheck.safe) {
              console.error(`[${requestId}] CRITICAL: Streamed unsafe follow-up response: ${safetyCheck.issues.join(', ')}`);
            } else if (safetyCheck.issues.length > 0) {
              console.warn(`[${requestId}] Follow-up safety warnings (streamed): ${safetyCheck.issues.join(', ')}`);
            }

            const trackingPromise = finalizeFollowUpUsage(env.DB, {
              reservationId,
              responseLength: fullText.length,
              journalContextUsed: Boolean(journalContext),
              patternsFound: journalContext?.patterns?.length || 0,
              latencyMs,
              provider: 'azure-responses-stream'
            }).then(result => {
              if (result.updated) {
                reservationCompleted = true;
              } else {
                console.warn(`[${requestId}] Failed to finalize follow-up usage; releasing reservation`);
                return releaseReservation('finalize_failed');
              }
            });

            const persistPromise = canPersistFollowups
              ? persistFollowUpToJournal(env, user.id, {
                  requestId: readingRequestId,
                  sessionSeed
                }, {
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
            const consolidationPromise = consolidateOnce();

            await Promise.allSettled([trackingPromise, persistPromise, consolidationPromise]);
          },
          onError: (info) => scheduleRelease(info?.type || 'stream_error'),
          onEmpty: () => scheduleRelease('empty_response'),
          onCancel: () => scheduleRelease('client_cancel')
        });

        return createSSEResponse(wrappedStream);

      } catch (streamError) {
        console.error(`[${requestId}] Streaming error: ${streamError.message}`);
        const consolidationPromise = consolidateOnce();
        if (ctx?.waitUntil) {
          ctx.waitUntil(consolidationPromise);
        } else {
          await consolidationPromise;
        }
        await scheduleRelease('stream_error');
        return createSSEErrorResponse('Failed to generate response. Please try again.', 503);
      }

    } else {
      // === NON-STREAMING PATH (existing behavior) ===
      let responseText;
      const stopReservationHeartbeat = startReservationHeartbeatTimer({
        db: env.DB,
        reservationId,
        ctx,
        intervalSeconds: reservationHeartbeatSeconds,
        requestId,
        isActive: () => Boolean(reservationId) && !reservationReleased && !reservationCompleted
      });

      try {
        if (enableMemoryTool) {
          const tools = [MEMORY_TOOL_AZURE_RESPONSES_FORMAT];
          const toolStream = await createToolRoundTripStream(env, {
            instructions: effectiveSystemPrompt,
            userInput: effectiveUserPrompt,
            tools,
            maxTokens: 400,
            verbosity: 'medium',
            requestId,
            onToolCall: async (callId, name, args) => {
              if (name === 'save_memory_note') {
                console.log(`[${requestId}] (non-stream) Memory tool called: category=${args?.category || 'unknown'}, len=${args?.text?.length || 0}`);
                const result = await handleMemoryToolCall(env.DB, user.id, readingIdentifier, args);
                if (result.success) {
                  memoryToolCalled = true;
                  const consolidationPromise = consolidateOnce();
                  if (ctx?.waitUntil) {
                    ctx.waitUntil(consolidationPromise);
                  } else {
                    await consolidationPromise;
                  }
                }
                return result;
              }
              return { success: false, message: 'Unknown tool' };
            }
          });
          responseText = await collectFullTextFromSse(toolStream, { requestId });
        } else {
          responseText = await callAzureResponses(env, {
            instructions: effectiveSystemPrompt,
            input: effectiveUserPrompt,
            maxTokens: 400,  // ~250-300 words, aligned with response format guidance
            reasoningEffort: 'low',
            verbosity: 'medium'
          });
        }

        console.log(`[${requestId}] LLM response received: ${responseText?.length || 0} chars`);

        if (!responseText || !responseText.trim()) {
          console.log(`[${requestId}] Empty follow-up response; releasing reservation`);
          await releaseReservation('empty_response');
          return jsonResponse(
            { error: 'Failed to generate response. Please try again.' },
            { status: 503 }
          );
        }

        // Safety gate: check response for critical safety issues
        const safetyCheck = checkFollowUpSafety(responseText);
        if (!safetyCheck.safe) {
          console.warn(`[${requestId}] Follow-up safety gate triggered: ${safetyCheck.issues.join(', ')}`);
          responseText = generateSafeFollowUpFallback(safetyCheck.issues[0]);
        } else if (safetyCheck.issues.length > 0) {
          // Log warnings but allow response through
          console.log(`[${requestId}] Follow-up safety warnings (allowed): ${safetyCheck.issues.join(', ')}`);
        }
      } catch (llmError) {
        console.error(`[${requestId}] LLM error: ${llmError.message}`);
        await releaseReservation('llm_error');
        return jsonResponse(
          { error: 'Failed to generate response. Please try again.' },
          { status: 503 }
        );
      } finally {
        stopReservationHeartbeat();
      }

      // Track usage
      const latencyMs = Date.now() - startTime;
      const trackingPromise = finalizeFollowUpUsage(env.DB, {
        reservationId,
        responseLength: responseText?.length || 0,
        journalContextUsed: Boolean(journalContext),
        patternsFound: journalContext?.patterns?.length || 0,
        latencyMs,
        provider: 'azure-responses'
      }).then(result => {
        if (result.updated) {
          reservationCompleted = true;
        } else {
          console.warn(`[${requestId}] Failed to finalize follow-up usage; releasing reservation`);
          return releaseReservation('finalize_failed');
        }
      });

      const consolidationPromise = consolidateOnce();
      const persistPromise = canPersistFollowups
        ? persistFollowUpToJournal(env, user.id, {
            requestId: readingRequestId,
            sessionSeed
          }, {
            turnNumber,
            question: followUpQuestion,
            answer: responseText,
            journalContext,
            requestId
          })
        : Promise.resolve();

      const combined = Promise.allSettled([trackingPromise, persistPromise, consolidationPromise]);
      if (ctx?.waitUntil) {
        ctx.waitUntil(combined);
      } else {
        await combined;
      }

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
    await releaseReservation('request_error');
    return jsonResponse({ error: 'Failed to generate follow-up response' }, { status: 500 });
  }
};

/**
 * Get count of follow-up questions for a specific reading (server-side tracking)
 * This prevents clients from manipulating conversation history to bypass limits
 *
 * @param {D1Database} db - Database binding
 * @param {string} userId - User ID
 * @param {string} readingIdentifier - Either requestId or sessionSeed
 */
async function getPerReadingFollowUpCount(db, userId, readingIdentifier, options = {}) {
  if (!db || !readingIdentifier) return 0;

  try {
    const nowSeconds = Number.isFinite(options.nowSeconds)
      ? options.nowSeconds
      : Math.floor(Date.now() / 1000);
    const ttlSeconds = Number.isFinite(options.ttlSeconds)
      ? options.ttlSeconds
      : DEFAULT_RESERVATION_TTL_SECONDS;
    const cutoffSeconds = nowSeconds - ttlSeconds;
    // The reading_request_id column stores whichever identifier is used for the reading
    // (requestId for new readings, sessionSeed for old readings without requestId)
    const result = await db.prepare(`
      SELECT COUNT(*) as count FROM follow_up_usage
      WHERE user_id = ? AND reading_request_id = ?
        AND (response_length IS NOT NULL OR COALESCE(reservation_updated_at, created_at) >= ?)
    `).bind(userId, readingIdentifier, cutoffSeconds).first();
    return result?.count || 0;
  } catch (error) {
    console.warn(`[getPerReadingFollowUpCount] Error: ${error.message}`);
    return 0;
  }
}

/**
 * Get count of follow-up questions used today by user
 */
async function getDailyFollowUpCount(db, userId, options = {}) {
  if (!db) return 0;

  try {
    const nowSeconds = Number.isFinite(options.nowSeconds)
      ? options.nowSeconds
      : Math.floor(Date.now() / 1000);
    const ttlSeconds = Number.isFinite(options.ttlSeconds)
      ? options.ttlSeconds
      : DEFAULT_RESERVATION_TTL_SECONDS;
    const cutoffSeconds = nowSeconds - ttlSeconds;
    const today = new Date(nowSeconds * 1000).toISOString().split('T')[0];
    const result = await db.prepare(`
      SELECT COUNT(*) as count FROM follow_up_usage
      WHERE user_id = ? AND DATE(datetime(created_at, 'unixepoch')) = ?
        AND (response_length IS NOT NULL OR COALESCE(reservation_updated_at, created_at) >= ?)
    `).bind(userId, today, cutoffSeconds).first();
    return result?.count || 0;
  } catch (error) {
    console.warn(`[getDailyFollowUpCount] Error: ${error.message}`);
    return 0;
  }
}

/**
 * Reserve a follow-up slot to enforce per-reading and daily limits atomically.
 */
async function reserveFollowUpSlot(db, {
  userId,
  requestId,
  readingIdentifier,
  questionLength,
  limits,
  ttlSeconds,
  nowSeconds
}) {
  if (!db || !userId || !requestId || !readingIdentifier) {
    return { reserved: false, reason: 'missing_input' };
  }

  const reservationId = crypto.randomUUID();
  const safeNowSeconds = Number.isFinite(nowSeconds)
    ? nowSeconds
    : Math.floor(Date.now() / 1000);
  const safeTtlSeconds = Number.isFinite(ttlSeconds)
    ? ttlSeconds
    : DEFAULT_RESERVATION_TTL_SECONDS;
  const cutoffSeconds = safeNowSeconds - safeTtlSeconds;
  const today = new Date(safeNowSeconds * 1000).toISOString().split('T')[0];
  const safeQuestionLength = Number.isFinite(questionLength) ? questionLength : null;
  const reservationUpdatedAt = safeNowSeconds;

  try {
    await db.prepare(`
      DELETE FROM follow_up_usage
      WHERE response_length IS NULL
        AND COALESCE(reservation_updated_at, created_at) < ?
    `).bind(cutoffSeconds).run();

    const result = await db.prepare(`
      WITH per_reading AS (
        SELECT COUNT(*) as count, COALESCE(MAX(turn_number), 0) as max_turn
        FROM follow_up_usage
        WHERE user_id = ? AND reading_request_id = ?
          AND (response_length IS NOT NULL OR COALESCE(reservation_updated_at, created_at) >= ?)
      ),
      per_day AS (
        SELECT COUNT(*) as count
        FROM follow_up_usage
        WHERE user_id = ?
          AND (response_length IS NOT NULL OR COALESCE(reservation_updated_at, created_at) >= ?)
          AND DATE(datetime(created_at, 'unixepoch')) = ?
      )
      INSERT INTO follow_up_usage (
        id, user_id, request_id, reading_request_id,
        turn_number, question_length, response_length,
        journal_context_used, patterns_found, latency_ms, provider, created_at, reservation_updated_at
      )
      SELECT ?, ?, ?, ?, per_reading.max_turn + 1,
        ?, NULL, 0, 0, NULL, NULL, ?, ?
      FROM per_reading, per_day
      WHERE per_reading.count < ? AND per_day.count < ?
    `).bind(
      userId,
      readingIdentifier,
      cutoffSeconds,
      userId,
      cutoffSeconds,
      today,
      reservationId,
      userId,
      requestId,
      readingIdentifier,
      safeQuestionLength,
      safeNowSeconds,
      reservationUpdatedAt,
      limits.perReading,
      limits.perDay
    ).run();

    if ((result?.meta?.changes || 0) === 0) {
      return { reserved: false, reason: 'limit_reached' };
    }

    const row = await db.prepare(`
      SELECT turn_number FROM follow_up_usage WHERE id = ?
    `).bind(reservationId).first();

    return {
      reserved: true,
      reservationId,
      turnNumber: row?.turn_number
    };
  } catch (error) {
    console.warn(`[reserveFollowUpSlot] Error: ${error.message}`);
    return { reserved: false, reason: 'db_error' };
  }
}

/**
 * Finalize a reserved follow-up slot with response metadata.
 */
async function finalizeFollowUpUsage(db, {
  reservationId,
  responseLength,
  journalContextUsed,
  patternsFound,
  latencyMs,
  provider
}) {
  if (!db || !reservationId) return { updated: false };

  const safeResponseLength = Number.isFinite(responseLength) ? responseLength : null;
  const safePatternsFound = Number.isFinite(patternsFound) ? patternsFound : 0;
  const safeLatencyMs = Number.isFinite(latencyMs) ? latencyMs : null;
  const safeProvider = typeof provider === 'string' ? provider : null;

  try {
    const result = await db.prepare(`
      UPDATE follow_up_usage
      SET response_length = ?, journal_context_used = ?, patterns_found = ?, latency_ms = ?, provider = ?
      WHERE id = ?
    `).bind(
      safeResponseLength,
      journalContextUsed ? 1 : 0,
      safePatternsFound,
      safeLatencyMs,
      safeProvider,
      reservationId
    ).run();

    return { updated: (result?.meta?.changes || 0) > 0 };
  } catch (error) {
    console.warn(`[finalizeFollowUpUsage] Error: ${error.message}`);
    return { updated: false };
  }
}

/**
 * Refresh a pending follow-up reservation timestamp to keep TTL active.
 */
async function touchFollowUpReservation(db, reservationId, options = {}) {
  if (!db || !reservationId) return { updated: false };

  const nowSeconds = Number.isFinite(options.nowSeconds)
    ? options.nowSeconds
    : Math.floor(Date.now() / 1000);

  try {
    const result = await db.prepare(`
      UPDATE follow_up_usage
      SET reservation_updated_at = ?
      WHERE id = ? AND response_length IS NULL
    `).bind(nowSeconds, reservationId).run();

    return { updated: (result?.meta?.changes || 0) > 0 };
  } catch (error) {
    console.warn(`[touchFollowUpReservation] Error: ${error.message}`);
    return { updated: false };
  }
}

function createReservationHeartbeat({ db, reservationId, ctx, intervalSeconds, requestId, isActive }) {
  const safeIntervalSeconds = Number.isFinite(intervalSeconds) && intervalSeconds > 0
    ? intervalSeconds
    : DEFAULT_RESERVATION_TTL_SECONDS / 2;
  const intervalMs = safeIntervalSeconds * 1000;
  let lastHeartbeatMs = 0;

  return () => {
    if (!db || !reservationId || (isActive && !isActive())) return;
    const nowMs = Date.now();
    if (nowMs - lastHeartbeatMs < intervalMs) {
      return;
    }
    lastHeartbeatMs = nowMs;
    const heartbeatPromise = touchFollowUpReservation(db, reservationId, {
      nowSeconds: Math.floor(nowMs / 1000)
    }).catch(error => {
      console.warn(`[${requestId}] Failed to refresh follow-up reservation:`, error?.message || error);
    });
    if (ctx?.waitUntil) {
      ctx.waitUntil(heartbeatPromise);
    }
  };
}

function startReservationHeartbeatTimer({ db, reservationId, ctx, intervalSeconds, requestId, isActive }) {
  if (!db || !reservationId) {
    return () => {};
  }
  const heartbeat = createReservationHeartbeat({
    db,
    reservationId,
    ctx,
    intervalSeconds,
    requestId,
    isActive
  });
  const safeIntervalSeconds = Number.isFinite(intervalSeconds) && intervalSeconds > 0
    ? intervalSeconds
    : DEFAULT_RESERVATION_TTL_SECONDS / 2;
  const intervalMs = safeIntervalSeconds * 1000;
  heartbeat();
  const timer = setInterval(heartbeat, intervalMs);
  return () => clearInterval(timer);
}

/**
 * Release a pending follow-up reservation so it doesn't count against limits.
 */
async function releaseFollowUpReservation(db, reservationId) {
  if (!db || !reservationId) return { released: false };

  try {
    const result = await db.prepare(`
      DELETE FROM follow_up_usage
      WHERE id = ? AND response_length IS NULL
    `).bind(reservationId).run();
    return { released: (result?.meta?.changes || 0) > 0 };
  } catch (error) {
    console.warn(`[releaseFollowUpReservation] Error: ${error.message}`);
    return { released: false };
  }
}

/**
 * Fetch reading context from journal using requestId or sessionSeed
 *
 * @param {Object} env - Environment bindings
 * @param {Object} identifiers - Reading identifiers
 * @param {string} identifiers.requestId - Request ID (preferred, may be null for old readings)
 * @param {string} identifiers.sessionSeed - Session seed (always available)
 * @param {string} identifiers.userId - User ID for authorization
 */
async function fetchReadingContext(env, { requestId, sessionSeed, userId }) {
  if (!env?.DB) return null;

  try {
    let journalEntry = null;

    // Try request_id first (most specific, but may be null for old entries)
    if (requestId) {
      journalEntry = await env.DB.prepare(`
        SELECT cards_json, question, narrative, themes_json, spread_key, deck_id
        FROM journal_entries
        WHERE request_id = ? AND user_id = ?
      `).bind(requestId, userId).first();
    }

    // Fall back to session_seed (available for all entries, has unique index)
    if (!journalEntry && sessionSeed) {
      journalEntry = await env.DB.prepare(`
        SELECT cards_json, question, narrative, themes_json, spread_key, deck_id
        FROM journal_entries
        WHERE session_seed = ? AND user_id = ?
      `).bind(sessionSeed, userId).first();
    }

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
 * Persist a follow-up turn to the matching journal entry (if it exists).
 *
 * @param {Object} env - Environment bindings
 * @param {string} userId - User ID
 * @param {Object} identifiers - Reading identifiers
 * @param {string} identifiers.requestId - Request ID (may be null for old readings)
 * @param {string} identifiers.sessionSeed - Session seed (always available)
 * @param {Object} followUp - Follow-up data to persist
 */
async function persistFollowUpToJournal(env, userId, identifiers, followUp) {
  const { requestId, sessionSeed } = identifiers || {};
  if (!env?.DB || !userId || (!requestId && !sessionSeed)) return;

  try {
    let entry = null;

    // Try request_id first
    if (requestId) {
      entry = await env.DB.prepare(`
        SELECT id FROM journal_entries WHERE user_id = ? AND request_id = ?
      `).bind(userId, requestId).first();
    }

    // Fall back to session_seed
    if (!entry && sessionSeed) {
      entry = await env.DB.prepare(`
        SELECT id FROM journal_entries WHERE user_id = ? AND session_seed = ?
      `).bind(userId, sessionSeed).first();
    }

    if (!entry?.id) return;

    await insertFollowUps(env.DB, userId, entry.id, [followUp], {
      readingRequestId: requestId || sessionSeed,
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
  let reader = null;
  let contReader = null;
  let cancelled = false;

  return new ReadableStream({
    async start(controller) {
      let initialText = '';
      let continuationText = '';
      let initialDoneText = null;
      let continuationDoneText = null;
      const toolCalls = [];
      const toolCallArgs = new Map();
      let currentCallId = null;

      const processAzureChunk = (chunkText, { emitDeltas, isFinal = false }) => {
        if (cancelled) {
          return { remainder: '', closed: true };
        }
        const events = chunkText.split(/\r?\n\r?\n/);
        let remainder = events.pop() || '';
        if (isFinal && remainder.trim()) {
          events.push(remainder);
          remainder = '';
        }
        let deltaText = '';
        let doneText = null;

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
            const delta = typeof parsed.delta === 'string' ? parsed.delta : (parsed.text || '');
            if (delta) {
              if (emitDeltas) {
                if (!cancelled) {
                  controller.enqueue(encoder.encode(formatSSEEvent('delta', { text: delta })));
                }
              }
              deltaText += delta;
            }
          } else if (dataType === 'response.output_text.done') {
            if (typeof parsed.text === 'string' && parsed.text.length > 0) {
              doneText = parsed.text;
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
          } else if (dataType === 'response.error' || dataType === 'error') {
            const errorMsg = parsed?.error?.message || parsed?.message || 'Unknown error';
            if (!cancelled) {
              controller.enqueue(encoder.encode(formatSSEEvent('error', { message: errorMsg })));
              controller.close();
            }
            return { remainder: '', closed: true };
          }
        }

        return { remainder, deltaText, doneText };
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
        if (!cancelled) {
          controller.enqueue(encoder.encode(formatSSEEvent('error', { message: err?.message || 'Failed to start stream' })));
          controller.close();
        }
        return;
      }

      reader = azureStream.getReader();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (cancelled) return;

          buffer += decoder.decode(value, { stream: true });
          const result = processAzureChunk(buffer, { emitDeltas: true });
          if (result?.closed) {
            return;
          }

          initialText += result?.deltaText || '';
          if (typeof result?.doneText === 'string' && result.doneText.length > 0) {
            initialDoneText = result.doneText;
          }
          buffer = result.remainder || '';
        }
        const finalChunk = decoder.decode();
        if (finalChunk) {
          buffer += finalChunk;
        }
        if (buffer.length > 0) {
          const finalResult = processAzureChunk(buffer, { emitDeltas: true, isFinal: true });
          if (finalResult?.closed) {
            return;
          }
          initialText += finalResult?.deltaText || '';
          if (typeof finalResult?.doneText === 'string' && finalResult.doneText.length > 0) {
            initialDoneText = finalResult.doneText;
          }
        }
      } finally {
        reader?.releaseLock();
      }

      console.log(`[${requestId}] Initial stream completed: text=${initialText.length} chars, toolCalls=${toolCalls.length}`);

      if (typeof initialDoneText === 'string' && initialDoneText.length > 0) {
        initialText = initialDoneText;
      }

      if (toolCalls.length === 0) {
        const isEmpty = !initialText || !initialText.trim();
        if (!cancelled) {
          controller.enqueue(encoder.encode(formatSSEEvent('done', { fullText: initialText, isEmpty })));
          controller.close();
        }
        return;
      }

      console.log(`[${requestId}] Executing ${toolCalls.length} tool call(s)`);
      if (cancelled) return;
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

      const conversation = buildToolContinuationConversation(userInput, toolCalls, toolResults, initialText);
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
        if (!cancelled) {
          controller.enqueue(encoder.encode(formatSSEEvent('error', { message: err?.message || 'Continuation request failed' })));
          controller.close();
        }
        return;
      }

      contReader = continuationStream.getReader();
      buffer = '';

      try {
        while (true) {
          const { done, value } = await contReader.read();
          if (done) break;
          if (cancelled) return;

          buffer += decoder.decode(value, { stream: true });
          const result = processAzureChunk(buffer, { emitDeltas: true });
          if (result?.closed) {
            return;
          }

          continuationText += result?.deltaText || '';
          if (typeof result?.doneText === 'string' && result.doneText.length > 0) {
            continuationDoneText = result.doneText;
          }
          buffer = result.remainder || '';
        }
        const finalChunk = decoder.decode();
        if (finalChunk) {
          buffer += finalChunk;
        }
        if (buffer.length > 0) {
          const finalResult = processAzureChunk(buffer, { emitDeltas: true, isFinal: true });
          if (finalResult?.closed) {
            return;
          }
          continuationText += finalResult?.deltaText || '';
          if (typeof finalResult?.doneText === 'string' && finalResult.doneText.length > 0) {
            continuationDoneText = finalResult.doneText;
          }
        }
      } finally {
        contReader?.releaseLock();
      }

      if (typeof continuationDoneText === 'string' && continuationDoneText.length > 0) {
        continuationText = continuationDoneText;
      }

      const fullText = `${initialText}${continuationText}`;
      const isEmpty = !fullText || !fullText.trim();
      if (!cancelled) {
        controller.enqueue(encoder.encode(formatSSEEvent('done', { fullText, isEmpty })));
        controller.close();
      }
    },
    cancel(reason) {
      cancelled = true;
      const cancellations = [];
      if (reader) {
        cancellations.push(reader.cancel(reason).catch(() => null));
      }
      if (contReader) {
        cancellations.push(contReader.cancel(reason).catch(() => null));
      }
      return Promise.allSettled(cancellations);
    }
  });
}

/**
 * Collect the full text from an internal SSE stream (used for non-streaming memory path)
 *
 * @param {ReadableStream} stream
 * @param {Object} options
 * @param {string} options.requestId
 * @returns {Promise<string>}
 */
async function collectFullTextFromSse(stream, { requestId } = {}) {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let buffer = '';
  let fullText = '';
  let doneText = null;
  let errorMessage = null;

  const processBuffer = (isFinal = false) => {
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = isFinal ? '' : (events.pop() || '');

    for (const eventBlock of events) {
      if (!eventBlock.trim()) continue;
      let eventType = '';
      let eventData = '';

      for (const line of eventBlock.split(/\r?\n/)) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          eventData += line.slice(5).trim();
        }
      }

      if (!eventType && !eventData) continue;

      let parsed = {};
      try {
        parsed = eventData ? JSON.parse(eventData) : {};
      } catch (err) {
        console.warn(`[${requestId}] Failed to parse SSE event`, err?.message || err);
      }

      if (eventType === 'delta' && parsed.text) {
        fullText += parsed.text;
      } else if (eventType === 'done') {
        if (typeof parsed.fullText === 'string') {
          doneText = parsed.fullText;
        }
      } else if (eventType === 'error') {
        errorMessage = parsed.message || 'Unknown error';
      }
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      processBuffer(false);
      if (errorMessage) break;
    }
    buffer += decoder.decode();
    processBuffer(true);
  } finally {
    reader.releaseLock();
  }

  if (errorMessage) {
    throw new Error(errorMessage);
  }

  return doneText ?? fullText;
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
 * @param {Function} [options.onError] - Callback(info) on error events
 * @param {Function} [options.onEmpty] - Callback() when stream ends without content
 * @param {Function} [options.onCancel] - Callback(info) when stream is cancelled
 * @param {Function} [options.onHeartbeat] - Callback(info) on progress events
 * @returns {ReadableStream} Wrapped SSE stream
 */
function wrapStreamWithMetadata(stream, {
  turn,
  journalContext,
  meta,
  ctx,
  onComplete,
  onError,
  onEmpty,
  onCancel,
  onHeartbeat
}) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let fullText = '';
  let doneText = null;
  let sawError = false;
  let completionHandled = false;
  let errorNotified = false;
  // Buffer for SSE events that may be split across chunks
  let sseBuffer = '';
  let reader = null;
  let cancelled = false;

  const invokeOnce = (callback, info, label) => {
    if (!callback || completionHandled) return;
    completionHandled = true;
    try {
      const result = callback(info);
      if (result?.catch) {
        result.catch(err => {
          console.warn(`[wrapStreamWithMetadata] ${label} error:`, err?.message || err);
        });
      }
    } catch (error) {
      console.warn(`[wrapStreamWithMetadata] ${label} error:`, error?.message || error);
    }
  };

  const invokeSafely = (callback, info, label) => {
    if (!callback) return;
    try {
      const result = callback(info);
      if (result?.catch) {
        result.catch(err => {
          console.warn(`[wrapStreamWithMetadata] ${label} error:`, err?.message || err);
        });
      }
    } catch (error) {
      console.warn(`[wrapStreamWithMetadata] ${label} error:`, error?.message || error);
    }
  };

  // Helper to process complete SSE events from buffer
  function processCompleteEvents(buffer, isFinal = false) {
    const events = buffer.split(/\r?\n\r?\n/);
    // Keep the last element as potential incomplete event (unless final)
    const remainder = isFinal ? '' : (events.pop() || '');
    let sawActivity = false;

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
        if (!errorNotified) {
          errorNotified = true;
          let message = null;
          try {
            const parsed = JSON.parse(eventData || '{}');
            message = parsed?.message || null;
          } catch {
            message = null;
          }
          invokeOnce(onError, { type: 'error_event', message }, 'onError');
        }
      }

      // Extract text from delta events
      if (eventType === 'delta' && eventData) {
        try {
          const data = JSON.parse(eventData);
          if (data.text) {
            fullText += data.text;
            sawActivity = true;
          }
        } catch {
          // Ignore parse errors
        }
      }

      if (eventType === 'done' && eventData) {
        try {
          const data = JSON.parse(eventData);
          if (typeof data.fullText === 'string') {
            doneText = data.fullText;
            sawActivity = true;
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    if (typeof doneText === 'string') {
      const doneHasContent = doneText.trim().length > 0;
      const fullHasContent = fullText && fullText.trim().length > 0;
      if (doneHasContent || !fullHasContent) {
        fullText = doneText;
      }
    }

    if (sawActivity && !cancelled && !sawError) {
      invokeSafely(onHeartbeat, { fullTextLength: fullText.length }, 'onHeartbeat');
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

      reader = stream.getReader();

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
            if (!cancelled && onComplete && !sawError && hasContent) {
              completionHandled = true;
              // Use waitUntil to guarantee the usage tracking completes
              // even if the client disconnects
              const trackingPromise = onComplete(fullText).catch(err => {
                console.warn('[wrapStreamWithMetadata] onComplete error:', err.message);
              });
              if (ctx?.waitUntil) {
                ctx.waitUntil(trackingPromise);
              }
            } else if (sawError) {
              if (!errorNotified) {
                invokeOnce(onError, { type: 'error_event' }, 'onError');
              }
              console.log('[wrapStreamWithMetadata] Skipping usage tracking due to error event');
            } else if (!hasContent) {
              if (!cancelled) {
                invokeOnce(onEmpty, null, 'onEmpty');
              }
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
        if (cancelled) {
          return;
        }
        console.error('[wrapStreamWithMetadata] Stream error:', error.message);
        invokeOnce(onError, { type: 'stream_error', message: error.message }, 'onError');

        // Send error event
        const errorEvent = formatSSEEvent('error', { message: error.message });
        controller.enqueue(encoder.encode(errorEvent));

        // Do NOT call onComplete on errors - usage should only be tracked for successful responses
        // This prevents users from losing follow-up turns due to server errors

        controller.close();
      } finally {
        reader?.releaseLock();
      }
    },
    cancel(reason) {
      cancelled = true;
      const message = typeof reason === 'string' ? reason : (reason?.message || 'cancelled');
      invokeOnce(onCancel || onError, { type: 'cancel', message }, 'onCancel');
      if (reader) {
        reader.cancel(reason).catch(() => null);
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
export {
  createToolRoundTripStream,
  wrapStreamWithMetadata,
  getPerReadingFollowUpCount,
  getDailyFollowUpCount,
  reserveFollowUpSlot,
  finalizeFollowUpUsage,
  releaseFollowUpReservation,
  touchFollowUpReservation
};
