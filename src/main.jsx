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
import { PageTransition } from './components/PageTransition.jsx';

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><TarotReading /></PageTransition>} />
        <Route path="/journal/gallery" element={<PageTransition><CardGalleryPage /></PageTransition>} />
        <Route path="/journal" element={<PageTransition><Journal /></PageTransition>} />
        <Route path="/pricing" element={<PageTransition><PricingPage /></PageTransition>} />
        <Route path="/account" element={<PageTransition><AccountPage /></PageTransition>} />
        <Route path="/admin" element={<PageTransition><AdminDashboard /></PageTransition>} />
        <Route path="/share/:token" element={<PageTransition><ShareReading /></PageTransition>} />
        <Route path="*" element={<PageTransition><TarotReading /></PageTransition>} />
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
