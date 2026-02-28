import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight } from '@phosphor-icons/react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useSmallScreen } from '../hooks/useSmallScreen';
import {
  normalizeHighlightPhrases,
  computeHighlightRanges
} from '../lib/highlightUtils';
import { getSectionKeyFromHeading } from '../lib/narrativeSections';
import { STREAM_AUTO_NARRATE_DEBOUNCE_MS } from '../lib/narrationStream.js';

const LONG_MOBILE_WORD_THRESHOLD = 200;
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

function computeRevealStep({ totalWords, useMarkdown, isSmallScreen }) {
  if (!totalWords || totalWords < 1) return 1;

  // Markdown parsing is significantly heavier than plain text rendering.
  // Reveal larger chunks to keep update frequency low on constrained devices.
  if (useMarkdown && isSmallScreen) {
    return Math.max(6, Math.ceil(totalWords / 26));
  }

  if (useMarkdown) {
    return Math.max(3, Math.ceil(totalWords / 48));
  }

  if (isSmallScreen && totalWords > 120) {
    return Math.max(2, Math.ceil(totalWords / 90));
  }

  if (totalWords > 420) {
    return 2;
  }

  return 1;
}

function computeRevealDelay(chunkText, revealStep) {
  const hasPunctuation = /[.!?;:]/.test(chunkText);
  const baseDelay = Math.max(BASE_WORD_DELAY, BASE_WORD_DELAY * Math.max(1, revealStep));
  return Math.min(
    hasPunctuation ? baseDelay + PUNCTUATION_DELAY_BONUS : baseDelay,
    420
  );
}

function findTokenIndexForOffset(tokens, offset) {
  if (!Array.isArray(tokens) || tokens.length === 0) return -1;
  if (typeof offset !== 'number' || offset < 0) return -1;

  let cursor = 0;
  let passedOffset = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] || '';
    const start = cursor;
    const end = cursor + token.length;
    cursor = end;

    if (!passedOffset && offset >= start && offset < end) {
      passedOffset = true;
      if (!/^\s+$/.test(token)) {
        return i;
      }
    }

    if (passedOffset && !/^\s+$/.test(token)) {
      return i;
    }
  }

  return -1;
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
  onSectionEnter,
  withAtmosphere = false,
  atmosphereClassName = '',
  wordBoundary = null,
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
  const revealStep = useMemo(
    () => computeRevealStep({ totalWords, useMarkdown, isSmallScreen }),
    [totalWords, useMarkdown, isSmallScreen]
  );

  const ttsWordIndex = useMemo(() => {
    if (useMarkdown) return -1;
    if (!wordBoundary) return -1;
    const offset = wordBoundary.textOffset;
    return findTokenIndexForOffset(units, offset);
  }, [units, useMarkdown, wordBoundary]);

  const isLongMobileNarrative = isSmallScreen && totalWords > LONG_MOBILE_WORD_THRESHOLD;
  const isMarkdownMobileNarrative = isSmallScreen && useMarkdown;
  const shouldSuppressMobileStreaming = isLongMobileNarrative || isMarkdownMobileNarrative;
  const isVeryLongNarrative = totalWords > LONG_DESKTOP_WORD_THRESHOLD;
  const shouldStreamOnNarrativeReset = Boolean(
    isStreamingEnabled &&
    !prefersReducedMotion &&
    units.length > 0 &&
    !isVeryLongNarrative &&
    !shouldSuppressMobileStreaming
  );
  const [mobileStreamingOptIn, setMobileStreamingOptIn] = useState(false);
  const [visibleCount, setVisibleCount] = useState(() => (
    shouldStreamOnNarrativeReset ? 0 : units.length
  ));

  // Refs for cleanup and tracking
  const timerRef = useRef(null);
  const narrationTimerRef = useRef(null);
  const completionNotifiedRef = useRef(false);
  const narrationTriggeredRef = useRef(false);
  const triggeredHighlightRef = useRef(new Set());
  const triggeredSectionRef = useRef(new Set());
  const prevNarrativeTextRef = useRef(null);

  const streamingActive = Boolean(
    isStreamingEnabled &&
    !prefersReducedMotion &&
    units.length > 0 &&
    !isVeryLongNarrative && // Guardrail: skip streaming for extremely long text on any device
    (!shouldSuppressMobileStreaming || mobileStreamingOptIn)
  );
  const streamingSuppressedForMobile = Boolean(
    isStreamingEnabled &&
    !prefersReducedMotion &&
    shouldSuppressMobileStreaming &&
    !isVeryLongNarrative &&
    !mobileStreamingOptIn
  );

  // Derive isComplete from visibleCount (no need for separate state)
  const isComplete = units.length > 0 && visibleCount >= units.length;

  useEffect(() => {
    if (prevNarrativeTextRef.current === narrativeText) {
      return;
    }
    prevNarrativeTextRef.current = narrativeText;
    // Reset completion flag immediately on text change to prevent race condition
    // where isComplete is true before state reset completes
    completionNotifiedRef.current = false;

    queueMicrotask(() => {
      setMobileStreamingOptIn(false);
      setVisibleCount(shouldStreamOnNarrativeReset ? 0 : units.length);
    });
  }, [narrativeText, shouldStreamOnNarrativeReset, units.length]);

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
    triggeredSectionRef.current = new Set();
  }, [narrativeText, clearTimer, clearNarrationTimer]);

  // Notify completion when all content is visible
  // This effect only calls external callback, no setState
  useEffect(() => {
    // Guard against firing completion for stale text during async reset
    if (isComplete && !completionNotifiedRef.current && prevNarrativeTextRef.current === narrativeText) {
      notifyCompletion();
    }
  }, [isComplete, notifyCompletion, narrativeText]);

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
      }, STREAM_AUTO_NARRATE_DEBOUNCE_MS);
    } else if (!streamingActive) {
      narrationTriggeredRef.current = true;
      narrationTimerRef.current = window.setTimeout(() => {
        onNarrationStart(textToNarrate);
      }, STREAM_AUTO_NARRATE_DEBOUNCE_MS);
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

    const nextChunk = units.slice(visibleCount, Math.min(units.length, visibleCount + revealStep)).join('');
    const delay = computeRevealDelay(nextChunk, revealStep);

    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + revealStep, units.length));
    }, delay);

    return () => {
      clearTimer();
    };
  }, [visibleCount, units, streamingActive, revealStep, clearTimer]);

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
  }, [onHighlightPhrase, normalizedHighlightPhrases, visibleTextForHighlights]);

  useEffect(() => {
    if (!useMarkdown || !onSectionEnter) return;
    if (!visibleTextForHighlights) return;

    const seen = triggeredSectionRef.current;
    const matches = visibleTextForHighlights.matchAll(/^#{2,6}\s+(.+)$/gm);
    for (const match of matches) {
      const heading = match?.[1] || '';
      const sectionKey = getSectionKeyFromHeading(heading);
      if (!sectionKey || seen.has(sectionKey)) continue;
      seen.add(sectionKey);
      onSectionEnter(sectionKey);
    }
  }, [useMarkdown, onSectionEnter, visibleTextForHighlights]);

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
  const narrationStatusMessage = useMemo(() => {
    if (!narrativeText) return '';
    if (streamingActive && !isComplete) {
      return showSkipButton
        ? 'Narrative is revealing. Use Show all now to reveal it immediately.'
        : 'Narrative is revealing.';
    }
    return 'Narrative ready.';
  }, [narrativeText, streamingActive, isComplete, showSkipButton]);

  const tokenMeta = useMemo(() => {
    if (useMarkdown) return [];
    return buildTokenMeta(visibleWords, highlightRanges);
  }, [useMarkdown, visibleWords, highlightRanges]);

  const streamingSuppressionMessage = isMarkdownMobileNarrative
    ? 'Markdown readings show instantly on small screens for smoother performance.'
    : 'Long readings show instantly on small screens.';
  const streamingOptInNotice = streamingSuppressedForMobile ? (
    <div className="sm:hidden mb-3 rounded-xl border border-secondary/40 bg-surface/80 px-3 xxs:px-4 py-3 text-center">
      <p className="text-xs-plus text-muted mb-2">{streamingSuppressionMessage}</p>
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
  const skipButton = showSkipButton ? (
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
  ) : null;

  // For markdown: render completed text progressively
  if (useMarkdown) {
    const visibleText = visibleWords.join('');
    return (
      <div className={wrapperClassName} aria-live="off">
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {narrationStatusMessage}
        </p>
        {streamingOptInNotice}
        {personalizedIntro}
        {/* Container with min-height to prevent layout shift during streaming */}
        <div className={`prose prose-sm xxs:prose-base md:prose-lg max-w-[min(34rem,calc(100vw-2.75rem))] xxs:max-w-[40ch] sm:max-w-[70ch] w-full min-h-[6rem] xxs:min-h-[7.5rem] md:min-h-[10rem] px-3 xxs:px-4 sm:px-1 mx-auto rounded-2xl bg-surface/70 border border-secondary/30 shadow-md narrative-stream__text narrative-stream__text--md ${atmosphereClass} ${textBottomPaddingClass}`}>
          <MarkdownRenderer
            content={visibleText}
            highlightPhrases={normalizedHighlightPhrases}
            wordBoundary={wordBoundary}
          />
        </div>

        {skipButton}
      </div>
    );
  }

  // For plain text: render words with streaming animation
  const EMPHASIS_POP_THRESHOLD = 8;

  return (
    <div className={wrapperClassName} aria-live="off">
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {narrationStatusMessage}
      </p>
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

          const shouldPop = meta.isHighlighted && idx >= visibleCount - EMPHASIS_POP_THRESHOLD;
          const isTtsWord = idx === ttsWordIndex && idx < visibleCount;
          
          // Use CSS animation for word reveal to avoid JS bottleneck on long narratives
          // Animate only the most recently revealed word(s) to match incremental reveal behavior
          const revealWindowStart = Math.max(0, visibleCount - revealStep);
          const isNewWord = idx >= revealWindowStart
            && idx < visibleCount
            && streamingActive
            && !prefersReducedMotion
            && !isSmallScreen;

          return (
            <span
              key={idx}
              className={`inline-block ${isNewWord ? 'narrative-word-reveal' : ''} ${meta.isHighlighted ? 'narrative-emphasis' : ''} ${shouldPop ? 'narrative-emphasis--pop' : ''} ${isTtsWord ? 'narrative-tts-word narrative-tts-word--active' : ''}`}
            >
              {word}
            </span>
          );
        })}
      </div>

      {skipButton}
    </div>
  );
}
