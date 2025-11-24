import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

function usePrefersReducedMotion() {
  const getInitialPreference = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  const [reduceMotion, setReduceMotion] = useState(getInitialPreference);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (event) => setReduceMotion(event.matches);

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', handleChange);
      return () => query.removeEventListener('change', handleChange);
    }

    if (typeof query.addListener === 'function') {
      query.addListener(handleChange);
      return () => query.removeListener(handleChange);
    }

    return undefined;
  }, []);

  return reduceMotion;
}

/**
 * Split text into words for gradual reveal, preserving spaces
 */
function splitIntoWords(text) {
  if (!text) return [];

  // Split by spaces while capturing them
  const parts = text.split(/(\s+)/);
  const words = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    // Keep both words and spaces as separate units
    // This ensures proper spacing between words
    words.push(part);
  }

  return words.filter(w => w.length > 0);
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
  const prefersReducedMotion = usePrefersReducedMotion();

  // Split text into reveal units (words)
  const units = useMemo(() => {
    if (!narrativeText) return [];
    return splitIntoWords(narrativeText);
  }, [narrativeText]);

  const [visibleCount, setVisibleCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [userSkipped, setUserSkipped] = useState(false);
  const timerRef = useRef(null);
  const completionNotifiedRef = useRef(false);
  const narrationTriggeredRef = useRef(false);

  const notifyCompletion = useCallback(() => {
    if (completionNotifiedRef.current) {
      return;
    }
    completionNotifiedRef.current = true;
    onDone?.();
  }, [onDone]);

  const clearTimer = () => {
    if (timerRef.current && typeof window !== 'undefined') {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Reset when text changes
  useEffect(() => {
    if (!isStreamingEnabled || prefersReducedMotion) {
      setVisibleCount(units.length);
      setIsComplete(true);
      setUserSkipped(false);
      completionNotifiedRef.current = false;
      narrationTriggeredRef.current = false;
      notifyCompletion();
      return;
    }

    setVisibleCount(0);
    setIsComplete(false);
    setUserSkipped(false);
    completionNotifiedRef.current = false;
    narrationTriggeredRef.current = false;
  }, [narrativeText, isStreamingEnabled, prefersReducedMotion, units.length, notifyCompletion]);

  // Streaming effect: reveal units one by one
  useEffect(() => {
    if (!isStreamingEnabled || prefersReducedMotion || units.length === 0) {
      return;
    }

    if (visibleCount >= units.length) {
      setIsComplete(true);
      notifyCompletion();
      return;
    }

    // Trigger auto-narration when streaming starts (first reveal only)
    if (visibleCount === 0 && autoNarrate && onNarrationStart && !narrationTriggeredRef.current) {
      narrationTriggeredRef.current = true;
      // Small delay to ensure component is ready
      window.setTimeout(() => {
        onNarrationStart(narrativeText);
      }, 200);
    }

    // Calculate delay between words for natural reading pace
    const currentWord = units[visibleCount] || '';
    const baseDelay = 60; // Base delay between words (60ms - faster pace)
    // Add extra delay for punctuation (pause at end of sentences/clauses)
    const hasPunctuation = /[.!?;:]/.test(currentWord);
    const delay = hasPunctuation ? baseDelay + 200 : baseDelay;

    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setVisibleCount((prev) => {
        const next = prev + 1;
        if (next >= units.length) {
          setIsComplete(true);
          notifyCompletion();
        }
        return next;
      });
    }, delay);

    return () => {
      clearTimer();
    };
  }, [visibleCount, units, isStreamingEnabled, prefersReducedMotion, notifyCompletion, autoNarrate, onNarrationStart, narrativeText]);

  const handleSkip = () => {
    if (units.length === 0) {
      return;
    }
    clearTimer();
    setVisibleCount(units.length);
    setIsComplete(true);
    setUserSkipped(true);
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
              className="text-xs text-secondary/80 hover:text-secondary underline decoration-dotted underline-offset-4 transition"
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
  return (
    <div className={className} aria-live="polite">
      <div className="text-main text-sm sm:text-base md:text-lg leading-relaxed md:leading-loose max-w-none mx-auto text-left">
        {visibleWords.map((word, idx) => {
          // Check if this is whitespace (space, newline, etc.)
          const isWhitespace = /^\s+$/.test(word);

          if (isWhitespace) {
            // Render whitespace without animation
            return <span key={idx}>{word}</span>;
          }

          // Render word with ink-spreading animation
          return (
            <span
              key={idx}
              className="inline-block animate-ink-spread opacity-0"
              style={{
                animation: prefersReducedMotion
                  ? 'none'
                  : 'inkSpread 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                animationDelay: '0ms',
                opacity: 1,
                willChange: 'opacity, filter, transform'
              }}
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
            className="text-xs text-secondary/80 hover:text-secondary underline decoration-dotted underline-offset-4 transition"
            aria-label="Show full narrative immediately"
          >
            Show all now →
          </button>
        </div>
      )}
    </div>
  );
}
