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
  displayName = '',
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
  const [mobileStreamingOptIn, setMobileStreamingOptIn] = useState(false);
  const [prevNarrativeText, setPrevNarrativeText] = useState(narrativeText);

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

  // Derive isComplete from visibleCount (no need for separate state)
  const isComplete = units.length > 0 && visibleCount >= units.length;

  // Adjust state during render when narrative text changes (React-recommended pattern)
  // This avoids the cascading render issue from calling setState in useEffect
  // See: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (narrativeText !== prevNarrativeText) {
    setPrevNarrativeText(narrativeText);
    setMobileStreamingOptIn(false);
    
    // Compute what streamingActive will be after mobileStreamingOptIn resets to false
    const newStreamingActive = Boolean(
      isStreamingEnabled &&
      !prefersReducedMotion &&
      units.length > 0 &&
      !isVeryLongNarrative &&
      !isLongMobileNarrative // mobileStreamingOptIn will be false
    );
    
    if (!newStreamingActive) {
      setVisibleCount(units.length);
    } else {
      setVisibleCount(0);
    }
  }

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

  // Clear timers and reset refs when text changes (side effects that must stay in useEffect)
  useEffect(() => {
    clearTimer();
    clearNarrationTimer();
    completionNotifiedRef.current = false;
    narrationTriggeredRef.current = false;
  }, [narrativeText, clearTimer, clearNarrationTimer]);

  // Handle initial render and streaming-disabled state
  // The render-time state adjustment (lines 82-100) only runs when text changes,
  // so on first mount with streaming disabled, visibleCount stays at 0.
  // This effect ensures text is shown immediately when streaming is not active.
  useEffect(() => {
    if (!streamingActive && units.length > 0 && visibleCount < units.length) {
      setVisibleCount(units.length);
    }
  }, [streamingActive, units.length, visibleCount]);

  // Notify completion when all content is visible
  // This effect only calls external callback, no setState
  useEffect(() => {
    if (isComplete && !completionNotifiedRef.current) {
      notifyCompletion();
    }
  }, [isComplete, notifyCompletion]);

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
  }, [visibleCount, units, streamingActive, clearTimer]);

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
    // notifyCompletion will be called by the effect when isComplete becomes true
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
  };

  const visibleWords = units.slice(0, visibleCount);
  const showSkipButton = streamingActive && !isComplete;

  // Memoize animation styles to avoid creating new objects per word per render
  // Must be defined before any conditional returns to satisfy Rules of Hooks
  const recentWordStyle = useMemo(() => ({
    animation: 'inkSpread 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards',
    willChange: 'opacity, filter, transform'
  }), []);

  const settledWordStyle = useMemo(() => ({
    animation: 'inkSpread 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards',
    willChange: 'auto'
  }), []);

  const streamingOptInNotice = streamingSuppressedForMobile ? (
    <div className="sm:hidden mb-3 rounded-xl border border-secondary/40 bg-surface/80 px-3 xxs:px-4 py-3 text-center">
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

  const personalizedIntro = displayName
    ? (
      <p className="text-xs text-muted text-center mb-2">
        For you, {displayName}, this unfolds in stages:
      </p>
    )
    : null;

  // For markdown: render completed text progressively
  if (useMarkdown) {
    const visibleText = visibleWords.join('');
    return (
      <div className={className} aria-live="polite">
        {streamingOptInNotice}
        {personalizedIntro}
        {/* Container with min-height to prevent layout shift during streaming */}
        <div className="prose prose-sm xxs:prose-base sm:prose-base md:prose-lg max-w-[min(32rem,calc(100vw-2.25rem))] xxs:max-w-sm sm:max-w-[65ch] w-full min-h-[5.5rem] xxs:min-h-[7rem] md:min-h-[10rem] px-2 xxs:px-3 sm:px-0 mx-auto">
          <MarkdownRenderer content={visibleText} />
        </div>

        {showSkipButton && (
          <div className="mt-4 xs:mt-5 sticky bottom-[max(1rem,env(safe-area-inset-bottom,1rem))] sm:static flex justify-center px-3 xxs:px-4 sm:px-0">
            <button
              type="button"
              onClick={handleSkip}
              className="min-h-[44px] w-full max-w-sm sm:max-w-none px-4 xs:px-5 py-2.5 text-sm font-semibold rounded-full bg-surface-muted/90 border border-secondary/40 text-secondary hover:bg-surface-muted hover:border-secondary/60 shadow-lg sm:shadow-sm backdrop-blur-sm transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
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

  return (
    <div className={className} aria-live="polite">
      {streamingOptInNotice}
      {personalizedIntro}
      {/* Mobile-optimized text with good line height and spacing - min-height prevents layout shift */}
      <div className="text-main text-[0.95rem] xxs:text-base md:text-lg leading-7 xs:leading-relaxed md:leading-loose max-w-[min(32rem,calc(100vw-2.25rem))] xxs:max-w-sm sm:max-w-[65ch] mx-auto text-left min-h-[5.5rem] xxs:min-h-[7rem] md:min-h-[10rem] px-2 xxs:px-3 sm:px-0">
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
        <div className="mt-4 xs:mt-5 sticky bottom-[max(1rem,env(safe-area-inset-bottom,1rem))] sm:static flex justify-center px-3 xxs:px-4 sm:px-0">
          <button
            type="button"
            onClick={handleSkip}
            className="min-h-[44px] w-full max-w-sm sm:max-w-none px-4 xs:px-5 py-2.5 text-sm font-semibold rounded-full bg-surface-muted/90 border border-secondary/40 text-secondary hover:bg-surface-muted hover:border-secondary/60 shadow-lg sm:shadow-sm backdrop-blur-sm transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
            aria-label="Show full narrative immediately"
          >
            Show all now →
          </button>
        </div>
      )}
    </div>
  );
}
