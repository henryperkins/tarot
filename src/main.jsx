import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import './styles/tailwind.css';
import TarotReading from './TarotReading.jsx';
import Journal from './components/Journal.jsx';
import CardGalleryPage from './pages/CardGalleryPage.jsx';
import ShareReading from './pages/ShareReading.jsx';
import PricingPage from './pages/PricingPage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { SubscriptionProvider } from './contexts/SubscriptionContext.jsx';
import { PreferencesProvider } from './contexts/PreferencesContext.jsx';
import { ReadingProvider } from './contexts/ReadingContext.jsx';
import { ToastProvider } from './contexts/ToastContext.jsx';

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<TarotReading />} />
        <Route path="/journal/gallery" element={<CardGalleryPage />} />
        <Route path="/journal" element={<Journal />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/share/:token" element={<ShareReading />} />
        <Route path="*" element={<TarotReading />} />
      </Routes>
    </AnimatePresence>
  );
}

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
