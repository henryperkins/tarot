import { useId, useState, useRef, useEffect } from 'react';
import { CaretDown } from '@phosphor-icons/react';

export function HelperToggle({
  children,
  label = 'More information',
  className = '',
  defaultOpen = false,
  buttonClassName = '',
  contentClassName = ''
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);
  // Use state instead of ref since we need to read it during render for state adjustment
  const [hasToggled, setHasToggled] = useState(false);

  // Track previous defaultOpen for render-time state adjustment
  const [prevDefaultOpen, setPrevDefaultOpen] = useState(defaultOpen);

  // Sync isOpen with defaultOpen changes if user hasn't manually toggled
  // This pattern (adjusting state during render) is React-recommended over useEffect
  if (defaultOpen !== prevDefaultOpen) {
    setPrevDefaultOpen(defaultOpen);
    if (defaultOpen && !hasToggled) {
      setIsOpen(true);
    }
  }

  // Measure content height for smooth animation
  // Schedule via RAF to avoid synchronous setState in effect
  useEffect(() => {
    if (contentRef.current) {
      requestAnimationFrame(() => {
        if (contentRef.current) {
          const height = contentRef.current.scrollHeight;
          setContentHeight(height);
        }
      });
    }
  }, [children, isOpen]);

  const handleToggle = () => {
    setHasToggled(true);
    setIsOpen(prev => !prev);
  };

  const buttonClass = `
    inline-flex items-center gap-1.5 px-3 py-1.5 min-h-touch text-xs text-muted/80 transition-all duration-200
    hover:text-secondary
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-main
    touch-manipulation
    ${buttonClassName}
  `;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleToggle}
        className={buttonClass}
        aria-expanded={isOpen}
        aria-controls={contentId}
        aria-label={isOpen ? `Hide ${label.toLowerCase()}` : label}
      >
        <span className="font-medium tracking-wide">{isOpen ? 'Less' : 'Learn more'}</span>
        <CaretDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
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
        <div className={`text-[clamp(0.85rem,2.4vw,0.95rem)] leading-snug text-muted bg-surface/70 border border-secondary/25 rounded-lg p-3 ${contentClassName}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
