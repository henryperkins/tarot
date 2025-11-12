import React, { useState } from 'react';
import { Info } from 'lucide-react';

/**
 * Accessible tooltip component with keyboard navigation support.
 *
 * @param {Object} props
 * @param {string} props.content - Tooltip text content
 * @param {React.ReactNode} [props.children] - Optional custom trigger element
 * @param {string} [props.position='top'] - Tooltip position: 'top' | 'bottom' | 'left' | 'right'
 * @param {string} [props.size='sm'] - Icon size: 'sm' | 'md' | 'lg'
 */
export function Tooltip({
  content,
  children,
  position = 'top',
  size = 'sm'
}) {
  const [isVisible, setIsVisible] = useState(false);

  const sizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-slate-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-slate-800',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-slate-800',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-slate-800'
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        aria-label="More information"
        className="inline-flex items-center justify-center text-amber-400/60 hover:text-amber-400 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50 rounded-full"
      >
        {children || <Info className={sizeClasses[size]} />}
      </button>

      {/* Tooltip Content */}
      {isVisible && (
        <div
          role="tooltip"
          className={`absolute z-50 ${positionClasses[position]} pointer-events-none`}
        >
          <div className="relative bg-slate-800 text-amber-50 text-xs rounded-lg px-3 py-2 shadow-xl border border-amber-500/20 max-w-xs whitespace-normal">
            {content}
            {/* Arrow */}
            <div
              className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`}
              aria-hidden="true"
            />
          </div>
        </div>
      )}
    </div>
  );
}
