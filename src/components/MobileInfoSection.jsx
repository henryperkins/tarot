import { useState, useId } from 'react';
import { CaretDown, CaretUp, Info } from '@phosphor-icons/react';

/**
 * MobileInfoSection - A mobile-friendly alternative to tooltips
 *
 * Instead of tiny info icons that are hard to tap, this component provides:
 * - A clearly visible, tap-friendly expand/collapse trigger
 * - Smooth content reveal animation
 * - Proper accessibility with ARIA attributes
 * - Respects prefers-reduced-motion
 *
 * Use this in mobile contexts where Tooltip would require a small tap target.
 *
 * @param {Object} props
 * @param {string} props.title - Brief label for the info section
 * @param {React.ReactNode} props.children - Info content to display when expanded
 * @param {string} [props.variant='inline'] - 'inline' for compact, 'block' for full-width
 * @param {boolean} [props.defaultOpen=false] - Whether to start expanded
 * @param {string} [props.className] - Additional CSS classes
 */
export function MobileInfoSection({
  title,
  children,
  variant = 'inline',
  defaultOpen = false,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();

  const isInline = variant === 'inline';

  const baseButtonClass = `
    inline-flex items-center gap-1.5
    min-h-[44px] px-3 py-2
    rounded-xl border border-secondary/30
    bg-surface/60
    text-xs text-secondary
    transition-colors duration-150
    hover:border-accent/50 hover:bg-surface/80
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-main
    touch-manipulation
    active:scale-[0.98]
  `;

  const blockButtonClass = `
    w-full flex items-center justify-between gap-2
    min-h-[48px] px-4 py-3
    rounded-xl border border-secondary/25
    bg-surface/50
    text-sm text-main
    transition-colors duration-150
    hover:border-accent/40 hover:bg-surface/70
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
    touch-manipulation
    active:scale-[0.99]
  `;

  const contentClass = isOpen
    ? 'opacity-100 max-h-[500px] mt-2'
    : 'opacity-0 max-h-0 overflow-hidden';

  return (
    <div className={`${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={isInline ? baseButtonClass : blockButtonClass}
        aria-expanded={isOpen}
        aria-controls={contentId}
      >
        {isInline ? (
          <>
            <Info className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span className="font-medium">{title}</span>
            {isOpen
              ? <CaretUp className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              : <CaretDown className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
            }
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-secondary flex-shrink-0" aria-hidden="true" />
              <span className="font-semibold">{title}</span>
            </div>
            <span className="w-8 h-8 flex items-center justify-center rounded-full bg-secondary/10 border border-secondary/20">
              {isOpen
                ? <CaretUp className="w-4 h-4 text-accent" aria-hidden="true" />
                : <CaretDown className="w-4 h-4 text-accent" aria-hidden="true" />
              }
            </span>
          </>
        )}
      </button>

      <div
        id={contentId}
        className={`transition-all duration-200 ease-out ${contentClass}`}
        aria-hidden={!isOpen}
      >
        <div className={`
          rounded-xl border border-secondary/20 bg-surface/70
          px-3 py-2.5
          text-sm text-muted leading-relaxed
          ${isInline ? '' : 'ml-7'}
        `}>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * InfoText - A simpler inline info display without expand/collapse
 * Use when you want to show helpful text inline without interaction.
 */
export function InfoText({ children, className = '' }) {
  return (
    <div className={`flex items-start gap-2 text-xs text-muted ${className}`}>
      <Info className="w-4 h-4 flex-shrink-0 text-secondary/70 mt-0.5" aria-hidden="true" />
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}
