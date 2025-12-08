import { useState, useMemo, memo } from 'react';
import { CaretDown, CaretUp, Scroll } from '@phosphor-icons/react';
import { buildHeuristicJourneySummary } from '../../shared/journal/summary.js';
import { useReducedMotion } from '../hooks/useReducedMotion';

/**
 * JourneyStoryPanel - Collapsible prose summary of the user's tarot journey
 *
 * @param {Object} props
 * @param {Array} props.entries - Journal entries to summarize
 * @param {Object} props.stats - Pre-computed stats (optional, computed if not provided)
 * @param {boolean} [props.defaultExpanded=false] - Start expanded
 * @param {boolean} [props.isLandscape=false] - Compact mode for landscape
 */
export const JourneyStoryPanel = memo(function JourneyStoryPanel({
  entries = [],
  stats = null,
  defaultExpanded = false,
  isLandscape = false
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const prefersReducedMotion = useReducedMotion();

  const summary = useMemo(() => {
    if (!entries || entries.length === 0) {
      return null;
    }
    return buildHeuristicJourneySummary(entries, stats);
  }, [entries, stats]);

  if (!summary) {
    return null;
  }

  // Split summary into lines for display
  const summaryLines = summary.split('\n').filter(line => line.trim());
  const previewLines = summaryLines.slice(0, 2);
  const hasMore = summaryLines.length > 2;

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-amber-300/12 bg-gradient-to-br from-[#0f0b16]/80 via-[#0c0a13]/80 to-[#0a0810]/85 ring-1 ring-amber-300/10 shadow-[0_18px_45px_-30px_rgba(0,0,0,0.8)] ${isLandscape ? 'p-3' : 'p-5'}`}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50 rounded-lg -m-1 p-1"
        aria-expanded={isExpanded}
        aria-controls="journey-story-content"
      >
        <h3 className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-200/75 ${isLandscape ? 'mb-0' : ''}`}>
          <Scroll className="h-3 w-3" aria-hidden="true" />
          Story of This Season
        </h3>
        <span className="text-amber-200/60">
          {isExpanded ? (
            <CaretUp className="h-4 w-4" />
          ) : (
            <CaretDown className="h-4 w-4" />
          )}
        </span>
      </button>

      <div
        id="journey-story-content"
        className={`overflow-hidden ${prefersReducedMotion ? '' : 'transition-all duration-300 ease-in-out'}`}
        style={{
          maxHeight: isExpanded ? '500px' : hasMore ? '4.5rem' : '10rem',
          opacity: 1
        }}
      >
        <div className={`${isLandscape ? 'mt-2 text-xs' : 'mt-4 text-sm'} text-amber-100/80 leading-relaxed space-y-2`}>
          {(isExpanded ? summaryLines : previewLines).map((line, idx) => {
            // Style bullet points differently
            if (line.startsWith('•')) {
              return (
                <p key={idx} className="pl-4 text-amber-100/70 text-xs">
                  {line}
                </p>
              );
            }
            return <p key={idx}>{line}</p>;
          })}

          {!isExpanded && hasMore && (
            <p className="text-amber-200/50 text-xs italic">
              Tap to read more...
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

export default JourneyStoryPanel;
