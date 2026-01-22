import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import TarotReading from '../TarotReading.jsx';
import Journal from './Journal.jsx';
import CardGalleryPage from '../pages/CardGalleryPage.jsx';
import ShareReading from '../pages/ShareReading.jsx';
import PricingPage from '../pages/PricingPage.jsx';
import AccountPage from '../pages/AccountPage.jsx';
import AdminDashboard from '../pages/AdminDashboard.jsx';
import ResetPasswordPage from '../pages/ResetPasswordPage.jsx';
import VerifyEmailPage from '../pages/VerifyEmailPage.jsx';
import { PageTransition } from './PageTransition.jsx';

export function AnimatedRoutes() {
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
        <Route path="/reset-password" element={<PageTransition><ResetPasswordPage /></PageTransition>} />
        <Route path="/verify-email" element={<PageTransition><VerifyEmailPage /></PageTransition>} />
        <Route path="*" element={<PageTransition><TarotReading /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
}

export default AnimatedRoutes;
