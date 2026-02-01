import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { animate, set } from 'animejs';
import TarotReading from '../TarotReading.jsx';
import Journal from './Journal.jsx';
import CardGalleryPage from '../pages/CardGalleryPage.jsx';
import ShareReading from '../pages/ShareReading.jsx';
import PricingPage from '../pages/PricingPage.jsx';
import AccountPage from '../pages/AccountPage.jsx';
import AdminDashboard from '../pages/AdminDashboard.jsx';
import ResetPasswordPage from '../pages/ResetPasswordPage.jsx';
import VerifyEmailPage from '../pages/VerifyEmailPage.jsx';
import OAuthCallbackPage from '../pages/OAuthCallbackPage.jsx';
import { PageTransition } from './PageTransition.jsx';
import { useReducedMotion } from '../hooks/useReducedMotion';

export function AnimatedRoutes() {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const containerRef = useRef(null);
  const nextLocationRef = useRef(location);

  const startExit = useCallback(() => {
    if (prefersReducedMotion) {
      setDisplayLocation(nextLocationRef.current);
      return;
    }

    const node = containerRef.current;
    if (!node) {
      setDisplayLocation(nextLocationRef.current);
      return;
    }

    setIsTransitioning(true);
    const exitAnim = animate(node, {
      opacity: [1, 0],
      duration: 220,
      ease: 'inOutQuad'
    });

    exitAnim
      .then(() => setDisplayLocation(nextLocationRef.current))
      .catch(() => setDisplayLocation(nextLocationRef.current));
  }, [prefersReducedMotion]);

  // Synchronize location changes - useLayoutEffect for synchronous DOM updates
  useLayoutEffect(() => {
    const isSamePath = location.pathname === displayLocation.pathname;
    const isSameSearch = location.search === displayLocation.search;
    const isSameHash = location.hash === displayLocation.hash;
    const isSameKey = location.key === displayLocation.key;

    if (isSamePath && isSameSearch && isSameHash && isSameKey) return;
    nextLocationRef.current = location;

    if (isSamePath) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync location update for animation coordination
      setDisplayLocation(location);
      return;
    }

    if (prefersReducedMotion) {
      setDisplayLocation(location);
      return;
    }

    if (!isTransitioning) {
      startExit();
    }
  }, [
    location,
    displayLocation.pathname,
    displayLocation.search,
    displayLocation.hash,
    displayLocation.key,
    prefersReducedMotion,
    isTransitioning,
    startExit
  ]);

  // Handle enter animation after display location changes
  useLayoutEffect(() => {
    if (!isTransitioning || prefersReducedMotion) {
      if (isTransitioning && prefersReducedMotion) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sync state reset when animations disabled
        setIsTransitioning(false);
      }
      return;
    }

    const node = containerRef.current;
    if (!node) {
      setIsTransitioning(false);
      return;
    }

    set(node, { opacity: 0 });
    const enterAnim = animate(node, {
      opacity: [0, 1],
      duration: 220,
      ease: 'inOutQuad'
    });

    enterAnim
      .then(() => {
        setIsTransitioning(false);
        if (nextLocationRef.current.pathname !== displayLocation.pathname) {
          startExit();
        }
      })
      .catch(() => setIsTransitioning(false));
  }, [displayLocation.pathname, isTransitioning, prefersReducedMotion, startExit]);

  return (
    <div ref={containerRef}>
      <Routes location={displayLocation} key={displayLocation.pathname}>
        <Route path="/" element={<PageTransition><TarotReading /></PageTransition>} />
        <Route path="/journal/gallery" element={<PageTransition><CardGalleryPage /></PageTransition>} />
        <Route path="/journal" element={<PageTransition><Journal /></PageTransition>} />
        <Route path="/pricing" element={<PageTransition><PricingPage /></PageTransition>} />
        <Route path="/account" element={<PageTransition><AccountPage /></PageTransition>} />
        <Route path="/admin" element={<PageTransition><AdminDashboard /></PageTransition>} />
        <Route path="/share/:token" element={<PageTransition><ShareReading /></PageTransition>} />
        <Route path="/reset-password" element={<PageTransition><ResetPasswordPage /></PageTransition>} />
        <Route path="/verify-email" element={<PageTransition><VerifyEmailPage /></PageTransition>} />
        <Route path="/auth/callback" element={<PageTransition><OAuthCallbackPage /></PageTransition>} />
        <Route path="*" element={<PageTransition><TarotReading /></PageTransition>} />
      </Routes>
    </div>
  );
}

export default AnimatedRoutes;
