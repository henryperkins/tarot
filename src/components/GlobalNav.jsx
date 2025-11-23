import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkle, BookOpen } from './icons';
import { Icon, ICON_SIZES } from './Icon';

export function GlobalNav({ condensed = false }) {
  const location = useLocation();
  const navigate = useNavigate();

  const isJournal = location.pathname.startsWith('/journal');
  const isReading = !isJournal;

  const baseButtonClasses =
    'inline-flex items-center gap-1.5 rounded-full font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-main';
  const buttonPadding = condensed ? 'px-2.5 py-1.5 text-xs-plus' : 'px-3.5 py-2 text-sm';
  const activeClasses = 'bg-primary text-white shadow shadow-primary/30';
  const inactiveClasses =
    'bg-surface text-main/85 border border-secondary/50 hover:bg-surface-muted hover:text-main';

  return (
    <nav aria-label="Primary" className={`flex ${condensed ? 'justify-start mb-1.5' : 'justify-center mb-3'} animate-fade-in`}>
      <div className={`inline-flex items-center ${condensed ? 'gap-1.5 px-2 py-0.5 shadow-inner shadow-main/20' : 'gap-2 px-2 py-1'} rounded-full bg-surface/80 border border-accent/20`}>
        <button
          type="button"
          onClick={() => navigate('/')}
          className={`${baseButtonClasses} ${buttonPadding} ${isReading ? activeClasses : inactiveClasses}`}
          aria-current={isReading ? 'page' : undefined}
        >
          <Icon icon={Sparkle} size={ICON_SIZES.md} decorative />
          <span>Reading</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/journal')}
          className={`${baseButtonClasses} ${buttonPadding} ${isJournal ? activeClasses : inactiveClasses}`}
          aria-current={isJournal ? 'page' : undefined}
        >
          <Icon icon={BookOpen} size={ICON_SIZES.md} decorative />
          <span>Journal</span>
        </button>
      </div>
    </nav>
  );
}
