import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/tailwind.css';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { SubscriptionProvider } from './contexts/SubscriptionContext.jsx';
import { PreferencesProvider } from './contexts/PreferencesContext.jsx';
import { ReadingProvider } from './contexts/ReadingContext.jsx';
import { ToastProvider } from './contexts/ToastContext.jsx';
import { AnimatedRoutes } from './components/AnimatedRoutes.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <SubscriptionProvider>
        <PreferencesProvider>
          <ReadingProvider>
            <ToastProvider>
              <BrowserRouter>
                <AnimatedRoutes />
              </BrowserRouter>
            </ToastProvider>
          </ReadingProvider>
        </PreferencesProvider>
      </SubscriptionProvider>
    </AuthProvider>
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
