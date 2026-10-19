import { Link, NavLink } from 'react-router-dom';
import { Sparkle } from './icons';
import { JournalBookIcon } from './JournalIcons';
import { TableuLogo } from './TableuLogo';
import { UserMenu } from './UserMenu';
import '../styles/navigation.css';

/** Shared chrome for reading, journal, account, and the supporting routes. */
export function GlobalNav({ condensed = false, withUserChip = false, installInMenu = false, onRequestExit }) {
  return (
    <div className={['site-nav', condensed && 'site-nav--condensed'].filter(Boolean).join(' ')}>
      <Link to="/" className="site-nav__brand" aria-label="Tableu home">
        <TableuLogo variant="icon" size={32} decorative />
        <span className="site-nav__wordmark" aria-hidden="true">Tableu</span>
      </Link>

      <nav className="site-nav__destinations" aria-label="Primary navigation">
        <NavLink to="/" end className="site-nav__link">
          <Sparkle className="site-nav__icon" aria-hidden="true" />
          <span>Reading</span>
        </NavLink>
        <NavLink to="/journal" className="site-nav__link">
          <JournalBookIcon className="site-nav__icon" aria-hidden="true" />
          <span>Journal</span>
        </NavLink>
      </nav>

      {withUserChip && (
        <div className="site-nav__account">
          <UserMenu condensed compactGuest installInMenu={installInMenu} onRequestExit={onRequestExit} />
        </div>
      )}
    </div>
  );
}
