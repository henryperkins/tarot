import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function HelperToggle({ children, label = 'Understand this', className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="inline-flex items-center gap-2 text-secondary text-sm font-medium underline underline-offset-4 decoration-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-main"
        aria-expanded={isOpen}
        aria-controls={contentId}
      >
        <span>{label}</span>
        <ChevronDown
          aria-hidden="true"
          className={`w-4 h-4 text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
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
