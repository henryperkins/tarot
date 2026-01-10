/**
 * Follow-Up Questions API Endpoint
 * 
 * POST /api/reading-followup
 * 
 * Enables users to ask questions about their personalized tarot reading
 * after it's generated, with optional journal context integration.
 */

import { validateSession, getSessionFromCookie } from '../lib/auth.js';
import { jsonResponse, readJsonBody } from '../lib/utils.js';
import { buildTierLimitedPayload, isEntitled, getSubscriptionContext } from '../lib/entitlements.js';
import { buildFollowUpPrompt } from '../lib/followUpPrompt.js';
import { findSimilarJournalEntries, getRecurringCardPatterns } from '../lib/journalSearch.js';
import { callAzureResponses } from '../lib/azureResponses.js';

// Rate limits by tier
const FOLLOW_UP_LIMITS = {
  free: { perReading: 1, perDay: 3 },
  plus: { perReading: 3, perDay: 15 },
  pro: { perReading: 10, perDay: 50 }
};

/**
 * Health check endpoint
 */
export const onRequestGet = async ({ env }) => {
  return jsonResponse({
    status: 'ok',
    endpoint: 'reading-followup',
    timestamp: new Date().toISOString()
  });
};

/**
 * Main follow-up question handler
 */
export const onRequestPost = async ({ request, env }) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  console.log(`[${requestId}] === FOLLOW-UP REQUEST START ===`);
  
  try {
    // Auth check
    const cookieHeader = request.headers.get('Cookie');
    const token = getSessionFromCookie(cookieHeader);
    const user = await validateSession(env.DB, token);
    
    if (!user) {
      console.log(`[${requestId}] Unauthenticated request`);
      return jsonResponse({ error: 'Not authenticated' }, { status: 401 });
    }
    
    console.log(`[${requestId}] User authenticated: ${user.id}`);
    
    // Parse request body
    const body = await readJsonBody(request);
    const {
      requestId: readingRequestId,
      followUpQuestion,
      conversationHistory = [],
      readingContext,
      options = {}
    } = body;
    
    // Validate required fields
    if (!followUpQuestion || typeof followUpQuestion !== 'string' || followUpQuestion.trim().length < 3) {
      console.log(`[${requestId}] Invalid follow-up question`);
      return jsonResponse({ error: 'Invalid follow-up question' }, { status: 400 });
    }
    
    if (!readingContext && !readingRequestId) {
      console.log(`[${requestId}] Missing reading context`);
      return jsonResponse({ error: 'Either requestId or readingContext required' }, { status: 400 });
    }
    
    // Get user tier and check limits
    const subscription = getSubscriptionContext(user);
    const tier = subscription.effectiveTier || 'free';
    const limits = FOLLOW_UP_LIMITS[tier] || FOLLOW_UP_LIMITS.free;
    
    console.log(`[${requestId}] User tier: ${tier}, limits: ${JSON.stringify(limits)}`);
    
    // Check per-reading limit
    const turnNumber = conversationHistory.length + 1;
    if (turnNumber > limits.perReading) {
      console.log(`[${requestId}] Per-reading limit exceeded: ${turnNumber}/${limits.perReading}`);
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
    let effectiveContext = readingContext;
    if (readingRequestId) {
      const storedContext = await fetchReadingContext(env, readingRequestId, user.id);
      if (storedContext) {
        effectiveContext = storedContext;
        console.log(`[${requestId}] Loaded stored reading context for ${readingRequestId}`);
      }
    }
    
    // Journal context (Plus+ only)
    let journalContext = null;
    if (options.includeJournalContext && isEntitled(user, 'plus')) {
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
    
    // Build prompt with all context
    const { systemPrompt, userPrompt } = buildFollowUpPrompt({
      originalReading: effectiveContext,
      followUpQuestion: followUpQuestion.trim(),
      conversationHistory,
      journalContext,
      personalization
    });
    
    console.log(`[${requestId}] Prompt built: system=${systemPrompt.length}chars, user=${userPrompt.length}chars`);
    
    // Call LLM
    let responseText;
    let usage = null;
    
    try {
      responseText = await callAzureResponses(env, {
        instructions: systemPrompt,
        input: userPrompt,
        maxTokens: 600,
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
    await trackFollowUpUsage(env.DB, {
      userId: user.id,
      requestId,
      readingRequestId: readingRequestId || null,
      turnNumber,
      questionLength: followUpQuestion.length,
      responseLength: responseText?.length || 0,
      journalContextUsed: Boolean(journalContext),
      patternsFound: journalContext?.patterns?.length || 0
    });
    
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
    
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error(`[${requestId}] Follow-up error after ${latencyMs}ms:`, error.message);
    console.log(`[${requestId}] === FOLLOW-UP REQUEST END (ERROR) ===`);
    return jsonResponse({ error: 'Failed to generate follow-up response' }, { status: 500 });
  }
};

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
    
    // Try METRICS_DB if available
    if (env.METRICS_DB?.get) {
      const metricsKey = `reading:${requestId}`;
      const metricsData = await env.METRICS_DB.get(metricsKey);
      if (metricsData) {
        const parsed = safeJsonParse(metricsData, null);
        if (parsed) {
          return {
            cardsInfo: parsed.cardsInfo || [],
            userQuestion: parsed.userQuestion,
            narrative: parsed.narrative,
            themes: parsed.themes || {},
            spreadKey: parsed.spreadKey,
            deckStyle: parsed.deckStyle
          };
        }
      }
    }
    
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
    // Columns may not exist yet
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
 * Safely parse JSON with fallback
 */
function safeJsonParse(str, fallback) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}
