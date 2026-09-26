/**
 * FollowUpChat Component
 *
 * Reusable chat body for follow-up questions about a tarot reading.
 */

import { useState, useMemo, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { ChatCircle, PaperPlaneTilt, SpinnerGap, Lightning, Lock, X } from '@phosphor-icons/react';
import { useReading } from '../contexts/ReadingContext';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { generateFollowUpSuggestions } from '../lib/followUpSuggestions';
import { MarkdownRenderer } from './MarkdownRenderer';
import { SPREADS } from '../data/spreads';
import { useReducedMotion } from '../hooks/useReducedMotion';
import clsx from 'clsx';

const MAX_MESSAGE_LENGTH = 500;
// No bytes for this long means the request is stuck, not slow.
const STALL_TIMEOUT_MS = 120000;
const SLOW_RESPONSE_MS = 15000;

// Tier-based follow-up limits (matches backend)
const FOLLOW_UP_LIMITS = {
  free: 1,
  plus: 3,
  pro: 10
};

const RETRY_HINT = 'Your question is still in the box, so you can send it again.';
const ERROR_COPY = {
  network: `Couldn't reach the reader. Check your connection. ${RETRY_HINT}`,
  timeout: `The reader is taking too long to answer. ${RETRY_HINT}`,
  dropped: `The connection closed before the reader answered. ${RETRY_HINT}`,
  generic: `The reader couldn't answer just now. ${RETRY_HINT}`
};

export default function FollowUpChat({
  variant = 'modal',
  isActive = true,
  titleId = 'follow-up-chat-title',
  onClose,
  showHeader = true,
  className = ''
}) {
  const {
    reading,
    personalReading,
    themes,
    readingMeta,
    userQuestion,
    reflections,
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
  const [suggestionRotation, setSuggestionRotation] = useState(0);
  const [serverTurn, setServerTurn] = useState(null); // Synced from meta.turn
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isSlow, setIsSlow] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const prefersReducedMotion = useReducedMotion();

  const conversationRef = useRef(null);
  const inputRef = useRef(null);
  const activeRequestRef = useRef(null);
  const logRef = useRef(null);
  const suggestionsRef = useRef(null);
  const errorRef = useRef(null);
  const limitRef = useRef(null);
  const hadFocusRef = useRef(false);
  const focusIntentRef = useRef(null);
  const isDrawer = variant === 'drawer';

  useEffect(() => {
    setSuggestionRotation(0);
  }, [readingMeta?.requestId, sessionSeed]);

  // Generate contextual suggestions
  const suggestions = useMemo(() =>
    generateFollowUpSuggestions(reading, themes, readingMeta, {
      spreadKey: readingMeta?.spreadKey || selectedSpread,
      userQuestion,
      rotationSeed: readingMeta?.requestId || sessionSeed || readingMeta?.spreadKey || selectedSpread,
      rotationIndex: suggestionRotation,
      deckStyle: readingMeta?.deckStyle,
      limit: 4
    }),
    [reading, themes, readingMeta, selectedSpread, userQuestion, sessionSeed, suggestionRotation]
  );

  // Check if user can use journal context (Plus+ tier)
  const canUseJournal = useMemo(() => {
    return effectiveTier === 'plus' || effectiveTier === 'pro';
  }, [effectiveTier]);

  // Get follow-up limit based on tier
  const followUpLimit = useMemo(() => {
    return FOLLOW_UP_LIMITS[effectiveTier] || FOLLOW_UP_LIMITS.free;
  }, [effectiveTier]);

  // Use server turn count when available, fall back to answered turns. A pending
  // question must not swap the composer for the limit notice before its answer lands.
  const localTurns = messages.filter(m => m.role === 'assistant' && !m.isStreaming && !m.isSystemMessage).length;
  const turnsUsed = serverTurn !== null ? serverTurn : localTurns;
  const canAskMore = turnsUsed < followUpLimit;
  const hasValidReading = Boolean(personalReading) && !personalReading.isError && !personalReading.isStreaming;
  const isFreeTier = effectiveTier === 'free';
  const isPlusTier = effectiveTier === 'plus';

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
      activeRequestRef.current?.abort();
      activeRequestRef.current = null;
      setIsLoading(false);
      setMessages([]);
      setError(null);
      setInputValue('');
      setShowSuggestions(false);
      setServerTurn(null); // Reset server turn on new reading
      setIsAtBottom(true);
      setIsSlow(false);
      setAnnouncement('');
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

  useEffect(() => () => activeRequestRef.current?.abort(), []);

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

  const scrollToBottom = useCallback((behavior = prefersReducedMotion ? 'auto' : 'smooth') => {
    if (conversationRef.current) {
      conversationRef.current.scrollTo({ top: conversationRef.current.scrollHeight, behavior });
    }
  }, [prefersReducedMotion]);

  const hasStreamingMessage = useMemo(
    () => messages.some(msg => msg.isStreaming),
    [messages]
  );

  // Auto-scroll to latest message (only if user is at the bottom)
  useEffect(() => {
    if (!isActive || !isAtBottom || messages.length === 0) return;
    scrollToBottom(hasStreamingMessage || prefersReducedMotion ? 'auto' : 'smooth');
  }, [messages, isActive, isAtBottom, hasStreamingMessage, prefersReducedMotion, scrollToBottom]);

  // A tapped suggestion, a failed first turn, or the composer giving way to the
  // limit notice removes the focused control. Land focus somewhere meaningful
  // instead of letting it fall to <body>. The log is preferred over the textarea
  // so a phone keyboard doesn't rise over the answer.
  useEffect(() => {
    const intent = focusIntentRef.current;
    focusIntentRef.current = null;
    if (!isActive || !hadFocusRef.current) return;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    const firstSuggestion = intent === 'suggestions'
      ? suggestionsRef.current?.querySelector('button:not(:disabled)')
      : null;
    const input = inputRef.current && !inputRef.current.disabled ? inputRef.current : null;
    const target = firstSuggestion || errorRef.current || limitRef.current || logRef.current || input;
    target?.focus({ preventScroll: target === logRef.current });
  });

  // The composer starts one line tall and grows with the question up to its CSS
  // max-height, so short phones keep room for the conversation.
  const fitComposer = useCallback(() => {
    const input = inputRef.current;
    if (!input || !input.isConnected || input.offsetParent === null) return;
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight + input.offsetHeight - input.clientHeight}px`;
  }, []);

  useLayoutEffect(() => {
    fitComposer();
  }, [inputValue, isActive, canAskMore, fitComposer]);

  // Rewrap on width or text-size changes (rotation, breakpoint, 200% zoom).
  useEffect(() => {
    const input = inputRef.current;
    if (!input || typeof ResizeObserver === 'undefined') return undefined;
    let frame = 0;
    // Deferred so resizing inside the callback can't trip the observer-loop error.
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fitComposer);
    });
    observer.observe(input);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [canAskMore, fitComposer]);

  const askFollowUp = useCallback(async (question) => {
    const trimmedQuestion = question?.trim();
    if (!trimmedQuestion || !isActive || activeRequestRef.current || isLoading || !canAskMore || !hasValidReading) return;
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

    const request = new AbortController();
    activeRequestRef.current = request;
    setError(null);
    setIsLoading(true);
    setIsSlow(false);
    setInputValue('');
    setShowSuggestions(false);
    setIsAtBottom(true);
    setAnnouncement('Question sent. The reader is reflecting.');

    // Rearmed on every chunk, so it fires only when the connection goes silent.
    let timedOut = false;
    let stallTimer = null;
    const armStallTimer = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        timedOut = true;
        request.abort();
      }, STALL_TIMEOUT_MS);
    };
    armStallTimer();
    const slowTimer = setTimeout(() => {
      if (activeRequestRef.current !== request) return;
      setIsSlow(true);
      setAnnouncement('Still reflecting. Some answers take a little longer.');
    }, SLOW_RESPONSE_MS);

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
        signal: request.signal,
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
            reflections,
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

      if (activeRequestRef.current !== request) return;
      armStallTimer();
      // Check for non-streaming error responses
      const contentType = response.headers.get('content-type') || '';
      const isSSE = contentType.includes('text/event-stream');

      if (!response.ok && !isSSE) {
        // Non-SSE error response - parse as JSON
        const errorData = await response.json().catch(() => ({}));
        if (activeRequestRef.current !== request || (request.signal.aborted && !timedOut)) return;

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

        throw new Error(errorData.message || errorData.error || ERROR_COPY.generic);
      }

      if (!isSSE) {
        // The server's safety gate answers crisis language with JSON even when a
        // stream was requested. Those support resources must reach the person.
        const data = await response.json().catch(() => null);
        if (activeRequestRef.current !== request) return;
        const answer = typeof data?.response === 'string' ? data.response.trim() : '';
        if (!answer) throw new Error(ERROR_COPY.generic);
        const turn = Number.isFinite(data?.turn) ? Number(data.turn) : null;
        const journalContext = data?.journalContext || null;
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: answer, isStreaming: false, isSystemMessage: turn === null, journalContext }
            : msg
        ));
        // A safety response carries no turn: it neither spends the allowance nor enters the journal.
        if (turn !== null) {
          setServerTurn(turn);
          upsertFollowUp({ question: trimmedQuestion, answer, turnNumber: turn, journalContext, createdAt: Date.now() });
        }
        setAnnouncement(turn === null ? 'The reader shared support resources.' : 'The reader has answered.');
        return;
      }

      // Process SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamedText = '';
      let journalContext = null;
      let resolvedTurn = null;
      let followUpPersisted = false;
      let streamCompleted = false;

      while (true) {
        const { done, value } = await reader.read();
        if (activeRequestRef.current !== request) return;

        if (done) break;
        armStallTimer();

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
              streamCompleted = true;
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
                const emptyNotice = '*The reader noted something about your question but didn\'t have more to add. Feel free to ask another question.*';
                setServerTurn(turnsUsed);
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? {
                      ...msg,
                      content: emptyNotice,
                      isStreaming: false,
                      isSystemMessage: true
                    }
                    : msg
                ));
                setAnnouncement('The reader had nothing more to add.');
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
                setAnnouncement('The reader has answered.');
              }
            } else if (eventType === 'error') {
              throw new Error(data.message || ERROR_COPY.generic);
            }
          } catch (parseError) {
            if (parseError.message && !parseError.message.includes('JSON')) {
              throw parseError;
            }
            console.warn('Failed to parse SSE event:', eventData);
          }
        }
      }

      // The stream closed without a `done` event. With nothing said, treat it as a
      // failure so the question comes back; with partial text, keep it but say so.
      if (!streamCompleted && !streamedText) {
        throw new Error(ERROR_COPY.dropped);
      }

      // Finalize if not already done
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId && msg.isStreaming
          ? { ...msg, isStreaming: false, isInterrupted: !streamCompleted, journalContext }
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
        setAnnouncement('The connection dropped, so this answer may be incomplete.');
      }

    } catch (err) {
      if (activeRequestRef.current !== request) return;
      if (request.signal.aborted && !timedOut) return;
      console.error('Follow-up error:', err);
      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
      // fetch() and stream reads reject with TypeError when the network fails.
      const message = timedOut
        ? ERROR_COPY.timeout
        : (isOffline || err?.name === 'TypeError')
          ? ERROR_COPY.network
          : (err?.message || ERROR_COPY.generic);
      setError(message);
      setAnnouncement('');
      // Remove both user message and incomplete assistant message on error
      setMessages(prev => prev.slice(0, -2));
      setInputValue(trimmedQuestion);
    } finally {
      clearTimeout(stallTimer);
      clearTimeout(slowTimer);
      if (activeRequestRef.current === request) {
        activeRequestRef.current = null;
        setIsLoading(false);
        setIsSlow(false);
      }
    }
  }, [
    isActive, isLoading, canAskMore, hasValidReading, readingMeta, messages, reading,
    userQuestion, reflections, personalReading, themes, includeJournal, canUseJournal, isAuthenticated,
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

  const handleConversationScroll = (event) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    const threshold = 24;
    const atBottom = scrollHeight - scrollTop - clientHeight <= threshold;
    setIsAtBottom(atBottom);
  };

  const canSend = isAuthenticated && !isLoading && Boolean(inputValue.trim());
  const showSuggestionsToggle = messages.length > 0 && suggestions.length > 0 && !showSuggestions
    && canAskMore && !isLoading && isAuthenticated;
  const patternCount = (msg) => msg.journalContext?.patternsFound?.length || 0;

  return (
    <div
      className={clsx('follow-up-chat', className)}
      onFocus={() => { hadFocusRef.current = true; }}
      onBlur={(event) => {
        // Removed nodes blur with no relatedTarget; only a real move elsewhere counts.
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
          hadFocusRef.current = false;
        }
      }}
    >
      <p className="sr-only" role="status">{announcement}</p>
      {showHeader && (
        <div className="follow-up-chat__header">
          <ChatCircle className="w-5 h-5 shrink-0 mt-2 text-accent" weight="fill" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-serif text-2xl text-main">
              Follow-up chat
            </h2>
            <p className="follow-up-chat__subtitle text-sm text-muted">
              {isDrawer ? 'Ask deeper questions and stay anchored to this spread.' : 'Clarify symbols, positions, or next steps.'}
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="follow-up-chat__icon-button follow-up-chat__close"
              aria-label="Close follow-up chat"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <div className="follow-up-chat__scroll" ref={conversationRef} onScroll={handleConversationScroll}>
      {/* Suggestions (initial or on-demand) */}
      {(messages.length === 0 || showSuggestions) && (
        <ul ref={suggestionsRef} className="follow-up-suggestions" aria-label="Suggested questions">
          {suggestions.map((suggestion, idx) => (
            <li key={idx}>
            <button
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              disabled={isLoading || !canAskMore || !isAuthenticated}
            >
              {suggestion.text}
            </button>
            </li>
          ))}
        </ul>
      )}

      {/* Conversation history */}
      {messages.length > 0 && (
        <div
          ref={logRef}
          tabIndex={-1}
          className="follow-up-log"
          role="log"
          aria-label="Conversation history"
          // Token-by-token streaming would make a live log chatter; the status
          // region above announces each question and finished answer once.
          aria-live="off"
        >
          {messages.map((msg, idx) => (
            msg.role === 'user' ? (
              <div key={msg.id || idx} className="follow-up-log__question">
                <p className="whitespace-pre-wrap" dir="auto">{msg.content}</p>
              </div>
            ) : (
              // The reader's answer reads as prose on the page, not a boxed bubble.
              <div key={msg.id || idx} className="follow-up-log__answer">
                {msg.content ? (
                  <MarkdownRenderer content={msg.content} variant="compact" />
                ) : msg.isStreaming ? (
                  <span className="inline-flex items-center gap-2 text-sm text-muted">
                    <SpinnerGap className="w-4 h-4 shrink-0 animate-spin" aria-hidden="true" />
                    {isSlow ? 'Still reflecting. Some answers take a little longer.' : 'Reflecting on your question…'}
                  </span>
                ) : null}
                {/* Streaming cursor indicator */}
                {msg.isStreaming && msg.content && (
                  <span className="inline-block w-1.5 h-4 bg-accent/60 animate-pulse ms-0.5 align-text-bottom" aria-hidden="true" />
                )}
                {msg.isInterrupted && (
                  <p className="mt-2 text-xs text-muted">The connection dropped, so this answer may be incomplete.</p>
                )}
                {/* Journal context indicator */}
                {!msg.isStreaming && patternCount(msg) > 0 && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-muted">
                    <Lightning className="w-3 h-3 shrink-0" weight="fill" aria-hidden="true" />
                    <span>
                      Informed by {patternCount(msg)} journal {patternCount(msg) === 1 ? 'pattern' : 'patterns'}
                    </span>
                  </p>
                )}
              </div>
            )
          ))}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          ref={errorRef}
          tabIndex={-1}
          className="text-error text-sm bg-error/10 px-3 py-2 rounded-lg"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Suggestions re-entry CTA */}
      {showSuggestionsToggle && (
        <div className="flex justify-start">
          <button
            type="button"
            onClick={() => {
              focusIntentRef.current = 'suggestions';
              setShowSuggestions(true);
              setSuggestionRotation((prev) => prev + 1);
            }}
            className="follow-up-chat__ghost-button"
          >
            Need ideas? Show suggestions
          </button>
        </div>
      )}
      </div>

      <div className="follow-up-chat__footer">
      {/* Input form */}
      {canAskMore ? (
        <form onSubmit={handleSubmit} className="follow-up-composer">
          <div className="follow-up-composer__label-row">
            <label htmlFor={`${titleId}-question`} className="text-sm font-semibold">Your follow-up question</label>
            <span className="follow-up-chat__usage">{turnsUsed}/{followUpLimit} used</span>
          </div>
          <div className="follow-up-composer__input-row">
            {/* Read-only (not disabled) while the reader answers, so focus stays put. */}
            <textarea
              id={`${titleId}-question`}
              ref={inputRef}
              rows={1}
              dir="auto"
              enterKeyHint="send"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              onKeyDown={handleKeyDown}
              placeholder={!isAuthenticated
                ? 'Sign in to ask a follow-up'
                : isLoading ? 'The reader is answering…' : 'Ask a follow-up question...'}
              disabled={!isAuthenticated}
              readOnly={isLoading}
              aria-disabled={isLoading || undefined}
              aria-describedby={`${titleId}-hint ${titleId}-counter`}
              maxLength={MAX_MESSAGE_LENGTH}
            />

            {/* aria-disabled keeps the button focusable after a click-to-send. */}
            <button
              type="submit"
              disabled={!isAuthenticated}
              aria-disabled={!canSend}
              aria-label="Send question"
              className="follow-up-chat__icon-button follow-up-chat__send"
            >
              <PaperPlaneTilt className="w-5 h-5" weight="fill" aria-hidden="true" />
            </button>
          </div>
          <div className="follow-up-composer__meta">
            <p id={`${titleId}-hint`}>Shift+Enter for a new line</p>
            <span id={`${titleId}-counter`} className="tabular-nums">
              {inputValue.length}/{MAX_MESSAGE_LENGTH}
            </span>
          </div>
        </form>
      ) : (
        <div ref={limitRef} tabIndex={-1} className="text-center text-muted text-sm py-2">
          <div>
            {followUpLimit === 1
              ? "You've used your follow-up question for this reading."
              : `You've used all ${followUpLimit} follow-up questions for this reading.`}
          </div>
          <div className="mt-1 text-xs text-muted">Limits reset per reading.</div>
          {effectiveTier !== 'pro' && (
            <a href="/pricing" className="mt-1 text-xs text-accent hover:underline">
              {isFreeTier ? 'Upgrade to Plus for 3 follow-ups' : isPlusTier ? 'Upgrade to Pro for 10 follow-ups' : 'Upgrade for more'}
            </a>
          )}
        </div>
      )}

      {/* Journal toggle (Plus+ only) */}
      {canUseJournal && (
        <label className="follow-up-chat__history-label flex items-center gap-2 text-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeJournal}
            onChange={(e) => setIncludeJournal(e.target.checked)}
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
            <a href="/pricing" className="text-accent hover:underline">
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
    </div>
  );
}
