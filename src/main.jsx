import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import './styles/tailwind.css';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { SubscriptionProvider } from './contexts/SubscriptionContext.jsx';
import { PreferencesProvider } from './contexts/PreferencesContext.jsx';
import { ReadingProvider } from './contexts/ReadingContext.jsx';
import { ToastProvider } from './contexts/ToastContext.jsx';
import { AnimatedRoutes } from './components/AnimatedRoutes.jsx';
import { SkipLink } from './components/SkipLink.jsx';

// Queue early errors that occur before Sentry loads
const earlyErrors = [];
const earlyErrorHandler = (event) => {
  earlyErrors.push({ type: 'error', args: [event.error || event.message] });
};
const earlyRejectionHandler = (event) => {
  earlyErrors.push({ type: 'unhandledrejection', args: [event.reason] });
};
if (typeof window !== 'undefined') {
  window.addEventListener('error', earlyErrorHandler);
  window.addEventListener('unhandledrejection', earlyRejectionHandler);
}

// Defer Sentry initialization to after first paint
// This prevents blocking the critical rendering path
function initSentry() {
  import('@sentry/react').then((Sentry) => {
    if (!Sentry?.init) return;
    Sentry.init({
      dsn: 'https://dc6b77e884387701e50a12632de8e0dc@o4508070823395328.ingest.us.sentry.io/4510814880661504',
      integrations: [
        Sentry.browserTracingIntegration(),
        // Only load replay on error to reduce initial overhead
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],
      // Capture 100% of traces for performance monitoring
      tracesSampleRate: 1.0,
      // Reduced session replay rate, full replay only on error
      replaysSessionSampleRate: 0.05,
      replaysOnErrorSampleRate: 1.0,
      // Propagate traces to backend API for linked replays
      tracePropagationTargets: [
        'localhost',
        /^https:\/\/tarot\.lakefrontdev\.com\/api/,
        /^\/api\//,
      ],
      _experiments: {
        enableLogs: true,
      },
    });

    // Remove early handlers and replay queued errors
    window.removeEventListener('error', earlyErrorHandler);
    window.removeEventListener('unhandledrejection', earlyRejectionHandler);
    for (const entry of earlyErrors) {
      if (entry.args[0]) {
        Sentry.captureException(entry.args[0]);
      }
    }
    earlyErrors.length = 0;
  }).catch(() => {
    // Sentry failed to load — non-critical, app continues without error tracking
    window.removeEventListener('error', earlyErrorHandler);
    window.removeEventListener('unhandledrejection', earlyRejectionHandler);
    earlyErrors.length = 0;
  });
}

// Initialize Sentry after first paint using requestIdleCallback
if (typeof window !== 'undefined') {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(initSentry, { timeout: 2000 });
  } else {
    setTimeout(initSentry, 100);
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <SubscriptionProvider>
          <PreferencesProvider>
            <ReadingProvider>
              <ToastProvider>
                <BrowserRouter>
                  <SkipLink />
                  <AnimatedRoutes />
                </BrowserRouter>
              </ToastProvider>
            </ReadingProvider>
          </PreferencesProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </MotionConfig>
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch(error => {
        console.error('Service worker registration failed:', error);
      });
  });
}
