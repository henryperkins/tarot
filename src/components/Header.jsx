import { AppHeader } from './AppHeader';

/** Reading uses the same frame as every app route; progress belongs to its canvas. */
export function Header({ installInMenu = false, onRequestExit }) {
  return <AppHeader srHeading installInMenu={installInMenu} onRequestExit={onRequestExit} />;
}
