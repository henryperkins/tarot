import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useSmallScreen } from '../hooks/useSmallScreen';

const LONG_MOBILE_WORD_THRESHOLD = 280;
const LONG_DESKTOP_WORD_THRESHOLD = 600; // Guardrail for very long narratives on any device
const BASE_WORD_DELAY = 45;
const PUNCTUATION_DELAY_BONUS = 160;

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
  const isSmallScreen = useSmallScreen();

  // Split text into reveal units (words)
  const units = useMemo(() => {
    if (!narrativeText) return [];
    return splitIntoWords(narrativeText);
  }, [narrativeText]);

  const totalWords = useMemo(() => {
    if (!units.length) return 0;
    return units.reduce((count, unit) => (unit.trim() ? count + 1 : count), 0);
  }, [units]);

  const [visibleCount, setVisibleCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [mobileStreamingOptIn, setMobileStreamingOptIn] = useState(false);

  // Refs for cleanup and tracking
  const timerRef = useRef(null);
  const narrationTimerRef = useRef(null);
  const completionNotifiedRef = useRef(false);
  const narrationTriggeredRef = useRef(false);

  const isLongMobileNarrative = isSmallScreen && totalWords > LONG_MOBILE_WORD_THRESHOLD;
  const isVeryLongNarrative = totalWords > LONG_DESKTOP_WORD_THRESHOLD;
  const streamingActive = Boolean(
    isStreamingEnabled &&
    !prefersReducedMotion &&
    units.length > 0 &&
    !isVeryLongNarrative && // Guardrail: skip streaming for extremely long text on any device
    (!isLongMobileNarrative || mobileStreamingOptIn)
  );
  const streamingSuppressedForMobile = Boolean(
    isStreamingEnabled &&
    !prefersReducedMotion &&
    isLongMobileNarrative &&
    !isVeryLongNarrative &&
    !mobileStreamingOptIn
  );

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

    completionNotifiedRef.current = false;
    narrationTriggeredRef.current = false;

    if (!streamingActive) {
      setVisibleCount(units.length);
      setIsComplete(true);
      if (units.length > 0) {
        notifyCompletion();
      }
      return;
    }

    setVisibleCount(0);
    setIsComplete(false);
  }, [narrativeText, streamingActive, units.length, notifyCompletion, clearTimer, clearNarrationTimer]);

  // Handle completion separately from state updates
  useEffect(() => {
    if (visibleCount >= units.length && units.length > 0 && !isComplete) {
      setIsComplete(true);
      notifyCompletion();
    }
  }, [visibleCount, units.length, isComplete, notifyCompletion]);

  // Auto-narration effect - separate from streaming to avoid coupling
  useEffect(() => {
    if (!autoNarrate || !onNarrationStart || narrationTriggeredRef.current || units.length === 0) {
      return undefined;
    }

    const textToNarrate = narrativeText;

    if (streamingActive && visibleCount === 0) {
      narrationTriggeredRef.current = true;
      narrationTimerRef.current = window.setTimeout(() => {
        onNarrationStart(textToNarrate);
      }, 200);
    } else if (!streamingActive) {
      narrationTriggeredRef.current = true;
      narrationTimerRef.current = window.setTimeout(() => {
        onNarrationStart(textToNarrate);
      }, 80);
    }

    return () => {
      clearNarrationTimer();
    };
  }, [visibleCount, units.length, autoNarrate, onNarrationStart, narrativeText, streamingActive, clearNarrationTimer]);

  // Streaming effect: reveal units one by one
  useEffect(() => {
    if (!streamingActive) {
      return;
    }

    if (visibleCount >= units.length) {
      return;
    }

    // Calculate delay between words for natural reading pace
    const currentWord = units[visibleCount] || '';
    // Add extra delay for punctuation (pause at end of sentences/clauses)
    const hasPunctuation = /[.!?;:]/.test(currentWord);
    const delay = hasPunctuation ? BASE_WORD_DELAY + PUNCTUATION_DELAY_BONUS : BASE_WORD_DELAY;

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

  useEffect(() => {
    setMobileStreamingOptIn(false);
  }, [narrativeText]);

  const handleSkip = () => {
    if (units.length === 0) {
      return;
    }
    clearTimer();
    setVisibleCount(units.length);
    setIsComplete(true);
    notifyCompletion();
  };

  const handleEnableStreaming = () => {
    if (units.length === 0) {
      return;
    }
    setMobileStreamingOptIn(true);
    completionNotifiedRef.current = false;
    narrationTriggeredRef.current = false;
    clearTimer();
    setVisibleCount(0);
    setIsComplete(false);
  };

  const visibleWords = units.slice(0, visibleCount);
  const showSkipButton = streamingActive && !isComplete;

  const streamingOptInNotice = streamingSuppressedForMobile ? (
    <div className="sm:hidden mb-3 rounded-xl border border-secondary/40 bg-surface/80 px-4 py-3 text-center">
      <p className="text-xs-plus text-muted mb-2">Long readings show instantly on small screens.</p>
      <button
        type="button"
        onClick={handleEnableStreaming}
        className="w-full rounded-full border border-secondary/40 bg-secondary/20 px-4 py-2 text-xs-plus font-semibold text-secondary shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
      >
        Play typing effect
      </button>
    </div>
  ) : null;

  // For markdown: render completed text progressively
  if (useMarkdown) {
    const visibleText = visibleWords.join('');
    return (
      <div className={className} aria-live="polite">
        {streamingOptInNotice}
        {/* Container with min-height to prevent layout shift during streaming */}
        <div className="prose prose-sm sm:prose-base md:prose-lg max-w-none min-h-[8rem] xs:min-h-[10rem]">
          <MarkdownRenderer content={visibleText} />
        </div>

        {showSkipButton && (
          <div className="mt-4 xs:mt-5 sticky bottom-4 sm:static flex justify-center px-3 xs:px-4 sm:px-0">
            <button
              type="button"
              onClick={handleSkip}
              className="min-h-[44px] w-full max-w-sm sm:max-w-none px-4 xs:px-5 py-2.5 text-[0.85rem] xs:text-sm font-semibold rounded-full bg-surface-muted/80 border border-secondary/40 text-secondary hover:bg-surface-muted hover:border-secondary/60 shadow-lg sm:shadow-sm transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
              aria-label="Show full narrative immediately"
            >
              Show all now →
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
      {streamingOptInNotice}
      {/* Mobile-optimized text with good line height and spacing - min-height prevents layout shift */}
      <div className="text-main text-[0.9375rem] xs:text-base md:text-lg leading-7 xs:leading-relaxed md:leading-loose max-w-prose mx-auto text-left min-h-[8rem] xs:min-h-[10rem]">
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
        <div className="mt-4 xs:mt-5 sticky bottom-4 sm:static flex justify-center px-3 xs:px-4 sm:px-0">
          <button
            type="button"
            onClick={handleSkip}
            className="min-h-[44px] w-full max-w-sm sm:max-w-none px-4 xs:px-5 py-2.5 text-[0.85rem] xs:text-sm font-semibold rounded-full bg-surface-muted/80 border border-secondary/40 text-secondary hover:bg-surface-muted hover:border-secondary/60 shadow-lg sm:shadow-sm transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
            aria-label="Show full narrative immediately"
          >
            Show all now →
          </button>
        </div>
      )}
    </div>
  );
}
