import { NavLink } from 'react-router-dom';
import { Sparkle } from './icons';
import { JournalBookIcon } from './JournalIcons';

/** The single Reading/Journal route model, presented in header or dock placement. */
export function DestinationNav({ placement = 'header' }) {
  return (
    <nav className={`destination-nav destination-nav--${placement}`} aria-label="Primary navigation" data-destination-nav={placement}>
      <NavLink to="/" end className="site-nav__link" data-destination-link="/">
        <Sparkle className="site-nav__icon" aria-hidden="true" />
        <span>Reading</span>
      </NavLink>
      <NavLink to="/journal" className="site-nav__link" data-destination-link="/journal">
        <JournalBookIcon className="site-nav__icon" aria-hidden="true" />
        <span>Journal</span>
      </NavLink>
    </nav>
  );
}
