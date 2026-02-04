import { useEffect, useState } from 'react';
import { Sparkle, X } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { getAllCards, getCanonicalCard } from '../lib/cardLookup';

const DISMISS_KEY = 'journal_pattern_alert_dismissed_v1';
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const CARD_KEYS = getAllCards()
  .map((card) => ({
    name: card.name,
    key: card.name.toLowerCase().replace(/\s+/g, '-')
  }))
  .sort((a, b) => b.key.length - a.key.length);

function derivePatternQuery(patternId, patternName) {
  if (!patternId) return patternName || '';
  const canonical = getCanonicalCard(patternId);
  if (canonical?.name) return canonical.name;

  const normalized = patternId.toLowerCase();
  const matches = CARD_KEYS.filter((card) => {
    const regex = new RegExp(`(^|-)${card.key}(-|$)`);
    return regex.test(normalized);
  });
  if (matches.length === 0) {
    return patternName ? patternName.replace(/\s*\+\s*/g, ' ') : '';
  }
  matches.sort((a, b) => normalized.indexOf(a.key) - normalized.indexOf(b.key));
  return matches[0]?.name || patternName || '';
}

export default function PatternAlertBanner({ isAuthenticated }) {
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
  const patternQuery = derivePatternQuery(topAlert.pattern_id, patternName);
  const handleDismiss = () => {
    setVisible(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
  };
  const handleViewReadings = () => {
    navigate('/journal', {
      state: {
        prefillQuery: patternQuery || patternName
      }
    });
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-r from-primary/20 to-primary/10 p-4 mb-6 shadow-lg animate-fade-in">
      <div className="absolute inset-0 bg-primary/5 mix-blend-overlay pointer-events-none" />
      <div className="relative flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0 text-primary animate-pulse-slow">
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
            className="mt-3 inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-2xs font-semibold uppercase tracking-[0.18em] text-accent hover:border-primary/40 hover:bg-primary/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            title={patternQuery ? `Filter journal by ${patternQuery}` : 'View readings in your journal'}
          >
            View readings
          </button>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-muted/60 hover:text-main transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
