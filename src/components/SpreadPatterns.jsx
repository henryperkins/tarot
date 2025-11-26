import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Fire, Drop, Wind, Leaf, Star, Triangle, Path, Infinity as InfinityIcon, CaretDown, CaretUp, BookOpen } from '@phosphor-icons/react';

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

// Maximum length for passage text before truncation
const MAX_PASSAGE_LENGTH = 250;

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
 * Truncate text to a maximum length, adding ellipsis if needed
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength = MAX_PASSAGE_LENGTH) {
  if (!text || text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  // If no space found or space is too early, hard truncate
  return (lastSpace > 0 && lastSpace > maxLength * 0.8 ? truncated.slice(0, lastSpace) : truncated) + '…';
}

/**
 * Generate a stable unique key for a highlight item
 * @param {Object} highlight - Highlight object
 * @param {number} index - Array index as fallback
 * @param {string} [prefix] - Optional prefix for key uniqueness
 * @returns {string} Unique key
 */
function generateHighlightKey(highlight, index, prefix = '') {
  // Prefer explicit id if available
  if (highlight.id) return `${prefix}${highlight.id}`;
  if (highlight.key) return `${prefix}${highlight.key}`;

  // Create a deterministic key from type + text hash
  const typeKey = highlight.type || 'unknown';
  const textKey = (highlight.text || highlight.title || '')
    .slice(0, 50).replace(/\s+/g, '-').toLowerCase();

  return `${prefix}${typeKey}-${textKey}-${index}`;
}

/**
 * Generate stable key for passage
 * @param {Object} passage - Passage object
 * @param {number} index - Array index as fallback
 * @returns {string} Stable key
 */
function generatePassageKey(passage, index) {
  if (passage.id) return `passage-${passage.id}`;
  const titleKey = (passage.title || passage.theme || 'passage').slice(0, 20).replace(/\s+/g, '-');
  const sourceKey = (passage.source || '').slice(0, 15).replace(/\s+/g, '-');
  return `passage-${titleKey}-${sourceKey}-${index}`;
}

/**
 * SpreadPatterns - Unified component for all spread insights
 *
 * Displays all insight types in one place:
 * - spreadHighlights: Card relationship insights (suit dominance, reversals, etc.)
 * - themes.knowledgeGraph.narrativeHighlights: Archetypal patterns (triads, dyads, Fool's Journey)
 * - passages: Traditional wisdom from GraphRAG knowledge base
 *
 * @param {Object} props
 * @param {Object} props.themes - Themes containing knowledgeGraph.narrativeHighlights
 * @param {Array} props.spreadHighlights - Spread-specific highlight items from useReading
 * @param {Array} props.passages - Traditional wisdom passages from GraphRAG
 */
export function SpreadPatterns({ themes, spreadHighlights = [], passages = [] }) {
  const archetypeHighlights = themes?.knowledgeGraph?.narrativeHighlights || [];
  const [isExpanded, setIsExpanded] = useState(false);

  const hasArchetypes = Array.isArray(archetypeHighlights) && archetypeHighlights.length > 0;
  const hasSpreadHighlights = Array.isArray(spreadHighlights) && spreadHighlights.length > 0;
  const hasPassages = Array.isArray(passages) && passages.length > 0;

  if (!hasArchetypes && !hasSpreadHighlights && !hasPassages) {
    return null;
  }

  const totalCount = archetypeHighlights.length + spreadHighlights.length + passages.length;

  return (
    <div className="modern-surface spread-patterns-panel border border-secondary/40 p-4 sm:p-6 animate-fade-in">
      {/* Mobile: Collapsible header */}
      <button
        type="button"
        onClick={() => setIsExpanded(prev => !prev)}
        className="sm:hidden w-full flex items-center justify-between gap-2 mb-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 rounded"
        aria-expanded={isExpanded}
        aria-controls="spread-patterns-content-mobile"
      >
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-accent" aria-hidden="true" />
          <span className="text-accent text-base font-serif">Spread Insights</span>
          <span className="text-xs text-muted">({totalCount})</span>
        </div>
        {isExpanded ? (
          <CaretUp className="w-5 h-5 text-accent" aria-hidden="true" />
        ) : (
          <CaretDown className="w-5 h-5 text-accent" aria-hidden="true" />
        )}
      </button>

      {/* Desktop: Static header */}
      <div className="hidden sm:flex items-center gap-2 mb-4">
        <Star className="w-5 h-5 text-accent" aria-hidden="true" />
        <span className="text-accent text-lg font-serif">Spread Insights</span>
      </div>

      {/* Mobile: Collapsible content */}
      <div
        id="spread-patterns-content-mobile"
        className={`sm:hidden mt-3 space-y-4 ${isExpanded ? '' : 'hidden'}`}
      >
        {/* Spread Highlights Section */}
        {hasSpreadHighlights && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-accent/90">Highlights</h4>
            <ul className="space-y-2" role="list" aria-label="Spread highlights">
              {spreadHighlights.map((item, index) => (
                <li key={generateHighlightKey(item, index, 'spread-')} className="flex items-start gap-3">
                  <div className="text-accent mt-0.5 flex-shrink-0" aria-hidden="true">{item.icon}</div>
                  <div className="text-muted text-sm leading-snug">
                    <span className="font-semibold text-accent">{item.title}</span> {item.text}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Archetypal Patterns Section */}
        {hasArchetypes && (
          <div className={hasSpreadHighlights ? 'pt-3 border-t border-secondary/30' : ''}>
            <h4 className="text-sm font-semibold text-accent/90 mb-3">Archetypal Patterns</h4>
            <ul className="pattern-list space-y-2" role="list" aria-label="Detected archetypal patterns">
              {archetypeHighlights.map((highlight, index) => (
                <li
                  key={generateHighlightKey(highlight, index, 'archetype-')}
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
        )}

        {/* Traditional Wisdom Section */}
        {hasPassages && (
          <div className={(hasSpreadHighlights || hasArchetypes) ? 'pt-3 border-t border-secondary/30' : ''}>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-accent flex-shrink-0" aria-hidden="true" />
              <h4 className="text-sm font-semibold text-accent/90">Traditional Wisdom</h4>
            </div>
            <div className="space-y-3" role="list">
              {passages.map((passage, i) => (
                <article
                  key={generatePassageKey(passage, i)}
                  className="text-sm text-main/90 leading-relaxed bg-secondary/10 p-3 rounded border border-secondary/20"
                >
                  <p className="font-medium text-accent mb-1">{passage.title || passage.theme}</p>
                  <p className="italic opacity-90 mb-1">
                    &ldquo;{truncateText(passage.text)}&rdquo;
                  </p>
                  {passage.source && (
                    <p className="text-muted text-xs text-right mt-1">— {passage.source}</p>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Desktop: Always visible content */}
      <div className="hidden sm:block space-y-4">
        {/* Spread Highlights Section */}
        {hasSpreadHighlights && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-accent/90">Highlights</h4>
            <ul className="space-y-2" role="list" aria-label="Spread highlights">
              {spreadHighlights.map((item, index) => (
                <li key={generateHighlightKey(item, index, 'spread-')} className="flex items-start gap-3">
                  <div className="text-accent mt-0.5 flex-shrink-0" aria-hidden="true">{item.icon}</div>
                  <div className="text-muted text-sm leading-snug">
                    <span className="font-semibold text-accent">{item.title}</span> {item.text}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Archetypal Patterns Section */}
        {hasArchetypes && (
          <div className={hasSpreadHighlights ? 'pt-4 border-t border-secondary/30' : ''}>
            <h4 className="text-sm font-semibold text-accent/90 mb-3">Archetypal Patterns</h4>
            <ul className="pattern-list space-y-2" role="list" aria-label="Detected archetypal patterns">
              {archetypeHighlights.map((highlight, index) => (
                <li
                  key={generateHighlightKey(highlight, index, 'archetype-')}
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
        )}

        {/* Traditional Wisdom Section */}
        {hasPassages && (
          <div className={(hasSpreadHighlights || hasArchetypes) ? 'pt-4 border-t border-secondary/30' : ''}>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-accent flex-shrink-0" aria-hidden="true" />
              <h4 className="text-sm font-semibold text-accent/90">Traditional Wisdom</h4>
            </div>
            <div className="space-y-3" role="list">
              {passages.map((passage, i) => (
                <article
                  key={generatePassageKey(passage, i)}
                  className="text-sm text-main/90 leading-relaxed bg-secondary/10 p-3 rounded border border-secondary/20"
                >
                  <p className="font-medium text-accent mb-1">{passage.title || passage.theme}</p>
                  <p className="italic opacity-90 mb-1">
                    &ldquo;{truncateText(passage.text)}&rdquo;
                  </p>
                  {passage.source && (
                    <p className="text-muted text-xs text-right mt-1">— {passage.source}</p>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
