import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useReducedMotion } from '../hooks/useReducedMotion';

/**
 * Split text into words for gradual reveal, preserving spaces
 */
function splitIntoWords(text) {
  if (!text) return [];

  // Split by spaces while capturing them
  const parts = text.split(/(\s+)/);

  // Filter in single pass
  return parts.filter(part => part && part.length > 0);
}

export function StreamingNarrative({
  text,
  useMarkdown = false,
  className = '',
  isStreamingEnabled = true,
  onDone,
  autoNarrate = false,
  onNarrationStart,
}) {
  const narrativeText = useMemo(() => (typeof text === 'string' ? text : ''), [text]);
  const prefersReducedMotion = useReducedMotion();

  // Split text into reveal units (words)
  const units = useMemo(() => {
    if (!narrativeText) return [];
    return splitIntoWords(narrativeText);
  }, [narrativeText]);

  const [visibleCount, setVisibleCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // Refs for cleanup and tracking
  const timerRef = useRef(null);
  const narrationTimerRef = useRef(null);
  const completionNotifiedRef = useRef(false);
  const narrationTriggeredRef = useRef(false);

  const notifyCompletion = useCallback(() => {
    if (completionNotifiedRef.current) {
      return;
    }
    completionNotifiedRef.current = true;
    onDone?.();
  }, [onDone]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearNarrationTimer = useCallback(() => {
    if (narrationTimerRef.current) {
      window.clearTimeout(narrationTimerRef.current);
      narrationTimerRef.current = null;
    }
  }, []);

  // Reset when text changes
  useEffect(() => {
    // Clear any existing timers first
    clearTimer();
    clearNarrationTimer();

    if (!isStreamingEnabled || prefersReducedMotion) {
      setVisibleCount(units.length);
      setIsComplete(true);
      completionNotifiedRef.current = false;
      narrationTriggeredRef.current = false;
      notifyCompletion();
      return;
    }

    setVisibleCount(0);
    setIsComplete(false);
    completionNotifiedRef.current = false;
    narrationTriggeredRef.current = false;
  }, [narrativeText, isStreamingEnabled, prefersReducedMotion, units.length, notifyCompletion, clearTimer, clearNarrationTimer]);

  // Handle completion separately from state updates
  useEffect(() => {
    if (visibleCount >= units.length && units.length > 0 && !isComplete) {
      setIsComplete(true);
      notifyCompletion();
    }
  }, [visibleCount, units.length, isComplete, notifyCompletion]);

  // Auto-narration effect - separate from streaming to avoid coupling
  useEffect(() => {
    if (!autoNarrate || !onNarrationStart || narrationTriggeredRef.current) {
      return;
    }

    if (visibleCount === 0 && units.length > 0 && isStreamingEnabled && !prefersReducedMotion) {
      narrationTriggeredRef.current = true;
      // Capture current text for the timeout closure
      const textToNarrate = narrativeText;
      narrationTimerRef.current = window.setTimeout(() => {
        onNarrationStart(textToNarrate);
      }, 200);
    }

    return () => {
      clearNarrationTimer();
    };
  }, [visibleCount, units.length, autoNarrate, onNarrationStart, narrativeText, isStreamingEnabled, prefersReducedMotion, clearNarrationTimer]);

  // Streaming effect: reveal units one by one
  useEffect(() => {
    if (!isStreamingEnabled || prefersReducedMotion || units.length === 0) {
      return;
    }

    if (visibleCount >= units.length) {
      return;
    }

    // Calculate delay between words for natural reading pace
    const currentWord = units[visibleCount] || '';
    const baseDelay = 60; // Base delay between words (60ms - faster pace)
    // Add extra delay for punctuation (pause at end of sentences/clauses)
    const hasPunctuation = /[.!?;:]/.test(currentWord);
    const delay = hasPunctuation ? baseDelay + 200 : baseDelay;

    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setVisibleCount((prev) => prev + 1);
    }, delay);

    return () => {
      clearTimer();
    };
  }, [visibleCount, units, isStreamingEnabled, prefersReducedMotion, clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
      clearNarrationTimer();
    };
  }, [clearTimer, clearNarrationTimer]);

  const handleSkip = () => {
    if (units.length === 0) {
      return;
    }
    clearTimer();
    setVisibleCount(units.length);
    setIsComplete(true);
    notifyCompletion();
  };

  const visibleWords = units.slice(0, visibleCount);
  const showSkipButton = !isComplete && isStreamingEnabled && !prefersReducedMotion && units.length > 0;

  // For markdown: render completed text progressively
  if (useMarkdown) {
    const visibleText = visibleWords.join('');
    return (
      <div className={className} aria-live="polite">
        <div className="prose prose-sm sm:prose-base md:prose-lg max-w-none">
          <MarkdownRenderer content={visibleText} />
        </div>

        {showSkipButton && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={handleSkip}
              className="min-h-[44px] min-w-[44px] px-4 py-2 text-xs text-secondary/80 hover:text-secondary underline decoration-dotted underline-offset-4 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
              aria-label="Show full narrative immediately"
            >
              Show all now &rarr;
            </button>
          </div>
        )}
      </div>
    );
  }

  // For plain text: render words with ink-spreading effect
  // Only apply willChange to recently revealed words to avoid GPU memory exhaustion
  const RECENT_WORDS_THRESHOLD = 10;

  // Memoize animation styles to avoid creating new objects per word per render
  const recentWordStyle = useMemo(() => ({
    animation: 'inkSpread 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards',
    willChange: 'opacity, filter, transform'
  }), []);

  const settledWordStyle = useMemo(() => ({
    animation: 'inkSpread 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards',
    willChange: 'auto'
  }), []);

  return (
    <div className={className} aria-live="polite">
      <div className="text-main text-sm sm:text-base md:text-lg leading-relaxed md:leading-loose max-w-prose mx-auto text-left">
        {visibleWords.map((word, idx) => {
          // Check if this is whitespace (space, newline, etc.)
          const isWhitespace = /^\s+$/.test(word);

          if (isWhitespace) {
            // Render whitespace without animation
            return <span key={idx}>{word}</span>;
          }

          // Only recent words get willChange hint to avoid exhausting GPU memory
          const isRecentWord = idx >= visibleCount - RECENT_WORDS_THRESHOLD;

          // Render word with ink-spreading animation
          return (
            <span
              key={idx}
              className={`inline-block ${prefersReducedMotion ? '' : 'animate-ink-spread'}`}
              style={prefersReducedMotion ? undefined : (isRecentWord ? recentWordStyle : settledWordStyle)}
            >
              {word}
            </span>
          );
        })}
      </div>

      {showSkipButton && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={handleSkip}
            className="min-h-[44px] min-w-[44px] px-4 py-2 text-xs text-secondary/80 hover:text-secondary underline decoration-dotted underline-offset-4 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
            aria-label="Show full narrative immediately"
          >
            Show all now &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
