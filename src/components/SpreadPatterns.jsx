import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Fire, Drop, Wind, Leaf, Star, Triangle, Path, Infinity as InfinityIcon, CaretDown, CaretUp } from '@phosphor-icons/react';

// Suit icons using Phosphor icons for consistent rendering
const SUIT_ICONS = {
  Wands: <Fire className="w-4 h-4 text-orange-500" weight="fill" aria-hidden="true" />,
  Cups: <Drop className="w-4 h-4 text-blue-400" weight="fill" aria-hidden="true" />,
  Swords: <Wind className="w-4 h-4 text-sky-300" weight="fill" aria-hidden="true" />,
  Pentacles: <Leaf className="w-4 h-4 text-green-500" weight="fill" aria-hidden="true" />
};

// Pattern type icons
const PATTERN_ICONS = {
  'complete-triad': <Star className="w-4 h-4 text-accent" weight="fill" aria-hidden="true" />,
  'partial-triad': <Triangle className="w-4 h-4 text-accent" aria-hidden="true" />,
  'fools-journey': <Path className="w-4 h-4 text-accent" aria-hidden="true" />,
  'high-dyad': <InfinityIcon className="w-4 h-4 text-accent" aria-hidden="true" />,
  'medium-high-dyad': <InfinityIcon className="w-4 h-4 text-accent" aria-hidden="true" />,
  'suit-progression': null, // Uses suit-specific icon
  'emerging-suit-progression': null // Uses suit-specific icon
};

// Default icon for unknown pattern types
const DEFAULT_ICON = <Star className="w-4 h-4 text-accent" aria-hidden="true" />;

/**
 * Get the appropriate icon for a pattern type
 * @param {string} type - Pattern type identifier
 * @param {string} [suit] - Optional suit name for suit progressions
 * @returns {JSX.Element} Icon component
 */
function getPatternIcon(type, suit) {
  // For suit progressions, use the suit icon
  if (type === 'suit-progression' || type === 'emerging-suit-progression') {
    return SUIT_ICONS[suit] || SUIT_ICONS.Wands;
  }
  // For other patterns, use the pattern icon
  return PATTERN_ICONS[type] || DEFAULT_ICON;
}

/**
 * Generate a stable unique key for a highlight item
 * @param {Object} highlight - Highlight object
 * @param {number} index - Array index as fallback
 * @returns {string} Unique key
 */
function generateHighlightKey(highlight, index) {
  // Prefer explicit id if available
  if (highlight.id) return highlight.id;

  // Create a deterministic key from type + text hash
  const typeKey = highlight.type || 'unknown';
  const textKey = highlight.text
    ? highlight.text.slice(0, 50).replace(/\s+/g, '-').toLowerCase()
    : index;

  return `${typeKey}-${textKey}-${index}`;
}

export function SpreadPatterns({ themes }) {
  const highlights = themes?.knowledgeGraph?.narrativeHighlights;
  // Default collapsed on mobile to reduce cognitive load
  const [isExpanded, setIsExpanded] = useState(false);

  if (!Array.isArray(highlights) || highlights.length === 0) {
    return null;
  }

  return (
    <div className="modern-surface spread-patterns-panel border border-secondary/40 p-4 sm:p-6 animate-fade-in">
      {/* Mobile: Collapsible header */}
      <button
        type="button"
        onClick={() => setIsExpanded(prev => !prev)}
        className="sm:hidden w-full flex items-center justify-between gap-2 mb-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 rounded"
        aria-expanded={isExpanded}
        aria-controls="spread-patterns-list-mobile"
      >
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-accent" aria-hidden="true" />
          <span className="text-accent text-base font-serif">Archetypal Patterns</span>
          <span className="text-xs text-muted">({highlights.length})</span>
        </div>
        {isExpanded ? (
          <CaretUp className="w-5 h-5 text-accent" aria-hidden="true" />
        ) : (
          <CaretDown className="w-5 h-5 text-accent" aria-hidden="true" />
        )}
      </button>

      {/* Desktop: Static header */}
      <div className="hidden sm:flex items-center gap-2 mb-3">
        <Star className="w-5 h-5 text-accent" aria-hidden="true" />
        <span className="text-accent text-lg font-serif">Archetypal Patterns</span>
      </div>

      {/* Mobile: Collapsible list */}
      <ul
        id="spread-patterns-list-mobile"
        className={`sm:hidden pattern-list space-y-2 mt-3 ${isExpanded ? '' : 'hidden'}`}
        role="list"
        aria-label="Detected archetypal patterns"
      >
        {highlights.map((highlight, index) => (
          <li
            key={generateHighlightKey(highlight, index)}
            className={`pattern pattern-${highlight.type || 'default'} flex items-start gap-2`}
          >
            <span className="pattern-icon flex-shrink-0 mt-0.5" aria-hidden="true">
              {getPatternIcon(highlight.type, highlight.suit)}
            </span>
            <ReactMarkdown
              className="pattern-text text-sm text-main/90 leading-relaxed"
              components={{
                p: ({ children }) => <span>{children}</span>,
                strong: ({ children }) => <strong className="font-semibold text-accent">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>
              }}
            >
              {highlight.text || ''}
            </ReactMarkdown>
          </li>
        ))}
      </ul>

      {/* Desktop: Always visible list */}
      <ul className="hidden sm:block pattern-list space-y-2" role="list" aria-label="Detected archetypal patterns">
        {highlights.map((highlight, index) => (
          <li
            key={generateHighlightKey(highlight, index)}
            className={`pattern pattern-${highlight.type || 'default'} flex items-start gap-2`}
          >
            <span className="pattern-icon flex-shrink-0 mt-0.5" aria-hidden="true">
              {getPatternIcon(highlight.type, highlight.suit)}
            </span>
            <ReactMarkdown
              className="pattern-text text-sm text-main/90 leading-relaxed"
              components={{
                p: ({ children }) => <span>{children}</span>,
                strong: ({ children }) => <strong className="font-semibold text-accent">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>
              }}
            >
              {highlight.text || ''}
            </ReactMarkdown>
          </li>
        ))}
      </ul>
    </div>
  );
}
