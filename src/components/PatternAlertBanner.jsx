import { useEffect, useState } from 'react';
import { Sparkle, X } from '@phosphor-icons/react';

export default function PatternAlertBanner({ isAuthenticated }) {
  const [alerts, setAlerts] = useState([]);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    fetch('/api/journal/pattern-alerts')
      .then(res => res.json())
      .then(data => {
        if (data.alerts?.length > 0) {
          setAlerts(data.alerts);
        }
      })
      .catch(console.error);
  }, [isAuthenticated]);

  if (!visible || alerts.length === 0) return null;

  const topAlert = alerts[0];
  // Simple formatter: capitalize words and replace dashes with +
  const patternName = topAlert.pattern_id
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' + ');

  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-300/30 bg-gradient-to-r from-amber-900/40 to-amber-800/40 p-4 mb-6 shadow-lg animate-fade-in">
      <div className="absolute inset-0 bg-amber-400/5 mix-blend-overlay pointer-events-none" />
      <div className="relative flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0 text-amber-300 animate-pulse-slow">
          <Sparkle className="h-5 w-5" weight="fill" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-amber-100">
            Recurring Pattern Detected
          </h3>
          <p className="mt-1 text-xs text-amber-200/80 leading-relaxed">
            The pattern <span className="font-serif text-amber-50">{patternName}</span> has appeared {topAlert.occurrence_count} times recently.
          </p>
        </div>
        <button 
          onClick={() => setVisible(false)}
          className="flex-shrink-0 text-amber-200/50 hover:text-amber-100 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
