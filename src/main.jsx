import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
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

// Initialize Sentry for frontend error tracking
Sentry.init({
  dsn: 'https://dc6b77e884387701e50a12632de8e0dc@o4508070823395328.ingest.us.sentry.io/4510814880661504',
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      // Mask all text and block all media for privacy
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  // Capture 100% of traces for performance monitoring
  tracesSampleRate: 1.0,
  // Capture 10% of sessions for replay, 100% on error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  // Propagate traces to backend API for linked replays
  tracePropagationTargets: [
    'localhost',
    /^https:\/\/tarot\.lakefrontdev\.com\/api/,
    /^\/api\//,
  ],
  // Enable logs
  _experiments: {
    enableLogs: true,
  },
});

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
