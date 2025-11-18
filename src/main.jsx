import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './styles/tailwind.css';
import TarotReading from './TarotReading.jsx';
import Journal from './components/Journal.jsx';
import ShareReading from './pages/ShareReading.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { PreferencesProvider } from './contexts/PreferencesContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <PreferencesProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<TarotReading />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/share/:token" element={<ShareReading />} />
            <Route path="*" element={<TarotReading />} />
          </Routes>
        </BrowserRouter>
      </PreferencesProvider>
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
