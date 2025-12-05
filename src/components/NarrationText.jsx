import React from 'react';
import { useReading } from '../contexts/ReadingContext';

/**
 * Highlights the currently spoken word when using the Azure Speech SDK provider.
 * Wrap narrative text with this component to surface real-time word tracking.
 */
export function NarrationText({ text, className = '' }) {
  const { wordBoundary, ttsState, ttsProvider } = useReading();

  const shouldHighlight =
    ttsProvider === 'azure-sdk' &&
    ttsState?.status === 'playing' &&
    wordBoundary &&
    typeof text === 'string';

  if (!shouldHighlight) {
    return <p className={`narration-text ${className}`}>{text}</p>;
  }

  const { textOffset = -1, wordLength = 0 } = wordBoundary;

  if (textOffset < 0 || textOffset >= text.length || wordLength <= 0) {
    return <p className={`narration-text ${className}`}>{text}</p>;
  }

  const before = text.slice(0, textOffset);
  const word = text.slice(textOffset, textOffset + wordLength);
  const after = text.slice(textOffset + wordLength);

  return (
    <p className={`narration-text ${className}`}>
      {before}
      <span className="highlighted-word">{word}</span>
      {after}
    </p>
  );
}

/**
 * Suggested CSS:
 * .highlighted-word {
 *   background: linear-gradient(120deg, #a855f7 0%, #ec4899 100%);
 *   -webkit-background-clip: text;
 *   background-clip: text;
 *   color: transparent;
 *   font-weight: 600;
 *   transition: all 0.1s ease;
 *   padding: 0 2px;
 * }
 *
 * .narration-text {
 *   line-height: 1.8;
 *   font-size: 1.1rem;
 * }
 */
