import { useCallback, useRef } from 'react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { InstallControl, shouldShowPwaInstall } from './InstallControl';

/** Place inside the page's content column, before its reserved bottom padding. */
export function InstallFooter() {
  const footerRef = useRef(null);
  const install = usePwaInstall();
  const getFallbackFocus = useCallback(() => {
    const footer = footerRef.current;
    const main = footer?.closest('main');
    if (!main) return null;
    // The last available action is adjacent to this page-end control. Resolve it
    // by document order: WebKit may still be applying scroll restored on close.
    const actions = [...main.querySelectorAll('button, a[href], input, select, textarea')]
      .filter(element => !footer.contains(element) && !element.matches(':disabled')
        && !element.closest('[hidden], [inert], [aria-hidden="true"]')
        && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden')
      .reverse();
    return actions[0] || main;
  }, []);

  // Retain the mounted control through prompt consumption for focus restoration.
  return (
    <footer ref={footerRef} data-pwa-footer hidden={!shouldShowPwaInstall(install)} className="pt-4 text-main">
      <div className="flex justify-center sm:justify-end">
        <InstallControl getFallbackFocus={getFallbackFocus} />
      </div>
    </footer>
  );
}
