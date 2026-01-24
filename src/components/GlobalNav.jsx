import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkle } from './icons';
import { Icon, ICON_SIZES } from './Icon';
import { UserMenu } from './UserMenu';
import { JournalBookIcon } from './JournalIcons';

export function GlobalNav({ condensed = false, withUserChip = false }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Precise route detection: only mark active when on actual route
  const isJournal = location.pathname.startsWith('/journal');
  const isReading = location.pathname === '/' || location.pathname === '';
  // Don't mark either as active on other pages (pricing, account, share, etc.)
  const showActiveState = isReading || isJournal;

  const baseButtonClasses = `
    inline-flex items-center justify-center gap-1.5
    rounded-full font-semibold
    transition-all touch-manipulation
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80
    focus-visible:ring-offset-2 focus-visible:ring-offset-main
    active:scale-[0.97]
    min-h-touch
  `;

  const buttonPadding = condensed
    ? 'px-3 sm:px-3.5 py-2 text-xs-plus'
    : 'px-3.5 sm:px-5 py-2.5 text-sm';
  // Mobile layout uses a grid (2 cols, or 3 cols when user chip is present) to prevent the
  // user menu from crowding/overlapping the Reading/Journal buttons.
  const buttonWidth = condensed
    ? 'w-full min-w-0 sm:w-auto sm:flex-1 sm:min-w-[9rem] sm:basis-auto'
    : 'w-full min-w-0 sm:w-auto sm:flex-1 sm:min-w-[10rem] sm:basis-auto';

  const activeClasses = 'bg-primary text-surface shadow shadow-primary/30 active:bg-primary/90';
  const inactiveClasses = `
    bg-surface text-main/85 border border-secondary/50
    hover:bg-surface-muted hover:text-main hover:border-secondary/60
    active:bg-surface-muted
  `;

  return (
    <nav
      aria-label="Primary navigation"
      className={`flex ${condensed ? 'justify-start mb-1.5' : 'justify-center mb-3'} animate-fade-in w-full`}
    >
      <div className={`w-full max-w-full ${withUserChip ? 'flex items-center gap-2' : ''} sm:block`}>
        <div
          className={`
            grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center w-full max-w-full
            ${withUserChip ? 'flex-1' : ''}
            sm:inline-flex sm:flex-nowrap
            ${condensed ? 'gap-1 sm:gap-1.5 px-1.5 py-1 shadow-inner shadow-main/20' : 'gap-1.5 sm:gap-2 px-1.5 py-1'}
            rounded-full sm:bg-surface/80 bg-surface/60 border border-transparent sm:border-accent/20
          `}
        >
          <button
            type="button"
            onClick={() => navigate('/')}
            className={`${baseButtonClasses} ${buttonPadding} ${buttonWidth} ${showActiveState && isReading ? activeClasses : inactiveClasses}`}
            aria-current={showActiveState && isReading ? 'page' : undefined}
          >
            <Icon icon={Sparkle} size={condensed ? ICON_SIZES.md : ICON_SIZES.lg} decorative />
            <span>Reading</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/journal')}
            className={`${baseButtonClasses} ${buttonPadding} ${buttonWidth} ${showActiveState && isJournal ? activeClasses : inactiveClasses}`}
            aria-current={showActiveState && isJournal ? 'page' : undefined}
          >
            <Icon icon={JournalBookIcon} size={condensed ? ICON_SIZES.md : ICON_SIZES.lg} decorative />
            <span>Journal</span>
          </button>
        </div>

        {withUserChip && (
          <div className="shrink-0 sm:hidden">
            <UserMenu condensed />
          </div>
        )}
      </div>
    </nav>
  );
}
