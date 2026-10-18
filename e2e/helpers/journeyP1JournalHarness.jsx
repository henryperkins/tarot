/* global document */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/contexts/AuthContext.jsx';
import { SubscriptionProvider } from '../../src/contexts/SubscriptionContext.jsx';
import { PreferencesProvider } from '../../src/contexts/PreferencesContext.jsx';
import { ToastProvider } from '../../src/contexts/ToastContext.jsx';
import Journal from '../../src/components/Journal.jsx';
import '../../src/styles/tailwind.css';

const h = React.createElement;
createRoot(document.getElementById('root')).render(
  h(BrowserRouter, null, h(AuthProvider, null, h(SubscriptionProvider, null,
    h(PreferencesProvider, null, h(ToastProvider, null, h(Journal))))))
);
