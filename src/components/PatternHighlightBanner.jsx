import React from 'react';
import { Sparkles, BookOpen } from 'lucide-react';

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
      <div className="mb-4 p-3 bg-gradient-to-r from-purple-900/20 to-indigo-900/20
                      border border-purple-400/20 rounded-lg animate-pop-in">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-purple-300 flex-shrink-0" />
          <p className="text-xs text-purple-200/90">
            {count} archetypal {count === 1 ? 'insight' : 'insights'} detected
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-purple-900/30 to-indigo-900/30
                    border border-purple-400/30 rounded-lg shadow-lg animate-pop-in">

      {/* Patterns Section */}
      {patterns && patterns.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-purple-300 flex-shrink-0" />
            <h3 className="text-sm font-semibold text-purple-200">
              Archetypal Patterns Detected
            </h3>
          </div>
          <ul className="space-y-2">
            {patterns.map((pattern, i) => (
              <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                <span className="text-purple-400 mt-0.5 flex-shrink-0">•</span>
                <span className="text-purple-100/90">{pattern.text}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Passages Section */}
      {passages && passages.length > 0 && (
        <div className={`${patterns && patterns.length > 0 ? 'mt-4 pt-4 border-t border-purple-400/20' : ''}`}>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-purple-300 flex-shrink-0" />
            <h3 className="text-sm font-semibold text-purple-200">
              Traditional Wisdom
            </h3>
          </div>
          <div className="space-y-4">
            {passages.map((passage, i) => (
              <div key={i} className="text-xs text-purple-100/90 leading-relaxed bg-purple-900/20 p-3 rounded border border-purple-500/10">
                <p className="font-medium text-purple-200 mb-1">{passage.title || passage.theme}</p>
                <p className="italic opacity-90 mb-1">"{passage.text}"</p>
                {passage.source && (
                  <p className="text-purple-300/60 text-[10px] text-right">— {passage.source}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 pt-3 border-t border-purple-400/20 text-xs text-purple-200/70 italic">
        These patterns draw from traditional tarot wisdom and inform the reading below.
      </p>
    </div>
  );
}
