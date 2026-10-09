import { useEffect, useRef, lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { PageTransition } from './PageTransition.jsx';
import { RouteAccessibility } from './RouteAccessibility.jsx';

// Load only the route the visitor needs, including on direct settings visits.
const TarotReading = lazy(() => import('../TarotReading.jsx'));
const Journal = lazy(() => import('./Journal.jsx'));
const CardGalleryPage = lazy(() => import('../pages/CardGalleryPage.jsx'));
const ShareReading = lazy(() => import('../pages/ShareReading.jsx'));
const PricingPage = lazy(() => import('../pages/PricingPage.jsx'));
const AccountPage = lazy(() => import('../pages/AccountPage.jsx'));
const AdminDashboard = lazy(() => import('../pages/AdminDashboard.jsx'));
const DesignSystemPage = lazy(() => import('../pages/DesignSystemPage.jsx'));
const GovernanceCritiquePage = lazy(() => import('../pages/GovernanceCritiquePage.jsx'));
const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage.jsx'));
const VerifyEmailPage = lazy(() => import('../pages/VerifyEmailPage.jsx'));
const OAuthCallbackPage = lazy(() => import('../pages/OAuthCallbackPage.jsx'));
const SpreadLayoutFixture = import.meta.env.DEV
  ? lazy(() => import('./SpreadLayoutFixture.jsx'))
  : null;

const ReadingGesturesFixture = import.meta.env.DEV
  ? lazy(() => import('./ReadingGesturesFixture.jsx'))
  : null;

// Minimal loading fallback for route transitions
function RouteLoader() {
  return (
    <div role="status" className="flex items-center justify-center min-h-[50vh]">
      <div className="motion-safe:animate-pulse text-muted">Loading…</div>
    </div>
  );
}

const STATIC_NON_TAROT_PATHS = new Set([
  '/journal',
  '/journal/gallery',
  '/pricing',
  '/account',
  '/admin',
  '/design',
  '/governance-critique',
  '/reset-password',
  '/verify-email',
  '/auth/callback'
]);

function isTarotRoutePath(pathname) {
  if (!pathname || pathname === '/') return true;
  if (pathname.startsWith('/share/')) return false;
  return !STATIC_NON_TAROT_PATHS.has(pathname);
}

export function AnimatedRoutes() {
  const location = useLocation();
  const contentRef = useRef(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('tableau:route-change', {
      detail: {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
        isTarotRoute: isTarotRoutePath(location.pathname)
      }
    }));
  }, [location.pathname, location.search, location.hash]);

  return (
    <div ref={contentRef}>
      <Suspense fallback={<RouteLoader />}>
        <RouteAccessibility contentRef={contentRef} />
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageTransition><TarotReading /></PageTransition>} />
          <Route path="/journal/gallery" element={<PageTransition><CardGalleryPage /></PageTransition>} />
          <Route path="/journal" element={<PageTransition><Journal /></PageTransition>} />
          <Route path="/pricing" element={<PageTransition><PricingPage /></PageTransition>} />
          <Route path="/account" element={<PageTransition><AccountPage /></PageTransition>} />
          <Route path="/admin" element={<PageTransition><AdminDashboard /></PageTransition>} />
          <Route path="/design" element={<PageTransition><DesignSystemPage /></PageTransition>} />
          <Route path="/governance-critique" element={<PageTransition><GovernanceCritiquePage /></PageTransition>} />
          <Route path="/share/:token" element={<PageTransition><ShareReading /></PageTransition>} />
          <Route path="/reset-password" element={<PageTransition><ResetPasswordPage /></PageTransition>} />
          <Route path="/verify-email" element={<PageTransition><VerifyEmailPage /></PageTransition>} />
          <Route path="/auth/callback" element={<PageTransition><OAuthCallbackPage /></PageTransition>} />
          {ReadingGesturesFixture && (
            <Route path="/__e2e/reading-gestures" element={<ReadingGesturesFixture />} />
          )}
          {SpreadLayoutFixture && (
            <Route path="/__e2e/spread-layout" element={<SpreadLayoutFixture />} />
          )}
          <Route path="*" element={<PageTransition><TarotReading /></PageTransition>} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default AnimatedRoutes;
