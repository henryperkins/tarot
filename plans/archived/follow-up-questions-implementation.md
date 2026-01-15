# Follow-Up Questions Feature - Complete Implementation Plan

## Executive Summary

Enable users to ask questions about their personalized tarot reading after it's generated, with optional journal context integration for pattern recognition across readings.

**Target Outcome**: A conversational follow-up experience that extends the reading narrative while leveraging historical journal data for deeper personalized insights.

---

## Phase 1: Foundation (Week 1)

### 1.1 Backend API Endpoint

**File**: `functions/api/reading-followup.js`

```javascript
/**
 * POST /api/reading-followup
 * 
 * Request:
 * {
 *   requestId: string,              // Original reading's request ID
 *   followUpQuestion: string,       // User's question
 *   conversationHistory: Array<{role: string, content: string}>,
 *   readingContext: {               // Passed from client (fallback if no requestId match)
 *     cardsInfo: Array,
 *     userQuestion: string,
 *     narrative: string,
 *     themes: Object,
 *     spreadKey: string,
 *     deckStyle: string
 *   },
 *   options: {
 *     includeJournalContext: boolean,  // Opt-in to cross-reading synthesis
 *     maxJournalEntries: number        // Limit for journal search (default: 3)
 *   }
 * }
 * 
 * Response:
 * {
 *   response: string,               // AI response text
 *   turn: number,                   // Conversation turn number
 *   journalContext?: {              // Present if journal was queried
 *     entriesSearched: number,
 *     patternsFound: Array<{type: string, description: string}>
 *   },
 *   meta: {
 *     provider: string,
 *     latencyMs: number,
 *     tokensUsed: number
 *   }
 * }
 */

import { validateSession, getSessionFromCookie } from '../lib/auth.js';
import { jsonResponse, readJsonBody } from '../lib/utils.js';
import { buildTierLimitedPayload, isEntitled, getEntitlements } from '../lib/entitlements.js';
import { buildFollowUpPrompt } from '../lib/followUpPrompt.js';
import { findSimilarJournalEntries, getRecurringCardPatterns } from '../lib/journalSearch.js';
import { callAzureResponses } from '../lib/azureResponses.js';
import { trackApiUsage } from '../lib/usageTracking.js';

// Rate limits by tier
const FOLLOW_UP_LIMITS = {
  free: { perReading: 1, perDay: 3 },
  plus: { perReading: 3, perDay: 15 },
  pro: { perReading: 10, perDay: 50 }
};

export async function onRequestPost(context) {
  const { request, env } = context;
  const startTime = Date.now();
  
  try {
    // Auth check
    const cookieHeader = request.headers.get('Cookie');
    const token = getSessionFromCookie(cookieHeader);
    const user = await validateSession(env.DB, token);
    
    if (!user) {
      return jsonResponse({ error: 'Not authenticated' }, { status: 401 });
    }
    
    // Parse request
    const body = await readJsonBody(request);
    const {
      requestId,
      followUpQuestion,
      conversationHistory = [],
      readingContext,
      options = {}
    } = body;
    
    // Validate required fields
    if (!followUpQuestion || typeof followUpQuestion !== 'string' || followUpQuestion.trim().length < 3) {
      return jsonResponse({ error: 'Invalid follow-up question' }, { status: 400 });
    }
    
    if (!readingContext && !requestId) {
      return jsonResponse({ error: 'Either requestId or readingContext required' }, { status: 400 });
    }
    
    // Get user tier and check limits
    const entitlements = getEntitlements(user);
    const tier = entitlements.tier || 'free';
    const limits = FOLLOW_UP_LIMITS[tier] || FOLLOW_UP_LIMITS.free;
    
    // Check per-reading limit
    const turnNumber = conversationHistory.length + 1;
    if (turnNumber > limits.perReading) {
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
    if (requestId) {
      const storedContext = await fetchReadingContext(env, requestId, user.id);
      if (storedContext) {
        effectiveContext = storedContext;
      }
    }
    
    // Journal context (Plus+ only)
    let journalContext = null;
    if (options.includeJournalContext && isEntitled(user, 'plus')) {
      journalContext = await buildJournalContext(env, user.id, {
        question: followUpQuestion,
        currentCards: effectiveContext?.cardsInfo?.map(c => c.card) || [],
        maxEntries: options.maxJournalEntries || 3
      });
    }
    
    // Build prompt with all context
    const { systemPrompt, userPrompt } = buildFollowUpPrompt({
      originalReading: effectiveContext,
      followUpQuestion,
      conversationHistory,
      journalContext,
      personalization: user.preferences
    });
    
    // Call LLM
    const response = await callAzureResponses(env, {
      instructions: systemPrompt,
      input: userPrompt,
      maxTokens: 600,
      reasoningEffort: 'low',
      verbosity: 'medium'
    });
    
    // Track usage
    await trackApiUsage(env.DB, {
      userId: user.id,
      endpoint: 'reading-followup',
      requestId: requestId || crypto.randomUUID(),
      tokensUsed: response.usage?.total_tokens || 0
    });
    
    const latencyMs = Date.now() - startTime;
    
    return jsonResponse({
      response: response.text || response,
      turn: turnNumber,
      journalContext: journalContext ? {
        entriesSearched: journalContext.entriesSearched,
        patternsFound: journalContext.patterns
      } : null,
      meta: {
        provider: 'azure-responses',
        latencyMs,
        tokensUsed: response.usage?.total_tokens || null
      }
    });
    
  } catch (error) {
    console.error('Follow-up error:', error);
    return jsonResponse({ error: 'Failed to generate follow-up response' }, { status: 500 });
  }
}

async function getDailyFollowUpCount(db, userId) {
  const today = new Date().toISOString().split('T')[0];
  const result = await db.prepare(`
    SELECT COUNT(*) as count FROM api_usage 
    WHERE user_id = ? AND endpoint = 'reading-followup' 
    AND DATE(created_at) = ?
  `).bind(userId, today).first();
  return result?.count || 0;
}

async function fetchReadingContext(env, requestId, userId) {
  // Try METRICS_DB first (if reading was tracked), then journal_entries
  const journalEntry = await env.DB.prepare(`
    SELECT cards_json, question, narrative, themes_json, spread_key, deck_id
    FROM journal_entries 
    WHERE request_id = ? AND user_id = ?
  `).bind(requestId, userId).first();
  
  if (!journalEntry) return null;
  
  return {
    cardsInfo: JSON.parse(journalEntry.cards_json || '[]'),
    userQuestion: journalEntry.question,
    narrative: journalEntry.narrative,
    themes: JSON.parse(journalEntry.themes_json || '{}'),
    spreadKey: journalEntry.spread_key,
    deckStyle: journalEntry.deck_id
  };
}

async function buildJournalContext(env, userId, options) {
  const { question, currentCards, maxEntries } = options;
  
  // Get recurring card patterns
  const cardPatterns = await getRecurringCardPatterns(env.DB, userId, currentCards);
  
  // Semantic search for similar questions/themes
  const similarEntries = await findSimilarJournalEntries(env, userId, question, {
    limit: maxEntries,
    excludeCards: currentCards // Don't return current reading
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
        date: new Date(e.created_at * 1000).toLocaleDateString(),
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
}
```

### 1.2 Follow-Up Prompt Builder

**File**: `functions/lib/followUpPrompt.js`

```javascript
/**
 * Prompt engineering for follow-up questions
 * Maintains consistency with original reading while enabling deeper exploration
 */

import { TONE_GUIDANCE, FRAME_GUIDANCE } from './narrative/prompts.js';
import { sanitizeDisplayName } from './narrative/styleHelpers.js';

const MAX_NARRATIVE_CONTEXT = 1500;  // Characters to include from original
const MAX_HISTORY_TURNS = 5;

export function buildFollowUpPrompt({
  originalReading,
  followUpQuestion,
  conversationHistory = [],
  journalContext = null,
  personalization = null
}) {
  const displayName = sanitizeDisplayName(personalization?.displayName);
  const toneKey = personalization?.readingTone || 'balanced';
  const frameKey = personalization?.spiritualFrame || 'mixed';
  
  // Build system prompt
  const systemLines = [
    'You are a thoughtful tarot reader continuing a conversation about a reading you have given.',
    '',
    'CORE PRINCIPLES:',
    '- Stay grounded in the cards already drawn—do not introduce new cards or spreads',
    '- Reference specific card names and positions when answering',
    '- Maintain the WHAT/WHY/WHAT\'S NEXT story spine from the original reading',
    '- Keep responses focused and under 200 words unless depth is explicitly requested',
    '- Use second person ("you") and maintain the same warm, supportive tone',
    '- If asked about timing, be honest that tarot offers trajectories, not specific dates',
    '- If the question strays from the reading\'s scope, gently redirect to the cards drawn',
    ''
  ];
  
  // Add tone guidance
  if (TONE_GUIDANCE[toneKey]) {
    systemLines.push('TONE:', TONE_GUIDANCE[toneKey], '');
  }
  
  // Add frame guidance
  if (FRAME_GUIDANCE[frameKey]) {
    systemLines.push('INTERPRETIVE FRAME:', FRAME_GUIDANCE[frameKey], '');
  }
  
  // Add journal context instructions if present
  if (journalContext?.patterns?.length > 0) {
    systemLines.push(
      'JOURNAL CONTEXT:',
      'The querent has a history of readings. Use this context to provide deeper, more personalized insight:',
      ''
    );
    
    journalContext.patterns.forEach(pattern => {
      if (pattern.type === 'recurring_card') {
        systemLines.push(`- ${pattern.description}`);
        if (pattern.contexts?.length > 0) {
          systemLines.push(`  Previous contexts: ${pattern.contexts.join(', ')}`);
        }
      } else if (pattern.type === 'similar_themes') {
        systemLines.push(`- ${pattern.description}`);
      }
    });
    
    systemLines.push(
      '',
      'When referencing past readings:',
      '- Frame connections gently ("This theme has come up before...")',
      '- Highlight growth or evolution in patterns',
      '- Ask reflective questions about past guidance ("How did X unfold for you?")',
      ''
    );
  }
  
  systemLines.push(
    'ETHICS:',
    '- Do not provide medical, mental health, legal, financial, or abuse-safety directives',
    '- Emphasize choice and agency; avoid deterministic language',
    ''
  );
  
  const systemPrompt = systemLines.join('\n');
  
  // Build user prompt with context
  const userLines = [];
  
  // Original reading context
  userLines.push('ORIGINAL READING CONTEXT:');
  
  if (originalReading?.userQuestion) {
    userLines.push(`Question: ${originalReading.userQuestion}`);
  }
  
  if (originalReading?.spreadKey) {
    userLines.push(`Spread: ${originalReading.spreadKey}`);
  }
  
  if (originalReading?.cardsInfo?.length > 0) {
    userLines.push('Cards drawn:');
    originalReading.cardsInfo.slice(0, 10).forEach(card => {
      const orientation = card.orientation || card.isReversed ? 'reversed' : 'upright';
      userLines.push(`  - ${card.position || 'Card'}: ${card.card || card.name} (${orientation})`);
    });
  }
  
  if (originalReading?.narrative) {
    const truncatedNarrative = originalReading.narrative.length > MAX_NARRATIVE_CONTEXT
      ? originalReading.narrative.slice(0, MAX_NARRATIVE_CONTEXT) + '...[truncated]'
      : originalReading.narrative;
    userLines.push('', 'Original narrative excerpt:', truncatedNarrative);
  }
  
  userLines.push('');
  
  // Conversation history
  if (conversationHistory.length > 0) {
    userLines.push('CONVERSATION SO FAR:');
    conversationHistory.slice(-MAX_HISTORY_TURNS).forEach(msg => {
      const role = msg.role === 'user' ? 'Querent' : 'Reader';
      userLines.push(`${role}: ${msg.content}`);
    });
    userLines.push('');
  }
  
  // Current question
  const questionPrefix = displayName ? `${displayName} asks: ` : 'Querent asks: ';
  userLines.push(`NEW QUESTION: ${questionPrefix}${followUpQuestion}`);
  
  const userPrompt = userLines.join('\n');
  
  return { systemPrompt, userPrompt };
}
```

### 1.3 Journal Search Utilities

**File**: `functions/lib/journalSearch.js`

```javascript
/**
 * Semantic search utilities for journal entries
 * Enables pattern recognition across a user's reading history
 */

import { generateEmbeddings } from './coachSuggestion.js';

/**
 * Find journal entries semantically similar to a query
 */
export async function findSimilarJournalEntries(env, userId, query, options = {}) {
  const { limit = 3, minSimilarity = 0.65, excludeCards = [] } = options;
  
  if (!env?.AI || !env?.DB) {
    return [];
  }
  
  // Generate embedding for the query
  const [queryEmbedding] = await generateEmbeddings(env, [query], 'journal-search');
  
  if (!queryEmbedding || queryEmbedding.length === 0) {
    return [];
  }
  
  // Fetch recent entries with embeddings
  const entries = await env.DB.prepare(`
    SELECT 
      id, question, narrative, extracted_steps, step_embeddings, 
      cards_json, spread_key, context, created_at
    FROM journal_entries 
    WHERE user_id = ? AND step_embeddings IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 50
  `).bind(userId).all();
  
  if (!entries?.results?.length) {
    return [];
  }
  
  // Score each entry by semantic similarity
  const scored = entries.results
    .map(entry => {
      try {
        const embeddings = JSON.parse(entry.step_embeddings);
        if (!Array.isArray(embeddings) || embeddings.length === 0) return null;
        
        // Find max similarity across all step embeddings
        const maxSim = Math.max(...embeddings.map(emb => cosineSimilarity(queryEmbedding, emb)));
        
        return {
          id: entry.id,
          question: entry.question,
          narrative: entry.narrative?.slice(0, 300),
          extractedSteps: entry.extracted_steps ? JSON.parse(entry.extracted_steps) : [],
          cards: entry.cards_json ? JSON.parse(entry.cards_json).map(c => c.name || c.card) : [],
          spreadKey: entry.spread_key,
          context: entry.context,
          created_at: entry.created_at,
          similarity: maxSim
        };
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean)
    .filter(e => e.similarity >= minSimilarity);
  
  // Sort by similarity and return top results
  return scored
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Get recurring card patterns for specific cards
 */
export async function getRecurringCardPatterns(db, userId, cardNames) {
  if (!cardNames?.length) return [];
  
  // Query recent entries for card frequency
  const entries = await db.prepare(`
    SELECT cards_json, context, created_at
    FROM journal_entries
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 30
  `).bind(userId).all();
  
  if (!entries?.results?.length) return [];
  
  const cardStats = new Map();
  
  entries.results.forEach(entry => {
    try {
      const cards = JSON.parse(entry.cards_json || '[]');
      cards.forEach(card => {
        const name = card.name || card.card;
        if (!name) return;
        
        if (!cardStats.has(name)) {
          cardStats.set(name, { count: 0, contexts: [], dates: [] });
        }
        
        const stats = cardStats.get(name);
        stats.count++;
        if (entry.context && !stats.contexts.includes(entry.context)) {
          stats.contexts.push(entry.context);
        }
        stats.dates.push(entry.created_at);
      });
    } catch (e) {
      // Skip malformed entries
    }
  });
  
  // Return patterns for requested cards
  return cardNames
    .filter(name => cardStats.has(name) && cardStats.get(name).count >= 2)
    .map(name => ({
      card: name,
      count: cardStats.get(name).count,
      contexts: cardStats.get(name).contexts,
      lastSeen: Math.max(...cardStats.get(name).dates)
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude === 0 ? 0 : dot / magnitude;
}
```

---

## Phase 2: Frontend Components (Week 2)

### 2.1 Suggested Questions Generator

**File**: `src/lib/followUpSuggestions.js`

```javascript
/**
 * Generate contextual follow-up question suggestions based on the reading
 */

export function generateFollowUpSuggestions(reading, themes, readingMeta) {
  const suggestions = [];
  const spreadKey = readingMeta?.spreadKey || 'general';
  
  // 1. Reversed card exploration (high priority)
  const reversedCards = reading?.filter(c => c.isReversed || c.orientation === 'reversed') || [];
  if (reversedCards.length === 1) {
    suggestions.push({
      text: `What does ${reversedCards[0].name || reversedCards[0].card} reversed want me to understand?`,
      type: 'reversal',
      priority: 1
    });
  } else if (reversedCards.length > 1) {
    suggestions.push({
      text: 'What pattern do the reversed cards reveal together?',
      type: 'reversal',
      priority: 1
    });
  }
  
  // 2. Spread-specific questions
  const spreadQuestions = {
    celtic: [
      { text: 'How do the crossing and outcome cards connect?', priority: 2 },
      { text: 'What does the subconscious foundation reveal about this situation?', priority: 3 }
    ],
    threeCard: [
      { text: 'How does the present card bridge past and future?', priority: 2 },
      { text: 'What action bridges where I am and where I\'m heading?', priority: 3 }
    ],
    relationship: [
      { text: 'How can I better understand the other person\'s perspective?', priority: 2 },
      { text: 'What shared ground do these cards suggest?', priority: 3 }
    ],
    decision: [
      { text: 'Which path aligns more with my values?', priority: 2 },
      { text: 'What factor should weigh most in my choice?', priority: 3 }
    ],
    single: [
      { text: 'What specific action does this card suggest for today?', priority: 2 }
    ],
    fiveCard: [
      { text: 'How does the support card help address the challenge?', priority: 2 }
    ]
  };
  
  if (spreadQuestions[spreadKey]) {
    spreadQuestions[spreadKey].forEach(q => {
      suggestions.push({ ...q, type: 'spread' });
    });
  }
  
  // 3. Elemental imbalance
  if (themes?.elementCounts) {
    const elements = Object.entries(themes.elementCounts);
    const dominant = elements.sort(([,a], [,b]) => b - a)[0];
    const missing = elements.filter(([,count]) => count === 0).map(([el]) => el);
    
    if (dominant && dominant[1] >= 3) {
      suggestions.push({
        text: `What does the strong ${dominant[0]} energy suggest I need?`,
        type: 'elemental',
        priority: 3
      });
    }
    
    if (missing.length > 0) {
      suggestions.push({
        text: `What might the absence of ${missing[0]} energy mean?`,
        type: 'elemental',
        priority: 4
      });
    }
  }
  
  // 4. Major Arcana emphasis
  const majorCards = reading?.filter(c => {
    const num = c.number ?? c.arcanaNumber ?? -1;
    return num >= 0 && num <= 21;
  }) || [];
  
  if (majorCards.length >= 3) {
    suggestions.push({
      text: 'What life lesson do these Major Arcana cards emphasize?',
      type: 'archetype',
      priority: 2
    });
  }
  
  // 5. Action-oriented (always include as fallback)
  suggestions.push({
    text: 'What\'s the single most important thing I should focus on?',
    type: 'action',
    priority: 5
  });
  
  suggestions.push({
    text: 'What might be blocking me from moving forward?',
    type: 'shadow',
    priority: 5
  });
  
  // Sort by priority and deduplicate
  return suggestions
    .sort((a, b) => a.priority - b.priority)
    .filter((item, index, self) => 
      index === self.findIndex(t => t.text === item.text)
    )
    .slice(0, 4);
}
```

### 2.2 Follow-Up Section Component

**File**: `src/components/FollowUpSection.jsx`

```jsx
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useReading } from '../contexts/ReadingContext';
import { useAuth } from '../contexts/AuthContext';
import { generateFollowUpSuggestions } from '../lib/followUpSuggestions';
import { ChatCircle, PaperPlaneTilt, Spinner, Lightning, LockSimple } from '@phosphor-icons/react';
import clsx from 'clsx';

const MAX_MESSAGE_LENGTH = 500;
const MAX_VISIBLE_MESSAGES = 10;

export default function FollowUpSection() {
  const { 
    reading, 
    personalReading, 
    themes, 
    readingMeta,
    userQuestion 
  } = useReading();
  const { user, isAuthenticated } = useAuth();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [includeJournal, setIncludeJournal] = useState(true);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  // Generate contextual suggestions
  const suggestions = useMemo(() => 
    generateFollowUpSuggestions(reading, themes, readingMeta),
    [reading, themes, readingMeta]
  );
  
  // Check if user can use journal context (Plus+ tier)
  const canUseJournal = useMemo(() => {
    return user?.subscriptionTier === 'plus' || user?.subscriptionTier === 'pro';
  }, [user]);
  
  // Get follow-up limit based on tier
  const followUpLimit = useMemo(() => {
    if (user?.subscriptionTier === 'pro') return 10;
    if (user?.subscriptionTier === 'plus') return 3;
    return 1;
  }, [user]);
  
  const turnsUsed = messages.filter(m => m.role === 'user').length;
  const canAskMore = turnsUsed < followUpLimit;
  
  // Auto-scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Don't render if no reading
  if (!personalReading || personalReading.isError) return null;
  
  const askFollowUp = useCallback(async (question) => {
    if (!question?.trim() || isLoading || !canAskMore) return;
    
    setError(null);
    setIsLoading(true);
    setInputValue('');
    
    // Add user message immediately
    const userMessage = { role: 'user', content: question.trim() };
    setMessages(prev => [...prev, userMessage]);
    
    try {
      const response = await fetch('/api/reading-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          requestId: readingMeta?.requestId,
          followUpQuestion: question.trim(),
          conversationHistory: messages,
          readingContext: {
            cardsInfo: reading,
            userQuestion,
            narrative: personalReading?.raw || personalReading,
            themes,
            spreadKey: readingMeta?.spreadKey,
            deckStyle: readingMeta?.deckStyle
          },
          options: {
            includeJournalContext: includeJournal && canUseJournal
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to get response');
      }
      
      const data = await response.json();
      
      // Add assistant response
      const assistantMessage = { 
        role: 'assistant', 
        content: data.response,
        journalContext: data.journalContext
      };
      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (err) {
      console.error('Follow-up error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
      // Remove the user message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [
    isLoading, canAskMore, readingMeta, messages, reading, 
    userQuestion, personalReading, themes, includeJournal, canUseJournal
  ]);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    askFollowUp(inputValue);
  };
  
  const handleSuggestionClick = (suggestion) => {
    if (!isLoading && canAskMore) {
      askFollowUp(suggestion.text);
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  
  return (
    <div className="mt-8 border-t border-secondary/30 pt-6">
      {/* Collapsed state - toggle button */}
      <button 
        onClick={() => {
          setIsExpanded(!isExpanded);
          if (!isExpanded) {
            setTimeout(() => inputRef.current?.focus(), 100);
          }
        }}
        className={clsx(
          "flex items-center gap-2 text-accent hover:text-main transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-accent/50 rounded-lg px-2 py-1 -ml-2"
        )}
        aria-expanded={isExpanded}
      >
        <ChatCircle className="w-5 h-5" weight={isExpanded ? 'fill' : 'regular'} />
        <span className="font-medium">
          {isExpanded ? 'Close follow-up questions' : 'Have a question about your reading?'}
        </span>
        {!isExpanded && turnsUsed > 0 && (
          <span className="text-xs text-muted">({turnsUsed}/{followUpLimit} used)</span>
        )}
      </button>
      
      {/* Expanded state */}
      {isExpanded && (
        <div className="mt-4 space-y-4 animate-fadeIn">
          {/* Suggestions (show only if no messages yet) */}
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(suggestion)}
                  disabled={isLoading || !canAskMore}
                  className={clsx(
                    "px-3 py-1.5 text-sm rounded-full border transition-all",
                    "border-accent/30 hover:border-accent hover:bg-accent/10",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "focus:outline-none focus:ring-2 focus:ring-accent/50"
                  )}
                >
                  {suggestion.text}
                </button>
              ))}
            </div>
          )}
          
          {/* Conversation history */}
          {messages.length > 0 && (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2 scroll-smooth">
              {messages.slice(-MAX_VISIBLE_MESSAGES).map((msg, idx) => (
                <div 
                  key={idx} 
                  className={clsx(
                    "flex",
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div className={clsx(
                    "max-w-[85%] px-4 py-2.5 rounded-2xl",
                    msg.role === 'user' 
                      ? 'bg-primary/20 text-main rounded-br-md' 
                      : 'bg-surface-elevated text-main rounded-bl-md'
                  )}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    
                    {/* Journal context indicator */}
                    {msg.journalContext?.patternsFound?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-secondary/20 text-xs text-muted flex items-center gap-1">
                        <Lightning className="w-3 h-3" />
                        <span>Informed by {msg.journalContext.patternsFound.length} journal pattern(s)</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted text-sm">
              <Spinner className="w-4 h-4 animate-spin" />
              <span>Reflecting on your question...</span>
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className="text-error text-sm bg-error/10 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
          
          {/* Input form */}
          {canAskMore ? (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a follow-up question..."
                  disabled={isLoading}
                  className={clsx(
                    "w-full px-4 py-2.5 rounded-xl border transition-all",
                    "border-secondary/40 bg-surface/80",
                    "focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none",
                    "placeholder:text-muted/60",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
                  {inputValue.length}/{MAX_MESSAGE_LENGTH}
                </span>
              </div>
              
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className={clsx(
                  "px-4 py-2.5 bg-accent text-surface rounded-xl transition-all",
                  "hover:bg-accent/90 active:scale-95",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "focus:outline-none focus:ring-2 focus:ring-accent/50"
                )}
              >
                <PaperPlaneTilt className="w-5 h-5" weight="fill" />
              </button>
            </form>
          ) : (
            <div className="text-center text-muted text-sm py-2">
              You've used all {followUpLimit} follow-up question{followUpLimit > 1 ? 's' : ''} for this reading.
              {user?.subscriptionTier !== 'pro' && (
                <button className="ml-2 text-accent hover:underline">
                  Upgrade for more
                </button>
              )}
            </div>
          )}
          
          {/* Journal toggle (Plus+ only) */}
          {canUseJournal && (
            <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={includeJournal}
                onChange={(e) => setIncludeJournal(e.target.checked)}
                className="rounded border-secondary/40 text-accent focus:ring-accent/50"
              />
              <Lightning className="w-3 h-3" />
              <span>Include insights from my journal history</span>
            </label>
          )}
          
          {!canUseJournal && isAuthenticated && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <LockSimple className="w-3 h-3" />
              <span>Upgrade to Plus for journal-powered insights</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### 2.3 ReadingDisplay Integration

**File**: Modify `src/components/ReadingDisplay.jsx`

Add import and component after the narrative section (around line 500):

```jsx
// Add to imports
import FollowUpSection from './FollowUpSection';

// Add after the narrative completion banner (around line 527)
{personalReading && !personalReading.isError && (
  <FollowUpSection />
)}
```

---

## Phase 3: State Management (Week 2)

### 3.1 ReadingContext Enhancement

**File**: Modify `src/contexts/ReadingContext.jsx`

Add follow-up conversation state:

```jsx
// Add to state declarations
const [followUpHistory, setFollowUpHistory] = useState([]);
const [followUpExpanded, setFollowUpExpanded] = useState(false);

// Add to context value
followUpHistory,
setFollowUpHistory,
followUpExpanded,
setFollowUpExpanded,
clearFollowUp: () => {
  setFollowUpHistory([]);
  setFollowUpExpanded(false);
},

// Clear follow-up when starting new reading
useEffect(() => {
  if (readingState === 'drawing') {
    setFollowUpHistory([]);
    setFollowUpExpanded(false);
  }
}, [readingState]);
```

---

## Phase 4: Testing (Week 3)

### 4.1 API Tests

**File**: `tests/readingFollowup.test.mjs`

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { onRequestPost } from '../functions/api/reading-followup.js';

describe('reading-followup API', () => {
  let mockEnv;
  let mockContext;
  
  beforeEach(() => {
    mockEnv = {
      DB: {
        prepare: vi.fn().mockReturnThis(),
        bind: vi.fn().mockReturnThis(),
        first: vi.fn(),
        all: vi.fn(),
        run: vi.fn()
      },
      AI: {
        run: vi.fn()
      }
    };
    
    mockContext = {
      request: {
        json: vi.fn(),
        headers: {
          get: vi.fn().mockReturnValue('session=valid-token')
        }
      },
      env: mockEnv
    };
  });
  
  it('requires authentication', async () => {
    mockContext.request.headers.get.mockReturnValue(null);
    
    const response = await onRequestPost(mockContext);
    expect(response.status).toBe(401);
  });
  
  it('validates follow-up question presence', async () => {
    mockContext.request.json.mockResolvedValue({
      requestId: 'test-123',
      followUpQuestion: ''
    });
    
    const response = await onRequestPost(mockContext);
    expect(response.status).toBe(400);
  });
  
  it('enforces per-reading limits', async () => {
    // Mock user at limit
    mockEnv.DB.first.mockResolvedValue({ count: 3 });
    mockContext.request.json.mockResolvedValue({
      requestId: 'test-123',
      followUpQuestion: 'What about the reversed card?',
      conversationHistory: [{}, {}, {}] // 3 turns already
    });
    
    const response = await onRequestPost(mockContext);
    expect(response.status).toBe(403);
  });
  
  it('returns successful response with journal context', async () => {
    mockEnv.DB.first.mockResolvedValue({ 
      count: 0,
      // ... user data
    });
    mockEnv.DB.all.mockResolvedValue({ results: [] });
    mockEnv.AI.run.mockResolvedValue({ response: 'Test response' });
    
    mockContext.request.json.mockResolvedValue({
      requestId: 'test-123',
      followUpQuestion: 'What about the Tower?',
      conversationHistory: [],
      options: { includeJournalContext: true }
    });
    
    const response = await onRequestPost(mockContext);
    expect(response.status).toBe(200);
    
    const body = await response.json();
    expect(body.response).toBeDefined();
    expect(body.turn).toBe(1);
  });
});
```

### 4.2 Suggestion Generator Tests

**File**: `tests/followUpSuggestions.test.mjs`

```javascript
import { describe, it, expect } from 'vitest';
import { generateFollowUpSuggestions } from '../src/lib/followUpSuggestions.js';

describe('generateFollowUpSuggestions', () => {
  it('generates reversal-focused question for single reversed card', () => {
    const reading = [
      { name: 'The Tower', isReversed: true },
      { name: 'The Star', isReversed: false }
    ];
    
    const suggestions = generateFollowUpSuggestions(reading, {}, {});
    
    const reversalSuggestion = suggestions.find(s => s.type === 'reversal');
    expect(reversalSuggestion).toBeDefined();
    expect(reversalSuggestion.text).toContain('Tower');
  });
  
  it('generates pattern question for multiple reversed cards', () => {
    const reading = [
      { name: 'The Tower', isReversed: true },
      { name: 'The Moon', isReversed: true },
      { name: 'The Star', isReversed: false }
    ];
    
    const suggestions = generateFollowUpSuggestions(reading, {}, {});
    
    const reversalSuggestion = suggestions.find(s => s.type === 'reversal');
    expect(reversalSuggestion.text).toContain('pattern');
  });
  
  it('includes spread-specific questions for Celtic Cross', () => {
    const suggestions = generateFollowUpSuggestions(
      [{ name: 'Card 1' }],
      {},
      { spreadKey: 'celtic' }
    );
    
    const spreadSuggestion = suggestions.find(s => s.type === 'spread');
    expect(spreadSuggestion).toBeDefined();
    expect(spreadSuggestion.text).toContain('crossing');
  });
  
  it('detects elemental imbalance', () => {
    const themes = {
      elementCounts: { Fire: 4, Water: 1, Air: 0, Earth: 1 }
    };
    
    const suggestions = generateFollowUpSuggestions([], themes, {});
    
    const elementalSuggestion = suggestions.find(s => s.type === 'elemental');
    expect(elementalSuggestion).toBeDefined();
    expect(elementalSuggestion.text).toContain('Fire');
  });
  
  it('always includes action-oriented fallback', () => {
    const suggestions = generateFollowUpSuggestions([], {}, {});
    
    const actionSuggestion = suggestions.find(s => s.type === 'action');
    expect(actionSuggestion).toBeDefined();
  });
  
  it('limits suggestions to 4', () => {
    const reading = Array(10).fill(null).map((_, i) => ({
      name: `Card ${i}`,
      isReversed: i % 2 === 0,
      number: i
    }));
    
    const suggestions = generateFollowUpSuggestions(reading, {
      elementCounts: { Fire: 5, Water: 0, Air: 0, Earth: 0 }
    }, { spreadKey: 'celtic' });
    
    expect(suggestions.length).toBeLessThanOrEqual(4);
  });
});
```

### 4.3 E2E Tests

**File**: `e2e/follow-up-questions.spec.js`

```javascript
import { test, expect } from '@playwright/test';

test.describe('Follow-up Questions', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to a completed reading
    await page.goto('/');
    // ... setup steps
  });
  
  test('shows follow-up section after reading completes', async ({ page }) => {
    await expect(page.locator('[data-testid="follow-up-toggle"]')).toBeVisible();
    await expect(page.locator('[data-testid="follow-up-toggle"]')).toContainText('question');
  });
  
  test('expands to show suggestions', async ({ page }) => {
    await page.click('[data-testid="follow-up-toggle"]');
    
    await expect(page.locator('[data-testid="follow-up-suggestions"]')).toBeVisible();
    const suggestions = await page.locator('[data-testid="suggestion-pill"]').count();
    expect(suggestions).toBeGreaterThan(0);
  });
  
  test('submits question and shows response', async ({ page }) => {
    await page.click('[data-testid="follow-up-toggle"]');
    await page.fill('[data-testid="follow-up-input"]', 'What about the reversed card?');
    await page.click('[data-testid="follow-up-submit"]');
    
    // Wait for response
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({ timeout: 30000 });
  });
  
  test('clicking suggestion submits immediately', async ({ page }) => {
    await page.click('[data-testid="follow-up-toggle"]');
    await page.click('[data-testid="suggestion-pill"]:first-child');
    
    // User message should appear
    await expect(page.locator('[data-testid="user-message"]')).toBeVisible();
    
    // Response should follow
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({ timeout: 30000 });
  });
  
  test('enforces free tier limit', async ({ page }) => {
    // Ensure logged in as free user
    await page.click('[data-testid="follow-up-toggle"]');
    
    // Ask one question
    await page.fill('[data-testid="follow-up-input"]', 'First question');
    await page.click('[data-testid="follow-up-submit"]');
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({ timeout: 30000 });
    
    // Should show limit reached
    await expect(page.locator('[data-testid="limit-reached"]')).toBeVisible();
    await expect(page.locator('[data-testid="follow-up-input"]')).toBeDisabled();
  });
});
```

---

## Phase 5: Telemetry & Analytics (Week 3)

### 5.1 Usage Tracking

**File**: Add to `functions/lib/usageTracking.js`

```javascript
// Add follow-up specific tracking
export async function trackFollowUpUsage(db, data) {
  const {
    userId,
    requestId,
    readingRequestId,
    turnNumber,
    questionLength,
    responseLength,
    journalContextUsed,
    patternsFound,
    latencyMs,
    provider
  } = data;
  
  await db.prepare(`
    INSERT INTO follow_up_usage (
      id, user_id, request_id, reading_request_id,
      turn_number, question_length, response_length,
      journal_context_used, patterns_found,
      latency_ms, provider, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    latencyMs,
    provider,
    Math.floor(Date.now() / 1000)
  ).run();
}
```

### 5.2 Database Migration

**File**: `migrations/0020_add_follow_up_usage.sql`

```sql
-- Follow-up question usage tracking
CREATE TABLE IF NOT EXISTS follow_up_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  reading_request_id TEXT,
  turn_number INTEGER NOT NULL DEFAULT 1,
  question_length INTEGER,
  response_length INTEGER,
  journal_context_used INTEGER DEFAULT 0,
  patterns_found INTEGER DEFAULT 0,
  latency_ms INTEGER,
  provider TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_follow_up_user_date 
ON follow_up_usage(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_follow_up_reading 
ON follow_up_usage(reading_request_id);
```

---

## Phase 6: Rollout (Week 4)

### 6.1 Feature Flag

Add to environment configuration:

```javascript
// In wrangler.jsonc or .dev.vars
FEATURE_FOLLOW_UP_ENABLED=true
FEATURE_FOLLOW_UP_JOURNAL_CONTEXT=true
```

### 6.2 Gradual Rollout

1. **Alpha** (Day 1-3): Internal testing only
2. **Beta** (Day 4-7): Pro users only
3. **GA** (Day 8+): All users with tier limits

### 6.3 Documentation

Update user-facing help:

```markdown
## Follow-Up Questions

After your reading is complete, you can ask follow-up questions to explore specific cards or themes in more depth.

### How It Works
- Click "Have a question about your reading?" below your narrative
- Choose a suggested question or type your own
- Get personalized insights based on your specific reading

### Limits by Plan
| Plan | Follow-Ups per Reading |
|------|------------------------|
| Free | 1 |
| Plus | 3 |
| Pro  | 10 |

### Journal-Powered Insights (Plus+ Only)
Enable "Include insights from my journal history" to get responses that reference patterns across your past readings.
```

---

## File Summary

### New Files (10)
| File | Purpose |
|------|---------|
| `functions/api/reading-followup.js` | Main API endpoint |
| `functions/lib/followUpPrompt.js` | Prompt engineering |
| `functions/lib/journalSearch.js` | Semantic search utilities |
| `src/lib/followUpSuggestions.js` | Question generation |
| `src/components/FollowUpSection.jsx` | UI component |
| `tests/readingFollowup.test.mjs` | API tests |
| `tests/followUpSuggestions.test.mjs` | Unit tests |
| `e2e/follow-up-questions.spec.js` | E2E tests |
| `migrations/0020_add_follow_up_usage.sql` | Database migration |
| `docs/follow-up-questions-design.md` | Design document |

### Modified Files (3)
| File | Changes |
|------|---------|
| `src/components/ReadingDisplay.jsx` | Add FollowUpSection import and render |
| `src/contexts/ReadingContext.jsx` | Add follow-up state management |
| `functions/lib/usageTracking.js` | Add follow-up tracking function |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Feature adoption | 30% of completed readings use follow-up | Analytics |
| Engagement depth | Average 1.5 turns per session | Usage tracking |
| User satisfaction | 4+ star rating on follow-up responses | Feedback |
| Conversion lift | 5% increase in Plus upgrades | A/B test |
| Journal context value | 40% of Plus+ users enable journal context | Feature flag tracking |

---

## Timeline Summary

| Week | Phase | Deliverables |
|------|-------|-------------|
| 1 | Foundation | API endpoint, prompt builder, journal search |
| 2 | Frontend | UI components, state management |
| 3 | Testing | Unit tests, E2E tests, telemetry |
| 4 | Rollout | Feature flags, gradual release, documentation |

**Total Estimated Effort**: 4 weeks with 1 engineer
