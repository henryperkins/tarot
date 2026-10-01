import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const PAGE_NAMES = {
  '/': 'Tarot Reading',
  '/journal': 'Journal',
  '/journal/gallery': 'Card Gallery',
  '/pricing': 'Plans & Pricing',
  '/account': 'Account & Settings',
  '/admin': 'Quality Dashboard',
  '/design': 'Design System',
  '/governance-critique': 'Governance Critique',
  '/reset-password': 'Reset Password',
  '/verify-email': 'Verify Email',
  '/auth/callback': 'Signing In',
  '/__e2e/spread-layout': 'Spread Layout'
};

// This lives inside the route Suspense boundary so focus waits for the page to commit.
export function RouteAccessibility({ contentRef }) {
  const { pathname } = useLocation();
  const previousPath = useRef(pathname);
  const announcementRef = useRef(null);

  useEffect(() => {
    const path = pathname.replace(/\/+$/, '').toLowerCase() || '/';
    const name = path.startsWith('/share/') ? 'Shared Reading' : (PAGE_NAMES[path] || PAGE_NAMES['/']);
    document.title = `${name} — Tableu`;
    const navigated = previousPath.current !== pathname;
    previousPath.current = pathname;
    if (!navigated) return undefined;

    const frame = window.requestAnimationFrame(() => {
      if (announcementRef.current) announcementRef.current.textContent = `${name} page loaded.`;
      // Dialogs, including onboarding, own focus while they are open.
      const dialog = [...document.querySelectorAll('[aria-modal="true"]')]
        .find(element => element.getClientRects().length > 0);
      if (dialog) return;
      const target = contentRef.current?.querySelector('#main-content, main, [role="main"]') || contentRef.current;
      if (target) {
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, contentRef]);

  return <div ref={announcementRef} role="status" aria-live="polite" aria-atomic="true" className="sr-only" />;
}
