import React from 'react';
import ReactMarkdown from 'react-markdown';

const SUIT_ICONS = {
  Wands: '🔥',
  Cups: '💧',
  Swords: '🌬',
  Pentacles: '🌿'
};

const DEFAULT_ICONS = {
  'complete-triad': '✶',
  'partial-triad': '△',
  'fools-journey': '🃏',
  'high-dyad': '∞',
  'medium-high-dyad': '∞',
  'suit-progression': '♣',
  'emerging-suit-progression': '♣'
};

function getPatternIcon(type, suit) {
  if (type === 'suit-progression' || type === 'emerging-suit-progression') {
    return SUIT_ICONS[suit] || '♣';
  }
  return DEFAULT_ICONS[type] || '✦';
}

export function SpreadPatterns({ themes }) {
  const highlights = themes?.knowledgeGraph?.narrativeHighlights;
  if (!Array.isArray(highlights) || highlights.length === 0) {
    return null;
  }

  return (
    <div className="modern-surface spread-patterns-panel border border-secondary/40 p-4 sm:p-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-accent text-base sm:text-lg font-serif">Archetypal Patterns</span>
      </div>
      <ul className="pattern-list">
        {highlights.map((highlight, index) => (
          <li key={`${highlight.type}-${index}`} className={`pattern pattern-${highlight.type}`}>
            <span className="pattern-icon" aria-hidden="true">
              {getPatternIcon(highlight.type, highlight.suit)}
            </span>
            <ReactMarkdown className="pattern-text">
              {highlight.text}
            </ReactMarkdown>
          </li>
        ))}
      </ul>
    </div>
  );
}
