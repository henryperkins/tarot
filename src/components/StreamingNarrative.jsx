import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

function usePrefersReducedMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(query.matches);

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

const paragraphClass = 'text-[0.9rem] sm:text-base md:text-lg leading-relaxed md:leading-loose whitespace-pre-line';

function splitParagraphs(text) {
  return text
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean);
}

function nextChunkSize(remaining) {
  const base = 8 + Math.floor(Math.random() * 6); // 8–13 characters per tick
  return remaining < base ? remaining : base;
}

function nextDelay(lastChar) {
  let delay = 28 + Math.random() * 26; // 28–54ms baseline

  if (lastChar === '\n') delay += 120;
  if (lastChar === ',' || lastChar === ';' || lastChar === ':') delay += 60;
  if (/[.!?]/.test(lastChar)) delay += 170;

  return Math.min(delay, 360);
}

export function StreamingNarrative({
  text,
  useMarkdown = false,
  className = '',
  isStreamingEnabled = true,
  onDone,
}) {
  const narrativeText = useMemo(() => (typeof text === 'string' ? text : ''), [text]);
  const [displayed, setDisplayed] = useState(narrativeText ? '' : '');
  const [isComplete, setIsComplete] = useState(!narrativeText);
  const prefersReducedMotion = usePrefersReducedMotion();
  const timerRef = useRef(null);

  useEffect(() => {
    setDisplayed(isStreamingEnabled ? '' : narrativeText);
    setIsComplete(!isStreamingEnabled || !narrativeText);
  }, [narrativeText, isStreamingEnabled]);

  useEffect(() => {
    if (!narrativeText || !isStreamingEnabled || prefersReducedMotion) {
      setDisplayed(narrativeText);
      setIsComplete(true);
      onDone?.();
      return undefined;
    }

    timerRef.current = window.setTimeout(function step() {
      setDisplayed((prev) => {
        const remaining = narrativeText.length - prev.length;
        if (remaining <= 0) {
          setIsComplete(true);
          onDone?.();
          return narrativeText;
        }

        const chunk = nextChunkSize(remaining);
        const next = narrativeText.slice(0, prev.length + chunk);

        if (next.length >= narrativeText.length) {
          setIsComplete(true);
          onDone?.();
        } else {
          const delay = nextDelay(next[next.length - 1] || '');
          timerRef.current = window.setTimeout(step, delay);
        }

        return next;
      });
    }, 60);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [narrativeText, isStreamingEnabled, prefersReducedMotion, onDone]);

  const paragraphs = useMemo(() => splitParagraphs(displayed || ''), [displayed]);

  return (
    <div className={className} aria-live="polite">
      {useMarkdown ? (
        <div className="space-y-2">
          <MarkdownRenderer content={displayed || ' '} />
          {!isComplete && (
            <span
              className="inline-block h-[1.2em] w-[0.55ch] rounded-sm bg-secondary/80 align-middle animate-pulse"
              aria-hidden="true"
            />
          )}
        </div>
      ) : (
        <div className="text-main space-y-2 sm:space-y-3 md:space-y-4 max-w-none mx-auto text-left">
          {paragraphs.length > 0 ? (
            paragraphs.map((para, idx) => (
              <p key={idx} className={paragraphClass}>{para}</p>
            ))
          ) : displayed ? (
            <p className={paragraphClass}>{displayed}</p>
          ) : null}
          {!isComplete && (
            <span
              className="inline-block h-[1.2em] w-[0.55ch] rounded-sm bg-secondary/80 align-middle animate-pulse"
              aria-hidden="true"
            />
          )}
        </div>
      )}
    </div>
  );
}
