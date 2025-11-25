import { Sparkle, BookOpen } from '@phosphor-icons/react';

/** Maximum length for passage text before truncation */
const MAX_PASSAGE_LENGTH = 250;

/**
 * Truncate text to a maximum length, adding ellipsis if needed
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength = MAX_PASSAGE_LENGTH) {
  if (!text || text.length <= maxLength) return text;
  // Try to break at word boundary
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > maxLength * 0.8 ? truncated.slice(0, lastSpace) : truncated) + '…';
}

/**
 * Generate stable key for pattern
 * @param {Object} pattern - Pattern object
 * @param {number} index - Array index as fallback
 * @returns {string} Stable key
 */
function generatePatternKey(pattern, index) {
  if (pattern.id) return pattern.id;
  const typeKey = pattern.type || 'pattern';
  const textKey = (pattern.text || '').slice(0, 30).replace(/\s+/g, '-');
  return `${typeKey}-${textKey}-${index}`;
}

/**
 * Generate stable key for passage
 * @param {Object} passage - Passage object
 * @param {number} index - Array index as fallback
 * @returns {string} Stable key
 */
function generatePassageKey(passage, index) {
  if (passage.id) return passage.id;
  const titleKey = (passage.title || passage.theme || 'passage').slice(0, 20).replace(/\s+/g, '-');
  const sourceKey = (passage.source || '').slice(0, 15).replace(/\s+/g, '-');
  return `${titleKey}-${sourceKey}-${index}`;
}

/**
 * PatternHighlightBanner
 *
 * Displays detected archetypal patterns from GraphRAG knowledge graph analysis.
 * Shows users when traditional tarot patterns (triads, dyads, Fool's Journey stages)
 * are present in their spread.
 *
 * @param {Object[]} patterns - Array of narrative highlights from graphContext
 * @param {string} patterns[].text - Human-readable pattern description
 * @param {string} patterns[].type - Pattern type (triad, dyad, journey, etc.)
 * @param {Object[]} [passages] - Retrieved wisdom passages from GraphRAG
 * @param {boolean} minimal - Show condensed version (optional)
 */
export function PatternHighlightBanner({ patterns, passages, minimal = false }) {
  if ((!Array.isArray(patterns) || patterns.length === 0) && (!Array.isArray(passages) || passages.length === 0)) {
    return null;
  }

  if (minimal) {
    const count = (patterns?.length || 0) + (passages?.length || 0);
    return (
      <div className="mb-4 p-3 bg-gradient-to-r from-primary/20 to-accent/20
                      border border-primary/20 rounded-lg animate-pop-in">
        <div className="flex items-center gap-2">
          <Sparkle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <p className="text-xs text-main/90">
            {count} archetypal {count === 1 ? 'insight' : 'insights'} detected
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-primary/30 to-accent/30
                    border border-primary/30 rounded-lg shadow-lg animate-pop-in">

      {/* Patterns Section */}
      {patterns && patterns.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <Sparkle className="w-4 h-4 text-primary flex-shrink-0" />
            <h3 className="text-sm font-semibold text-main">
              Archetypal Patterns Detected
            </h3>
          </div>
          <ul className="space-y-2" role="list">
            {patterns.map((pattern, i) => (
              <li key={generatePatternKey(pattern, i)} className="flex items-start gap-2 text-xs leading-relaxed">
                <span className="text-primary mt-0.5 flex-shrink-0" aria-hidden="true">•</span>
                <span className="text-main/90">{pattern.text}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Passages Section */}
      {passages && passages.length > 0 && (
        <div className={`${patterns && patterns.length > 0 ? 'mt-4 pt-4 border-t border-primary/20' : ''}`}>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-primary flex-shrink-0" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-main">
              Traditional Wisdom
            </h3>
          </div>
          <div className="space-y-4" role="list">
            {passages.map((passage, i) => (
              <article
                key={generatePassageKey(passage, i)}
                className="text-xs text-main/90 leading-relaxed bg-primary/20 p-3 rounded border border-primary/10"
              >
                <p className="font-medium text-main mb-1">{passage.title || passage.theme}</p>
                <p className="italic opacity-90 mb-1">
                  &ldquo;{truncateText(passage.text)}&rdquo;
                </p>
                {passage.source && (
                  <p className="text-primary/70 text-xs text-right mt-1">— {passage.source}</p>
                )}
              </article>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 pt-3 border-t border-primary/20 text-xs text-muted italic">
        These patterns draw from traditional tarot wisdom and inform the reading below.
      </p>
    </div>
  );
}
