import React from 'react';
import { Sparkles } from 'lucide-react';

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
 * @param {boolean} minimal - Show condensed version (optional)
 */
export function PatternHighlightBanner({ patterns, minimal = false }) {
  if (!Array.isArray(patterns) || patterns.length === 0) {
    return null;
  }

  if (minimal) {
    return (
      <div className="mb-4 p-3 bg-gradient-to-r from-purple-900/20 to-indigo-900/20
                      border border-purple-400/20 rounded-lg animate-pop-in">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-purple-300 flex-shrink-0" />
          <p className="text-xs text-purple-200/90">
            {patterns.length} archetypal {patterns.length === 1 ? 'pattern' : 'patterns'} detected
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-purple-900/30 to-indigo-900/30
                    border border-purple-400/30 rounded-lg shadow-lg animate-pop-in">
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
      <p className="mt-3 pt-3 border-t border-purple-400/20 text-xs text-purple-200/70 italic">
        These patterns draw from traditional tarot wisdom and inform the reading below.
      </p>
    </div>
  );
}
