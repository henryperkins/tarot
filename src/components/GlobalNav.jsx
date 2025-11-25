import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkle, BookOpen } from './icons';
import { Icon, ICON_SIZES } from './Icon';

export function GlobalNav({ condensed = false }) {
  const location = useLocation();
  const navigate = useNavigate();

  const isJournal = location.pathname.startsWith('/journal');
  const isReading = !isJournal;

  const baseButtonClasses = `
    inline-flex items-center justify-center gap-1.5
    rounded-full font-semibold
    transition-all touch-manipulation
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80
    focus-visible:ring-offset-2 focus-visible:ring-offset-main
    active:scale-[0.97]
    min-h-[44px]
  `;

  const buttonPadding = condensed
    ? 'px-3 sm:px-3.5 py-2 text-xs-plus'
    : 'px-4 sm:px-5 py-2.5 text-sm';

  const activeClasses = 'bg-primary text-surface shadow shadow-primary/30 active:bg-primary/90';
  const inactiveClasses = `
    bg-surface text-main/85 border border-secondary/50
    hover:bg-surface-muted hover:text-main hover:border-secondary/60
    active:bg-surface-muted
  `;

  return (
    <nav
      aria-label="Primary navigation"
      className={`flex ${condensed ? 'justify-start mb-1.5' : 'justify-center mb-3'} animate-fade-in`}
    >
      <div
        className={`
          inline-flex items-center
          ${condensed ? 'gap-1 sm:gap-1.5 px-1.5 py-1 shadow-inner shadow-main/20' : 'gap-1.5 sm:gap-2 px-1.5 py-1'}
          rounded-full bg-surface/80 border border-accent/20
        `}
      >
        <button
          type="button"
          onClick={() => navigate('/')}
          className={`${baseButtonClasses} ${buttonPadding} ${isReading ? activeClasses : inactiveClasses}`}
          aria-current={isReading ? 'page' : undefined}
        >
          <Icon icon={Sparkle} size={condensed ? ICON_SIZES.md : ICON_SIZES.lg} decorative />
          <span>Reading</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/journal')}
          className={`${baseButtonClasses} ${buttonPadding} ${isJournal ? activeClasses : inactiveClasses}`}
          aria-current={isJournal ? 'page' : undefined}
        >
          <Icon icon={BookOpen} size={condensed ? ICON_SIZES.md : ICON_SIZES.lg} decorative />
          <span>Journal</span>
        </button>
      </div>
    </nav>
  );
}
