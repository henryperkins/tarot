import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight } from '@phosphor-icons/react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useSmallScreen } from '../hooks/useSmallScreen';
import {
  normalizeHighlightPhrases,
  computeHighlightRanges
} from '../lib/highlightUtils';

const LONG_MOBILE_WORD_THRESHOLD = 280;
const LONG_DESKTOP_WORD_THRESHOLD = 600; // Guardrail for very long narratives on any device
const BASE_WORD_DELAY = 45;
const PUNCTUATION_DELAY_BONUS = 160;

const EMOTION_ATMOSPHERE_MAP = [
  {
    keywords: ['triumphant', 'expansive', 'liberated', 'accomplished'],
    className: 'narrative-atmosphere--radiant'
  },
  {
    keywords: ['hopeful', 'warm', 'loving', 'tender', 'passionate', 'curious', 'inspiring', 'fulfilled'],
    className: 'narrative-atmosphere--warm'
  },
  {
    keywords: ['grounded', 'resourceful', 'abundant', 'authoritative', 'wise', 'promising'],
    className: 'narrative-atmosphere--grounded'
  },
  {
    keywords: ['contemplative', 'introspective', 'accepting', 'serene', 'mysterious', 'peaceful'],
    className: 'narrative-atmosphere--cool'
  },
  {
    keywords: ['grieving', 'conflicted', 'cautionary', 'transformative', 'profound', 'weary', 'thoughtful', 'determined'],
    className: 'narrative-atmosphere--shadow'
  }
];

function getAtmosphereToneClass(emotionalTone) {
  const emotion = typeof emotionalTone?.emotion === 'string'
    ? emotionalTone.emotion.toLowerCase()
    : '';
  if (!emotion || emotion === 'default') return '';

  const match = EMOTION_ATMOSPHERE_MAP.find(entry =>
    entry.keywords.some(keyword => emotion.includes(keyword))
  );
  return match?.className || '';
}

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

function buildTokenMeta(tokens, highlightRanges) {
  const safeTokens = Array.isArray(tokens) ? tokens : [];
  const safeRanges = Array.isArray(highlightRanges) ? highlightRanges : [];

  const meta = new Array(safeTokens.length);
  let cursor = 0;
  let rangeIndex = 0;

  for (let i = 0; i < safeTokens.length; i++) {
    const token = safeTokens[i] || '';
    const start = cursor;
    const end = cursor + token.length;
    cursor = end;

    const isWhitespace = /^\s+$/.test(token);
    let isHighlighted = false;

    if (!isWhitespace && safeRanges.length > 0) {
      while (rangeIndex < safeRanges.length && safeRanges[rangeIndex][1] <= start) {
        rangeIndex += 1;
      }
      const activeRange = safeRanges[rangeIndex];
      isHighlighted = Boolean(activeRange && start < activeRange[1] && end > activeRange[0]);
    }

    meta[i] = { isWhitespace, isHighlighted };
  }

  return meta;
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
  highlightPhrases = [],
  emotionalTone = null,
  onHighlightPhrase,
  withAtmosphere = false,
  atmosphereClassName = '',
}) {
  const narrativeText = useMemo(() => (typeof text === 'string' ? text : ''), [text]);
  const prefersReducedMotion = useReducedMotion();
  const isSmallScreen = useSmallScreen();
  const wrapperClassName = className ? `narrative-stream ${className}` : 'narrative-stream';
  const atmosphereToneClass = useMemo(() => getAtmosphereToneClass(emotionalTone), [emotionalTone]);

  const normalizedHighlightPhrases = useMemo(
    () => normalizeHighlightPhrases(highlightPhrases),
    [highlightPhrases]
  );

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
  // Initialize to null so render-time adjustment runs on first mount
  // (narrativeText is always a string, so null will never match)
  const [prevNarrativeText, setPrevNarrativeText] = useState(null);

  // Refs for cleanup and tracking
  const timerRef = useRef(null);
  const narrationTimerRef = useRef(null);
  const completionNotifiedRef = useRef(false);
  const narrationTriggeredRef = useRef(false);
  const triggeredHighlightRef = useRef(new Set());

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
    triggeredHighlightRef.current = new Set();
  }, [narrativeText, clearTimer, clearNarrationTimer]);

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

  const visibleWords = units.slice(0, visibleCount);
  const visiblePlainText = useMemo(() => {
    if (!visibleWords.length) return '';
    return visibleWords.join('');
  }, [visibleWords]);

  const visibleTextForHighlights = useMemo(() => {
    if (useMarkdown) {
      return visibleWords.join('');
    }
    return visiblePlainText;
  }, [useMarkdown, visibleWords, visiblePlainText]);

  useEffect(() => {
    if (!streamingActive) return;
    if (!onHighlightPhrase) return;
    if (!normalizedHighlightPhrases.length) return;
    if (!visibleTextForHighlights) return;

    const lowerText = visibleTextForHighlights.toLowerCase();
    const triggered = triggeredHighlightRef.current;

    normalizedHighlightPhrases.forEach((phrase) => {
      const key = phrase.toLowerCase();
      if (triggered.has(key)) return;
      if (!lowerText.includes(key)) return;
      triggered.add(key);
      onHighlightPhrase(phrase);
    });
  }, [streamingActive, onHighlightPhrase, normalizedHighlightPhrases, visibleTextForHighlights]);

  const atmosphereClass = useMemo(() => (
    withAtmosphere
      ? ['narrative-atmosphere', atmosphereToneClass, atmosphereClassName].filter(Boolean).join(' ')
      : ''
  ), [withAtmosphere, atmosphereToneClass, atmosphereClassName]);


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

  const highlightRanges = useMemo(() => {
    if (useMarkdown) return [];
    if (!normalizedHighlightPhrases.length) return [];
    if (!visiblePlainText) return [];
    return computeHighlightRanges(visiblePlainText, normalizedHighlightPhrases);
  }, [useMarkdown, normalizedHighlightPhrases, visiblePlainText]);

  const showSkipButton = streamingActive && !isComplete;
  const textBottomPaddingClass = showSkipButton
    ? 'pb-16 sm:pb-10 short:pb-12'
    : 'pb-6 sm:pb-6 short:pb-4';
  const stickyActionClass = 'bottom-safe-action';

  // Memoize willChange styles to avoid creating new objects per word per render
  // Animation timing now controlled solely by Tailwind's animate-ink-spread class
  // Must be defined before any conditional returns to satisfy Rules of Hooks
  const recentWordStyle = useMemo(() => ({
    willChange: 'opacity, filter, transform'
  }), []);

  const settledWordStyle = useMemo(() => ({
    willChange: 'auto'
  }), []);

  const tokenMeta = useMemo(() => {
    if (useMarkdown) return [];
    return buildTokenMeta(visibleWords, highlightRanges);
  }, [useMarkdown, visibleWords, highlightRanges]);

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
      <div className={wrapperClassName} aria-live="polite">
        {streamingOptInNotice}
        {personalizedIntro}
        {/* Container with min-height to prevent layout shift during streaming */}
        <div className={`prose prose-sm xxs:prose-base md:prose-lg max-w-[min(34rem,calc(100vw-2.75rem))] xxs:max-w-[40ch] sm:max-w-[70ch] w-full min-h-[6rem] xxs:min-h-[7.5rem] md:min-h-[10rem] px-3 xxs:px-4 sm:px-1 mx-auto rounded-2xl bg-surface/70 border border-secondary/30 shadow-md narrative-stream__text narrative-stream__text--md ${atmosphereClass} ${textBottomPaddingClass}`}>
          <MarkdownRenderer content={visibleText} highlightPhrases={normalizedHighlightPhrases} />
        </div>

        {showSkipButton && (
          <div className={`mt-4 xs:mt-5 sticky sm:static flex justify-center px-3 xxs:px-4 sm:px-0 narrative-stream__actions ${stickyActionClass}`}>
            <button
              type="button"
              onClick={handleSkip}
              className="min-h-touch w-full max-w-sm sm:max-w-none px-4 xs:px-5 py-2.5 text-sm font-semibold rounded-full bg-surface-muted/90 border border-secondary/40 text-secondary hover:bg-surface-muted hover:border-secondary/60 shadow-lg sm:shadow-sm backdrop-blur-sm transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
              aria-label="Show full narrative immediately"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <span>Show all now</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // For plain text: render words with ink-spreading effect
  // Only apply willChange to recently revealed words to avoid GPU memory exhaustion
  const RECENT_WORDS_THRESHOLD = 10;
  const EMPHASIS_POP_THRESHOLD = 8;

  return (
    <div className={wrapperClassName} aria-live="polite">
      {streamingOptInNotice}
      {personalizedIntro}
      {/* Mobile-optimized text with good line height and spacing - min-height prevents layout shift */}
      <div className={`text-main text-[1rem] xxs:text-[1.05rem] md:text-lg leading-[1.85] md:leading-loose max-w-[min(34rem,calc(100vw-2.75rem))] xxs:max-w-[40ch] sm:max-w-[68ch] mx-auto text-left min-h-[5.5rem] xxs:min-h-[7.5rem] md:min-h-[10rem] px-3 xxs:px-4 sm:px-1 rounded-2xl bg-surface/70 border border-secondary/30 shadow-md narrative-stream__text narrative-stream__text--plain ${atmosphereClass} ${textBottomPaddingClass}`}>
        {visibleWords.map((word, idx) => {
          const meta = tokenMeta[idx] || { isWhitespace: /^\s+$/.test(word), isHighlighted: false };

          if (meta.isWhitespace) {
            // Render whitespace without animation
            return <span key={idx}>{word}</span>;
          }

          // Only recent words get willChange hint to avoid exhausting GPU memory
          const isRecentWord = idx >= visibleCount - RECENT_WORDS_THRESHOLD;
          const shouldPop = meta.isHighlighted && idx >= visibleCount - EMPHASIS_POP_THRESHOLD;

          // Render word with ink-spreading animation
          return (
            <span
              key={idx}
              className={`inline-block ${prefersReducedMotion ? '' : 'animate-ink-spread'} ${meta.isHighlighted ? 'narrative-emphasis' : ''} ${shouldPop ? 'narrative-emphasis--pop' : ''}`}
              style={prefersReducedMotion ? undefined : (isRecentWord ? recentWordStyle : settledWordStyle)}
            >
              {word}
            </span>
          );
        })}
      </div>

      {showSkipButton && (
        <div className={`mt-4 xs:mt-5 sticky sm:static flex justify-center px-3 xxs:px-4 sm:px-0 narrative-stream__actions ${stickyActionClass}`}>
          <button
            type="button"
            onClick={handleSkip}
            className="min-h-touch w-full max-w-sm sm:max-w-none px-4 xs:px-5 py-2.5 text-sm font-semibold rounded-full bg-surface-muted/90 border border-secondary/40 text-secondary hover:bg-surface-muted hover:border-secondary/60 shadow-lg sm:shadow-sm backdrop-blur-sm transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
            aria-label="Show full narrative immediately"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <span>Show all now</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
