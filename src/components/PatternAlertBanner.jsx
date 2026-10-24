import { useEffect, useState } from 'react';
import { Sparkle } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { CloseButton } from './CloseButton';
import { BADGE_LABEL_CLASS } from '../styles/labelClasses';

const DISMISS_KEY = 'journal_pattern_alert_dismissed_v1';
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export default function PatternAlertBanner({ isAuthenticated, className = 'mb-6' }) {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return true;
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if (!isAuthenticated || !visible) return;

    fetch('/api/journal/pattern-alerts')
      .then(res => res.json())
      .then(data => {
        if (data.alerts?.length > 0) {
          setAlerts(data.alerts);
        }
      })
      .catch(console.error);
  }, [isAuthenticated, visible]);

  if (!visible || alerts.length === 0) return null;

  const topAlert = alerts[0];
  // Simple formatter: capitalize words and replace dashes with +
  const patternName = topAlert.pattern_id
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' + ');
  const handleDismiss = () => {
    setVisible(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
  };
  const handleViewReadings = () => {
    navigate('/journal', {
      state: {
        focusJournal: true,
        journeyFilter: { type: 'entries', entryIds: topAlert.entryIds || [], label: `Pattern: ${patternName}` }
      }
    });
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border border-primary/25 bg-linear-to-r from-primary/20 to-primary/10 p-4 shadow-lg animate-fade-in ${className}`}>
      <div className="absolute inset-0 bg-primary/5 mix-blend-overlay pointer-events-none" />
      <div className="relative flex items-start gap-3">
        <div className="mt-0.5 shrink-0 text-primary animate-pulse-slow">
          <Sparkle className="h-5 w-5" weight="fill" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-main">
            Recurring Pattern Detected
          </h3>
          <p className="mt-1 text-xs text-muted leading-relaxed">
            The pattern <span className="font-serif text-main">{patternName}</span> has appeared {topAlert.occurrence_count} times recently.
          </p>
          <button
            type="button"
            onClick={handleViewReadings}
            className={`${BADGE_LABEL_CLASS} mt-3 inline-flex min-h-touch items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-accent hover:border-primary/40 hover:bg-primary/20 transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40`}
            title="View the readings containing this pattern"
          >
            View readings
          </button>
        </div>
        <CloseButton label="Dismiss alert" size="sm" onClick={handleDismiss} />
      </div>
    </div>
  );
}
