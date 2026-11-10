import { GlobalNav } from './GlobalNav';
import { useResponsiveSticky } from '../hooks/useResponsiveSticky';
import '../styles/navigation.css';

/** One quiet app bar for every included route. Quiet routes omit destinations. */
export function AppHeader({ destinations = true, installInMenu = false, onRequestExit, srHeading = false }) {
  const stickyRef = useResponsiveSticky(true, { rootVar: '--pinned-header-height', coordinated: true });
  return (
    <header ref={stickyRef} className="app-header header-sticky" data-app-header="true" data-destinations={destinations ? 'true' : 'false'}>
      {srHeading && <h1 id="tableau-heading" className="sr-only">Tableu</h1>}
      <div className="app-header__inner">
        <GlobalNav destinations={destinations} installInMenu={installInMenu} onRequestExit={onRequestExit} />
      </div>
    </header>
  );
}
