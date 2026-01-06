import { memo } from 'react';

const OPTIONS = [
  { value: 7, label: '7d' },
  { value: 14, label: '14d' },
  { value: 30, label: '30d' }
];

/**
 * DaysFilter - Button group for selecting date range
 *
 * @param {Object} props
 * @param {number} props.value - Current selected value
 * @param {Function} props.onChange - Callback when value changes
 * @param {boolean} [props.disabled] - Disable all buttons
 */
export const DaysFilter = memo(function DaysFilter({
  value,
  onChange,
  disabled = false
}) {
  return (
    <div className="inline-flex rounded-lg border border-secondary/30 bg-surface overflow-hidden">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          disabled={disabled}
          className={`px-3 sm:px-4 py-2 min-h-[44px] min-w-[44px] text-xs font-medium transition-colors
            ${value === option.value
              ? 'bg-accent text-main'
              : 'text-muted hover:text-main hover:bg-secondary/20'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            border-r border-secondary/30 last:border-r-0
          `}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
});

export default DaysFilter;
