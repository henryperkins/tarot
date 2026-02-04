/**
 * MajorArcanaMap - Heatmap grid of Major Arcana frequency.
 */

import { memo } from 'react';
import { Star } from '@phosphor-icons/react';
import { MAJOR_ARCANA_NAMES } from '../../../data/majorArcana.js';

// Roman numeral representation
const ROMAN_NUMERALS = [
  '0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI',
];

function getHeatColor(count, maxCount) {
  if (count === 0) return 'var(--border-warm-subtle)';
  const intensity = Math.min(count / maxCount, 1);
  if (intensity > 0.8) return 'rgb(var(--brand-primary-rgb) / 0.8)';
  if (intensity > 0.6) return 'rgb(var(--brand-primary-rgb) / 0.6)';
  if (intensity > 0.4) return 'rgb(var(--brand-primary-rgb) / 0.4)';
  if (intensity > 0.2) return 'rgb(var(--brand-primary-rgb) / 0.25)';
  return 'rgb(var(--brand-primary-rgb) / 0.15)';
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
      <p className="flex items-center gap-1.5 text-xs text-muted mb-3">
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
                  text-2xs xs:text-2xs font-medium transition-colors
                  ${count > 0 ? 'text-main' : 'text-muted/50'}
                `}
                style={{ backgroundColor: getHeatColor(count, maxCount) }}
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
                  text-2xs xs:text-2xs font-medium transition-colors
                  ${count > 0 ? 'text-main' : 'text-muted/50'}
                `}
                style={{ backgroundColor: getHeatColor(count, maxCount) }}
                title={`${MAJOR_ARCANA_NAMES[index]}: ${count}x`}
                aria-label={`${MAJOR_ARCANA_NAMES[index]}: appeared ${count} times`}
              >
                {numeral}
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-2 text-2xs text-muted/70">
        Heat intensity = frequency
      </p>
    </div>
  );
}

export default memo(MajorArcanaMap);
