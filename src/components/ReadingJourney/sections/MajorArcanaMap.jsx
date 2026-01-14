/**
 * MajorArcanaMap - Heatmap grid of Major Arcana frequency.
 */

import { memo } from 'react';
import { Star } from '@phosphor-icons/react';

// Major Arcana names by number
const MAJOR_ARCANA_NAMES = [
  'The Fool',
  'The Magician',
  'The High Priestess',
  'The Empress',
  'The Emperor',
  'The Hierophant',
  'The Lovers',
  'The Chariot',
  'Strength',
  'The Hermit',
  'Wheel of Fortune',
  'Justice',
  'The Hanged Man',
  'Death',
  'Temperance',
  'The Devil',
  'The Tower',
  'The Star',
  'The Moon',
  'The Sun',
  'Judgement',
  'The World',
];

// Roman numeral representation
const ROMAN_NUMERALS = [
  '0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI',
];

function getHeatColor(count, maxCount) {
  if (count === 0) return 'bg-amber-200/5';
  const intensity = Math.min(count / maxCount, 1);
  if (intensity > 0.8) return 'bg-amber-400/80';
  if (intensity > 0.6) return 'bg-amber-400/60';
  if (intensity > 0.4) return 'bg-amber-400/40';
  if (intensity > 0.2) return 'bg-amber-400/25';
  return 'bg-amber-400/15';
}

function MajorArcanaMap({ data = [] }) {
  // Build a lookup map by name and number
  const countMap = new Map();
  let maxCount = 1;

  data.forEach((item) => {
    const count = item.count || 0;
    if (item.cardNumber !== null && item.cardNumber !== undefined) {
      countMap.set(item.cardNumber, count);
    }
    if (item.name) {
      const index = MAJOR_ARCANA_NAMES.findIndex(
        (n) => n.toLowerCase() === item.name.toLowerCase()
      );
      if (index >= 0) {
        countMap.set(index, count);
      }
    }
    if (count > maxCount) maxCount = count;
  });

  // Check if we have any data
  const hasData = Array.from(countMap.values()).some((c) => c > 0);
  if (!hasData) return null;

  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-amber-100/60 mb-3">
        <Star className="h-3 w-3" />
        Major Arcana Focus
      </p>

      {/* Grid layout - 11 columns for first row, 11 for second */}
      {/* Responsive: smaller tiles on narrow screens to avoid overflow */}
      <div className="space-y-1">
        {/* First row: 0-X (indices 0-10) */}
        <div className="flex gap-0.5 xs:gap-1 justify-start overflow-x-auto pb-1 scrollbar-none">
          {ROMAN_NUMERALS.slice(0, 11).map((numeral, index) => {
            const count = countMap.get(index) || 0;
            return (
              <div
                key={index}
                className={`
                  flex-shrink-0 w-6 h-6 xs:w-7 xs:h-7 rounded flex items-center justify-center
                  text-[9px] xs:text-[10px] font-medium transition-colors
                  ${getHeatColor(count, maxCount)}
                  ${count > 0 ? 'text-amber-100' : 'text-amber-100/30'}
                `}
                title={`${MAJOR_ARCANA_NAMES[index]}: ${count}x`}
                aria-label={`${MAJOR_ARCANA_NAMES[index]}: appeared ${count} times`}
              >
                {numeral}
              </div>
            );
          })}
        </div>

        {/* Second row: XI-XXI (indices 11-21) */}
        <div className="flex gap-0.5 xs:gap-1 justify-start overflow-x-auto pb-1 scrollbar-none">
          {ROMAN_NUMERALS.slice(11).map((numeral, i) => {
            const index = i + 11;
            const count = countMap.get(index) || 0;
            return (
              <div
                key={index}
                className={`
                  flex-shrink-0 w-6 h-6 xs:w-7 xs:h-7 rounded flex items-center justify-center
                  text-[9px] xs:text-[10px] font-medium transition-colors
                  ${getHeatColor(count, maxCount)}
                  ${count > 0 ? 'text-amber-100' : 'text-amber-100/30'}
                `}
                title={`${MAJOR_ARCANA_NAMES[index]}: ${count}x`}
                aria-label={`${MAJOR_ARCANA_NAMES[index]}: appeared ${count} times`}
              >
                {numeral}
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-2 text-[10px] text-amber-100/50">
        Heat intensity = frequency
      </p>
    </div>
  );
}

export default memo(MajorArcanaMap);
