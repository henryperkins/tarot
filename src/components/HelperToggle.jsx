import { useId, useState, useRef, useEffect } from 'react';
import { Question } from '@phosphor-icons/react';

export function HelperToggle({ children, label = 'More information', className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);

  // Measure content height for smooth animation
  useEffect(() => {
    if (contentRef.current) {
      // Get the scroll height when open for animation
      const height = contentRef.current.scrollHeight;
      setContentHeight(height);
    }
  }, [children, isOpen]);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] w-11 h-11 rounded-full border border-secondary/40 bg-transparent text-secondary/80 transition-all duration-200
          hover:border-accent/60 hover:text-main hover:bg-secondary/5
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-main
          active:scale-95 touch-manipulation"
        aria-expanded={isOpen}
        aria-controls={contentId}
        aria-label={isOpen ? `Hide ${label.toLowerCase()}` : label}
        title={label}
      >
        <Question
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {/* Animated content container */}
      <div
        id={contentId}
        ref={contentRef}
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{
          maxHeight: isOpen ? `${contentHeight + 24}px` : '0px', // +24 for padding
          opacity: isOpen ? 1 : 0,
          marginTop: isOpen ? '0.5rem' : '0',
        }}
        aria-hidden={!isOpen}
      >
        <div className="text-[clamp(0.85rem,2.4vw,0.95rem)] leading-snug text-muted bg-surface/70 border border-secondary/25 rounded-lg p-3">
          {children}
        </div>
      </div>
    </div>
  );
}
