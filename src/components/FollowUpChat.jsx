/**
 * FollowUpChat Component
 *
 * Reusable chat body for follow-up questions about a tarot reading.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ChatCircle, PaperPlaneTilt, SpinnerGap, Lightning, Lock, CaretDown, X } from '@phosphor-icons/react';
import { useReading } from '../contexts/ReadingContext';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { generateFollowUpSuggestions } from '../lib/followUpSuggestions';
import { MarkdownRenderer } from './MarkdownRenderer';
import { SPREADS } from '../data/spreads';
import clsx from 'clsx';

const MAX_MESSAGE_LENGTH = 500;

// Tier-based follow-up limits (matches backend)
const FOLLOW_UP_LIMITS = {
  free: 1,
  plus: 3,
  pro: 10
};

export default function FollowUpChat({
  variant = 'panel',
  isActive = true,
  titleId = 'follow-up-chat-title',
  onClose,
  onMinimize,
  showHeader = true,
  className = ''
}) {
  const {
    reading,
    personalReading,
    themes,
    readingMeta,
    userQuestion,
    sessionSeed,
    selectedSpread,
    followUps,
    setFollowUps
  } = useReading();
  const { isAuthenticated } = useAuth();
  const { effectiveTier } = useSubscription();

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [includeJournal, setIncludeJournal] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [serverTurn, setServerTurn] = useState(null); // Synced from meta.turn
  const [isAtBottom, setIsAtBottom] = useState(true);

  const messagesEndRef = useRef(null);
  const conversationRef = useRef(null);
  const inputRef = useRef(null);
  const isDock = variant === 'dock';
  const isDrawer = variant === 'drawer';

  // Generate contextual suggestions
  const suggestions = useMemo(() =>
    generateFollowUpSuggestions(reading, themes, readingMeta),
    [reading, themes, readingMeta]
  );

  // Check if user can use journal context (Plus+ tier)
  const canUseJournal = useMemo(() => {
    return effectiveTier === 'plus' || effectiveTier === 'pro';
  }, [effectiveTier]);

  // Get follow-up limit based on tier
  const followUpLimit = useMemo(() => {
    return FOLLOW_UP_LIMITS[effectiveTier] || FOLLOW_UP_LIMITS.free;
  }, [effectiveTier]);

  // Use server turn count when available, fall back to local message count
  const localTurns = messages.filter(m => m.role === 'user').length;
  const turnsUsed = serverTurn !== null ? serverTurn : localTurns;
  const canAskMore = turnsUsed < followUpLimit;
  const hasValidReading = Boolean(personalReading) && !personalReading.isError && !personalReading.isStreaming;

  const upsertFollowUp = useCallback((payload) => {
    const question = payload?.question?.trim();
    const answer = payload?.answer?.trim();
    if (!question || !answer) return;

    setFollowUps((prev) => {
      const current = Array.isArray(prev) ? [...prev] : [];
      const turnNumber = Number.isFinite(payload?.turnNumber) ? Number(payload.turnNumber) : null;
      const existingIndex = current.findIndex((item) => {
        if (turnNumber && item?.turnNumber === turnNumber) return true;
        return item?.question === question && item?.answer === answer;
      });

      const normalized = {
        question,
        answer,
        turnNumber: turnNumber || (current.length + 1),
        journalContext: payload?.journalContext || null,
        createdAt: payload?.createdAt || Date.now()
      };

      if (existingIndex >= 0) {
        current[existingIndex] = { ...current[existingIndex], ...normalized };
      } else {
        current.push(normalized);
      }

      return current;
    });
  }, [setFollowUps]);

  // Reset chat state when reading changes (prevents stale context leaking across readings)
  // Use requestId as primary signal, sessionSeed as fallback for offline/error paths
  const resetKey = readingMeta?.requestId || sessionSeed || null;
  const prevResetKeyRef = useRef(resetKey);
  const followUpsKeyRef = useRef(resetKey);

  // Track which reading the current follow-ups belong to.
  useEffect(() => {
    if (Array.isArray(followUps) && followUps.length > 0) {
      // IMPORTANT: do not bind follow-ups to a *new* resetKey during the brief window
      // where a reading has changed but stale followUps haven't been cleared yet.
      // Using prevResetKeyRef keeps the association stable and avoids accidental carryover.
      followUpsKeyRef.current = prevResetKeyRef.current;
    }
  }, [followUps]);

  useEffect(() => {
    if (prevResetKeyRef.current !== resetKey && resetKey !== null) {
      // Reading changed - clear all chat state
      setMessages([]);
      setError(null);
      setInputValue('');
      setShowSuggestions(false);
      setServerTurn(null); // Reset server turn on new reading
      setIsAtBottom(true);
      const preserveFollowUps =
        Array.isArray(followUps) &&
        followUps.length > 0 &&
        followUpsKeyRef.current === resetKey;
      if (!preserveFollowUps) {
        setFollowUps([]);
      }
      prevResetKeyRef.current = resetKey;
    }
  }, [resetKey, followUps, setFollowUps]);

  // Hydrate chat history from journal follow-ups when available.
  useEffect(() => {
    if (!Array.isArray(followUps) || followUps.length === 0) return;
    if (messages.length > 0) return;

    const hydratedMessages = [];
    const turnNumbers = [];

    followUps.forEach((turn, idx) => {
      const turnNumber = Number.isFinite(turn?.turnNumber) ? Number(turn.turnNumber) : idx + 1;
      turnNumbers.push(turnNumber);
      if (turn?.question) {
        hydratedMessages.push({
          id: `followup-${turnNumber}-q`,
          role: 'user',
          content: turn.question
        });
      }
      if (turn?.answer) {
        hydratedMessages.push({
          id: `followup-${turnNumber}-a`,
          role: 'assistant',
          content: turn.answer,
          journalContext: turn?.journalContext || null
        });
      }
    });

    if (hydratedMessages.length > 0) {
      setMessages(hydratedMessages);
      setShowSuggestions(false);
      setIsAtBottom(true);
      const maxTurn = turnNumbers.length ? Math.max(...turnNumbers) : followUps.length;
      setServerTurn(maxTurn);
    }
  }, [followUps, messages.length]);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
    }
  }, []);

  const hasStreamingMessage = useMemo(
    () => messages.some(msg => msg.isStreaming),
    [messages]
  );

  // Auto-scroll to latest message (only if user is at the bottom)
  useEffect(() => {
    if (!isAtBottom || messages.length === 0) return;
    scrollToBottom(hasStreamingMessage ? 'auto' : 'smooth');
  }, [messages, isAtBottom, hasStreamingMessage, scrollToBottom]);

  // Focus input when panel becomes active
  useEffect(() => {
    if (!isActive || isDrawer) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [isActive, isDrawer]);

  const askFollowUp = useCallback(async (question) => {
    const trimmedQuestion = question?.trim();
    if (!trimmedQuestion || isLoading || !canAskMore || !hasValidReading) return;
    if (!isAuthenticated) {
      setError('Please sign in to ask follow-up questions.');
      return;
    }

    // Validate that we have an identifier to associate with the follow-up
    // Either requestId (new readings) or sessionSeed (all readings including old ones)
    if (!readingMeta?.requestId && !sessionSeed) {
      setError('Unable to link follow-up to this reading. Please generate a new reading first.');
      return;
    }

    setError(null);
    setIsLoading(true);
    setInputValue('');
    setShowSuggestions(false);
    setIsAtBottom(true);

    // Add user message immediately
    const userMessage = { role: 'user', content: trimmedQuestion };
    setMessages(prev => [...prev, userMessage]);

    // Add placeholder assistant message for streaming
    const assistantMessageId = Date.now();
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '',
      isStreaming: true,
      id: assistantMessageId
    }]);

    try {
      const response = await fetch('/api/reading-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          requestId: readingMeta?.requestId,
          sessionSeed,
          followUpQuestion: trimmedQuestion,
          conversationHistory: messages,
          readingContext: {
            // Enrich cards with position labels for better follow-up context
            cardsInfo: reading?.map((card, idx) => {
              const spread = SPREADS[readingMeta?.spreadKey || selectedSpread];
              const position = spread?.positions?.[idx] || `Card ${idx + 1}`;
              return { ...card, position };
            }),
            userQuestion,
            narrative: personalReading?.raw || (typeof personalReading === 'string' ? personalReading : ''),
            themes,
            spreadKey: readingMeta?.spreadKey,
            deckStyle: readingMeta?.deckStyle
          },
          options: {
            includeJournalContext: includeJournal && canUseJournal,
            stream: true
          }
        })
      });

      // Check for non-streaming error responses
      const contentType = response.headers.get('content-type') || '';
      const isSSE = contentType.includes('text/event-stream');

      if (!response.ok && !isSSE) {
        // Non-SSE error response - parse as JSON
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
          throw new Error('Please sign in to ask follow-up questions.');
        }
        if (response.status === 403) {
          // Lock input immediately - server says limit reached
          setServerTurn(followUpLimit);
          throw new Error(errorData.message || 'You\'ve reached your follow-up limit for this reading.');
        }
        if (response.status === 429) {
          // Lock input immediately - daily limit reached
          setServerTurn(followUpLimit);
          throw new Error(errorData.message || 'Daily follow-up limit reached. Try again tomorrow.');
        }

        throw new Error(errorData.message || errorData.error || 'Failed to get response');
      }

      if (!isSSE) {
        // Not SSE content-type - unexpected format
        throw new Error('Unexpected response format');
      }

      // Process SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamedText = '';
      let journalContext = null;
      let resolvedTurn = null;
      let followUpPersisted = false;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const eventBlock of events) {
          if (!eventBlock.trim()) continue;

          const lines = eventBlock.split('\n');
          let eventType = '';
          let eventData = '';

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              eventData = line.slice(5).trim();
            }
          }

          if (!eventType || !eventData) continue;

          try {
            const data = JSON.parse(eventData);

            if (eventType === 'meta') {
              // Capture metadata (turn, journalContext, etc.)
              journalContext = data.journalContext || null;
              // Store turn locally but DON'T update serverTurn yet - wait for successful completion
              // This prevents locking out turns when the stream errors after meta is received
              if (typeof data.turn === 'number') {
                resolvedTurn = data.turn;
              }
            } else if (eventType === 'delta') {
              // Append text delta
              streamedText += data.text || '';

              // Update the streaming message
              setMessages(prev => prev.map(msg =>
                msg.id === assistantMessageId
                  ? { ...msg, content: streamedText }
                  : msg
              ));
            } else if (eventType === 'done') {
              // Stream complete - finalize the message
              const finalText = data.fullText || streamedText;
              const isEmpty = data.isEmpty || (!finalText || !finalText.trim());

              // Only commit serverTurn on successful completion with actual content
              // This ensures UI turn count stays in sync with server's usage tracking
              const turnNumberForSave = resolvedTurn || data.turn || serverTurn || (turnsUsed + 1);
              if (!isEmpty) {
                setServerTurn(turnNumberForSave);
              }

              // If empty response (tool-only), show a fallback message and don't count the turn
              if (isEmpty) {
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? {
                      ...msg,
                      content: '*The reader noted something about your question but didn\'t have more to add. Feel free to ask another question.*',
                      isStreaming: false,
                      isSystemMessage: true
                    }
                    : msg
                ));
                // Don't persist empty responses or count the turn
              } else {
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? {
                      ...msg,
                      content: finalText,
                      isStreaming: false,
                      journalContext
                    }
                    : msg
                ));
                upsertFollowUp({
                  question: trimmedQuestion,
                  answer: finalText,
                  turnNumber: turnNumberForSave,
                  journalContext,
                  createdAt: Date.now()
                });
                followUpPersisted = true;
              }
            } else if (eventType === 'error') {
              throw new Error(data.message || 'Streaming error occurred');
            }
          } catch (parseError) {
            if (parseError.message && !parseError.message.includes('JSON')) {
              throw parseError;
            }
            console.warn('Failed to parse SSE event:', eventData);
          }
        }
      }

      // Finalize if not already done
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId && msg.isStreaming
          ? { ...msg, isStreaming: false, journalContext }
          : msg
      ));

      if (!followUpPersisted && streamedText) {
        const turnNumberForSave = resolvedTurn || serverTurn || (turnsUsed + 1);
        upsertFollowUp({
          question: trimmedQuestion,
          answer: streamedText,
          turnNumber: turnNumberForSave,
          journalContext,
          createdAt: Date.now()
        });
      }

    } catch (err) {
      console.error('Follow-up error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
      // Remove both user message and incomplete assistant message on error
      setMessages(prev => prev.slice(0, -2));
      setInputValue(trimmedQuestion);
    } finally {
      setIsLoading(false);
    }
  }, [
    isLoading, canAskMore, hasValidReading, readingMeta, messages, reading,
    userQuestion, personalReading, themes, includeJournal, canUseJournal, isAuthenticated,
    selectedSpread, followUpLimit, upsertFollowUp, serverTurn, turnsUsed, sessionSeed
  ]);

  const handleSubmit = (e) => {
    e.preventDefault();
    askFollowUp(inputValue);
  };

  const handleSuggestionClick = (suggestion) => {
    if (!isLoading && canAskMore && isAuthenticated) {
      askFollowUp(suggestion.text);
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e) => {
    const isComposing = e.isComposing || e.nativeEvent?.isComposing || e.keyCode === 229;
    if (isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Don't render if no reading available
  if (!hasValidReading) {
    return null;
  }

  const conversationHeight = isDock ? 'max-h-[38vh]' : isDrawer ? 'flex-1 min-h-0' : 'max-h-[45vh]';
  const chipText = isDock ? 'text-xs' : 'text-sm';
  const headerTitle = isDock ? 'text-sm' : 'text-base';
  const headerSubtitle = isDock ? 'text-xs' : 'text-sm';
  const badgeText = isDock ? 'text-[0.65rem]' : 'text-xs';

  const handleConversationScroll = (event) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    const threshold = 24;
    const atBottom = scrollHeight - scrollTop - clientHeight <= threshold;
    setIsAtBottom(atBottom);
  };

  return (
    <div className={clsx('flex flex-col gap-4', className)}>
      {showHeader && (
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ChatCircle className="w-5 h-5 text-accent" weight="fill" aria-hidden="true" />
            <div>
              <h2 id={titleId} className={clsx('font-semibold text-main', headerTitle)}>
                Follow-up chat
              </h2>
              <p className={clsx('text-muted', headerSubtitle)}>
                Clarify symbols, positions, or next steps.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={clsx(
              'rounded-full bg-[color:var(--surface-92)] px-2 py-1 border border-[color:var(--border-warm-light)] text-muted',
              badgeText
            )}>
              {turnsUsed}/{followUpLimit} used
            </span>
            {onMinimize && (
              <button
                type="button"
                onClick={onMinimize}
                className="rounded-full border border-[color:var(--border-warm-light)] p-2 text-muted hover:text-main hover:border-[color:var(--border-warm)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(232,218,195,0.50)]"
                aria-label="Minimize follow-up chat"
              >
                <CaretDown className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-[color:var(--border-warm-light)] p-2 text-muted hover:text-main hover:border-[color:var(--border-warm)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(232,218,195,0.50)]"
                aria-label="Close follow-up chat"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Suggestions (initial or on-demand) */}
      {(messages.length === 0 || showSuggestions) && (
        <div className="flex flex-wrap gap-2" role="list" aria-label="Suggested questions">
          {suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => handleSuggestionClick(suggestion)}
              disabled={isLoading || !canAskMore || !isAuthenticated}
              className={clsx(
                'px-3 py-1.5 rounded-full border transition-all',
                'border-[color:var(--border-warm-light)] bg-[color:rgba(232,218,195,0.06)]',
                'hover:border-[color:var(--border-warm)] hover:bg-[color:rgba(212,184,150,0.12)]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(232,218,195,0.50)]',
                chipText
              )}
              role="listitem"
            >
              {suggestion.text}
            </button>
          ))}
        </div>
      )}

      {/* Conversation history */}
      {messages.length > 0 && (
        <div
          className={clsx(
            'space-y-3 overflow-y-auto scroll-smooth rounded-2xl border border-[color:var(--border-warm-subtle)]',
            'bg-[color:var(--surface-88)] p-3 pr-2',
            conversationHeight
          )}
          ref={conversationRef}
          onScroll={handleConversationScroll}
          role="log"
          aria-label="Conversation history"
          aria-live="polite"
        >
          {messages.map((msg, idx) => (
            <div
              key={msg.id || idx}
              className={clsx(
                'flex',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div className={clsx(
                'max-w-[85%] px-4 py-2.5 rounded-2xl border',
                msg.role === 'user'
                  ? 'bg-primary/20 text-main rounded-br-md border-primary/30'
                  : 'bg-[color:var(--surface-92)] text-main rounded-bl-md border-[color:var(--border-warm-subtle)]'
              )}>
                {msg.role === 'assistant' ? (
                  <>
                    {msg.content ? (
                      <MarkdownRenderer content={msg.content} variant="compact" />
                    ) : msg.isStreaming ? (
                      <span className="inline-flex items-center gap-1 text-sm text-muted">
                        <span className="animate-pulse">...</span>
                      </span>
                    ) : null}
                    {/* Streaming cursor indicator */}
                    {msg.isStreaming && msg.content && (
                      <span className="inline-block w-1.5 h-4 bg-accent/60 animate-pulse ml-0.5 align-text-bottom" aria-hidden="true" />
                    )}
                  </>
                ) : (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                )}

                {/* Journal context indicator */}
                {!msg.isStreaming && msg.journalContext?.patternsFound?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[color:var(--border-warm-subtle)] text-xs text-muted flex items-center gap-1">
                    <Lightning className="w-3 h-3" weight="fill" aria-hidden="true" />
                    <span>Informed by {msg.journalContext.patternsFound.length} journal pattern(s)</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Loading indicator - only show when loading but not streaming */}
      {isLoading && !messages.some(m => m.isStreaming) && (
        <div className="flex items-center gap-2 text-muted text-sm" aria-live="polite">
          <SpinnerGap className="w-4 h-4 animate-spin" aria-hidden="true" />
          <span>Reflecting on your question...</span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          className="text-error text-sm bg-error/10 px-3 py-2 rounded-lg"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Suggestions re-entry CTA */}
      {messages.length > 0 && suggestions.length > 0 && !showSuggestions && (
        <div className="flex justify-start">
          <button
            type="button"
            onClick={() => setShowSuggestions(true)}
            className={clsx(
              'text-xs px-3 py-1.5 rounded-full border border-[color:var(--border-warm-light)] text-muted',
              'bg-[color:rgba(232,218,195,0.05)] hover:border-[color:var(--border-warm)] hover:text-main',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(232,218,195,0.40)]'
            )}
          >
            Need ideas? Show suggestions
          </button>
        </div>
      )}

      {/* Input form */}
      {canAskMore ? (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              rows={3}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              onKeyDown={handleKeyDown}
              placeholder={isAuthenticated ? 'Ask a follow-up question... (Shift+Enter for a new line)' : 'Sign in to ask a follow-up'}
              disabled={isLoading || !isAuthenticated}
              aria-label="Follow-up question"
              className={clsx(
                'w-full px-4 py-2.5 pr-16 rounded-xl border transition-all resize-none',
                'border-[color:var(--border-warm-light)] bg-[color:var(--surface-92)]',
                'focus:border-[color:var(--border-warm)] focus:ring-2 focus:ring-[color:rgba(232,218,195,0.35)] focus:outline-none',
                'placeholder:text-[color:var(--color-gray-light)]',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            />
            <span
              className="absolute right-3 top-3 text-xs text-muted pointer-events-none"
              aria-hidden="true"
            >
              {inputValue.length}/{MAX_MESSAGE_LENGTH}
            </span>
          </div>

          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading || !isAuthenticated}
            aria-label="Send question"
            className={clsx(
              'px-4 py-2.5 bg-accent text-surface rounded-xl transition-all h-full',
              'hover:bg-accent/90 active:scale-95',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50'
            )}
          >
            <PaperPlaneTilt className="w-5 h-5" weight="fill" aria-hidden="true" />
          </button>
        </form>
      ) : (
        <div className="text-center text-muted text-sm py-2">
          You&apos;ve used all {followUpLimit} follow-up question{followUpLimit > 1 ? 's' : ''} for this reading.
          {effectiveTier !== 'pro' && (
            <a
              href="/pricing"
              className="ml-2 text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded"
            >
              Upgrade for more
            </a>
          )}
        </div>
      )}

      {/* Usage indicator */}
      {canAskMore && turnsUsed > 0 && (
        <div className="text-xs text-muted text-center">
          {turnsUsed}/{followUpLimit} follow-up{followUpLimit > 1 ? 's' : ''} used for this reading
        </div>
      )}

      {/* Journal toggle (Plus+ only) */}
      {canUseJournal && (
        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeJournal}
            onChange={(e) => setIncludeJournal(e.target.checked)}
            className="rounded border-[color:var(--border-warm-light)] text-accent focus:ring-[color:rgba(232,218,195,0.50)] focus:ring-offset-0"
          />
          <Lightning className="w-3 h-3" weight="fill" aria-hidden="true" />
          <span>Include insights from my journal history</span>
        </label>
      )}

      {/* Journal upsell for free/auth'd users */}
      {!canUseJournal && isAuthenticated && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <Lock className="w-3 h-3" aria-hidden="true" />
          <span>
            <a
              href="/pricing"
              className="text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded"
            >
              Upgrade to Plus
            </a>
            {' '}for journal-powered insights
          </span>
        </div>
      )}

      {/* Sign-in prompt for unauthenticated users */}
      {!isAuthenticated && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <Lock className="w-3 h-3" aria-hidden="true" />
          <span>Sign in to ask follow-up questions</span>
        </div>
      )}
    </div>
  );
}
