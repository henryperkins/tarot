import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkle } from './icons';
import { Icon, ICON_SIZES } from './Icon';
import { JournalBookIcon } from './JournalIcons';
import { useReducedMotion } from '../hooks/useReducedMotion';

/**
 * MobileBottomNav - Mobile-first bottom tab navigation for Reading/Journal
 * Follows iOS/Material bottom nav patterns for thumb reach
 * Only shows on mobile when on the Reading page
 */
export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  // Only show on the Reading page
  const isJournal = location.pathname.startsWith('/journal');
  const isReading = location.pathname === '/' || location.pathname === '';
  const shouldShow = isReading;

  if (!shouldShow) return null;

  const baseButtonClasses = `
    flex-1 flex flex-col items-center justify-center gap-1
    py-2 px-2 min-h-nav
    touch-manipulation
    transition-colors
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset
    active:scale-[0.98]
  `;

  const activeClasses = 'text-accent';
  const inactiveClasses = 'text-muted hover:text-main';

  return (
    <nav
      aria-label="Main navigation"
      className={`
        lg:hidden fixed bottom-0 left-0 right-0 z-30
        bg-surface/95 backdrop-blur-sm
        border-t border-secondary/20
        shadow-[0_-2px_10px_rgba(0,0,0,0.1)]
        pb-safe-action pl-safe pr-safe
        ${prefersReducedMotion ? '' : 'animate-fade-in'}
      `}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => navigate('/')}
          className={`${baseButtonClasses} ${isReading ? activeClasses : inactiveClasses}`}
          aria-current={isReading ? 'page' : undefined}
          aria-label="Reading"
        >
          <Icon icon={Sparkle} size={ICON_SIZES.lg} decorative />
          <span className="text-xs font-medium">Reading</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/journal')}
          className={`${baseButtonClasses} ${isJournal ? activeClasses : inactiveClasses}`}
          aria-current={isJournal ? 'page' : undefined}
          aria-label="Journal"
        >
          <Icon icon={JournalBookIcon} size={ICON_SIZES.lg} decorative />
          <span className="text-xs font-medium">Journal</span>
        </button>
      </div>
    </nav>
  );
}
