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
