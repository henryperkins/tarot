import { useId, useState } from 'react';
import { Question } from '@phosphor-icons/react';

export function HelperToggle({ children, label = 'More information', className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] w-11 h-11 rounded-full border border-secondary/40 bg-transparent text-secondary/80 transition hover:border-accent/60 hover:text-main hover:bg-secondary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-main touch-manipulation"
        aria-expanded={isOpen}
        aria-controls={contentId}
        aria-label={label}
        title={label}
      >
        <Question className="w-4 h-4" aria-hidden="true" />
      </button>
      <div
        id={contentId}
        className={`mt-2 text-[clamp(0.85rem,2.4vw,0.95rem)] leading-snug text-muted bg-surface/70 border border-secondary/25 rounded-lg p-3 ${isOpen ? 'block animate-fade-in' : 'hidden'}`}
      >
        {children}
      </div>
    </div>
  );
}
