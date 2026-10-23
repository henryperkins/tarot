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
  // Keep the strongest fill below the text contrast ceiling in both themes.
  if (intensity > 0.8) return 'rgb(var(--brand-primary-rgb) / 0.3)';
  if (intensity > 0.6) return 'rgb(var(--brand-primary-rgb) / 0.24)';
  if (intensity > 0.4) return 'rgb(var(--brand-primary-rgb) / 0.18)';
  if (intensity > 0.2) return 'rgb(var(--brand-primary-rgb) / 0.12)';
  return 'rgb(var(--brand-primary-rgb) / 0.06)';
}

function handleRowKeyDown(event) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  const row = event.currentTarget;
  const delta = event.key === 'ArrowRight' ? 64 : -64;
  row.scrollLeft = Math.max(0, Math.min(row.scrollWidth - row.clientWidth, row.scrollLeft + delta));
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
        <Star className="h-3 w-3" aria-hidden="true" />
        Major Arcana Focus
      </p>

      {/* Grid layout - 11 columns for first row, 11 for second */}
      {/* Responsive: smaller tiles on narrow screens to avoid overflow */}
      <div className="space-y-1">
        {/* First row: 0-X (indices 0-10) */}
        <div
          role="group"
          aria-label="Major Arcana 0 to 10"
          tabIndex={0}
          onKeyDown={handleRowKeyDown}
          className="flex gap-0.5 xs:gap-1 justify-start overflow-x-auto pb-1 scrollbar-none rounded focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring-color)"
        >
          {ROMAN_NUMERALS.slice(0, 11).map((numeral, index) => {
            const count = countMap.get(index) || 0;
            return (
              <div
                key={index}
                role="img"
                className={`
                  shrink-0 w-6 h-6 xs:w-7 xs:h-7 rounded flex items-center justify-center
                  text-2xs xs:text-2xs font-medium transition-colors
                  ${count > 0 ? 'text-main' : 'text-muted'}
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
        <div
          role="group"
          aria-label="Major Arcana 11 to 21"
          tabIndex={0}
          onKeyDown={handleRowKeyDown}
          className="flex gap-0.5 xs:gap-1 justify-start overflow-x-auto pb-1 scrollbar-none rounded focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring-color)"
        >
          {ROMAN_NUMERALS.slice(11).map((numeral, i) => {
            const index = i + 11;
            const count = countMap.get(index) || 0;
            return (
              <div
                key={index}
                role="img"
                className={`
                  shrink-0 w-6 h-6 xs:w-7 xs:h-7 rounded flex items-center justify-center
                  text-2xs xs:text-2xs font-medium transition-colors
                  ${count > 0 ? 'text-main' : 'text-muted'}
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

      <p className="mt-2 text-2xs text-muted">
        Stronger color means more appearances in this scope.
      </p>
      <details className="mt-1">
        <summary className="min-h-touch cursor-pointer rounded-lg px-2 py-3 text-xs font-medium text-accent hover:text-main focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring-color)">
          Card names and counts
        </summary>
        <table className="w-full text-xs text-muted-high">
          <caption className="sr-only">Major Arcana appearances in this scope</caption>
          <thead>
            <tr className="border-b border-(--border-warm-subtle)">
              <th scope="col" className="py-2 text-left font-medium">Card</th>
              <th scope="col" className="py-2 text-right font-medium">Count</th>
            </tr>
          </thead>
          <tbody>
            {MAJOR_ARCANA_NAMES.map((name, index) => (
              <tr key={name} className="border-b border-(--border-warm-subtle)">
                <th scope="row" className="py-2 pr-3 text-left font-normal">
                  <span className="text-muted">{ROMAN_NUMERALS[index]} · </span>{name}
                </th>
                <td className="py-2 text-right tabular-nums">{countMap.get(index) || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export default memo(MajorArcanaMap);
