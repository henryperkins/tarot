import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { TableuLogo } from './TableuLogo';
import { DestinationNav } from './DestinationNav';
import { UserMenu } from './UserMenu';
import { useHandsetLayout } from '../hooks/useHandsetLayout';
import { useKeyboardOffset } from '../hooks/useKeyboardOffset';
import { syncDestinationPlacement } from '../lib/destinationPlacement';
import '../styles/navigation.css';

/** The shared app-bar row: brand, left-clustered destinations, account. */
export function GlobalNav({ destinations = true, withUserChip = true, installInMenu = false, onRequestExit }) {
  const isHandset = useHandsetLayout();
  const keyboardOffset = useKeyboardOffset({ setCssVar: false });
  const navRef = useRef(null);
  useLayoutEffect(() => {
    const page = navRef.current?.closest('[data-app-chrome]');
    if (page) syncDestinationPlacement(page, isHandset, keyboardOffset > 0);
  }, [isHandset, keyboardOffset, destinations]);

  return (
    <div ref={navRef} className="site-nav" data-handset={String(isHandset)}>
      <Link to="/" className="site-nav__brand" aria-label="Tableu home">
        <TableuLogo variant="icon" size={30} decorative />
        <span className="site-nav__wordmark" aria-hidden="true">Tableu</span>
      </Link>
      {destinations && (
        <div className="destination-group destination-group--header" data-destination-group="header" hidden inert>
          <DestinationNav placement="header" />
        </div>
      )}
      {withUserChip && (
        <div className="site-nav__account">
          <UserMenu condensed installInMenu={installInMenu} onRequestExit={onRequestExit} />
        </div>
      )}
    </div>
  );
}
