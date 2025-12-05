import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { normalizeAnalyticsShape, getGrowthPrompt, getBadgeIcon } from '../lib/archetypeJourney';
import { ConfirmModal } from './ConfirmModal';

/**
 * Accessible modal for displaying growth prompts
 */
function GrowthPromptModal({ cardName, prompt, onClose }) {
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Focus management
  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    document.body.style.overflow = 'hidden';

    // Focus the close button when modal opens
    requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = '';
      // Restore focus when modal closes
      if (previousFocusRef.current?.focus) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  // Keyboard handling
  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    // Focus trap
    if (event.key === 'Tab') {
      const focusableElements = modalRef.current?.querySelectorAll(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusableElements?.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }
  }, [onClose]);

  // Prevent backdrop click from propagating
  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="growth-prompt-title"
        className="relative z-10 w-full max-w-md mx-4 rounded-2xl border border-accent/40 bg-surface/98 shadow-2xl animate-slide-up p-6 focus:outline-none"
        tabIndex={-1}
      >
        <h3
          id="growth-prompt-title"
          className="text-lg font-serif text-accent mb-3"
        >
          {cardName}
        </h3>
        <p className="text-muted text-sm leading-relaxed">{prompt}</p>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="mt-4 w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 transition text-sm font-medium
            focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 touch-manipulation"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/**
 * Archetype Journey Analytics Dashboard
 *
 * Displays gamified analytics:
 * - Top 5 cards this month
 * - Streak badges (e.g., "Tower appeared 3x in Nov")
 * - Trend sparkline per Major Arcana
 * - Growth prompts linked to badges
 */
export default function ArchetypeJourney() {
  const { isAuthenticated } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [preferences, setPreferences] = useState({
    archetype_journey_enabled: true,
    show_badges: true
  });
  const [confirmReset, setConfirmReset] = useState(false);
  const [growthPromptModal, setGrowthPromptModal] = useState(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadAnalytics();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/archetype-journey', {
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 403) {
          const data = await response.json();
          if (data.enabled === false) {
            setPreferences({ archetype_journey_enabled: false, show_badges: false });
            setLoading(false);
            return;
          }
        }
        throw new Error('Failed to load analytics');
      }

      const data = await response.json();
      // Normalize to ensure all arrays exist
      setAnalytics(normalizeAnalyticsShape(data.analytics));
    } catch (err) {
      console.error('Failed to load archetype journey:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleAnalytics = async () => {
    try {
      const newEnabled = !preferences.archetype_journey_enabled;
      const response = await fetch('/api/archetype-journey/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          archetype_journey_enabled: newEnabled
        })
      });

      if (response.ok) {
        setPreferences({ ...preferences, archetype_journey_enabled: newEnabled });
        if (newEnabled) {
          loadAnalytics();
        }
      }
    } catch (err) {
      console.error('Failed to update preferences:', err);
    }
  };

  const handleResetConfirm = async () => {
    try {
      const response = await fetch('/api/archetype-journey/reset', {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        setAnalytics(null);
        loadAnalytics();
      }
    } catch (err) {
      console.error('Failed to reset analytics:', err);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="archetype-journey-placeholder">
        <p className="text-muted">
          Sign in to track which archetypal energies appear most frequently in your readings.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="archetype-journey-loading">
        <p>Loading archetype journey...</p>
      </div>
    );
  }

  if (!preferences.archetype_journey_enabled) {
    return (
      <div className="archetype-journey-disabled">
        <p className="text-muted">Archetype journey analytics are disabled.</p>
        <button onClick={toggleAnalytics} className="btn btn-secondary">
          Enable Analytics
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="archetype-journey-error">
        <p className="error-message">Failed to load analytics: {error}</p>
        <button onClick={loadAnalytics} className="btn btn-secondary">
          Retry
        </button>
      </div>
    );
  }

  if (!analytics || !Array.isArray(analytics.topCards) || analytics.topCards.length === 0) {
    return (
      <div className="archetype-journey-empty">
        <h3>Your Archetype Journey</h3>
        <p className="text-muted">
          Complete readings to discover which archetypal energies appear most in your journey.
        </p>
        <div className="preferences-controls">
          <button onClick={toggleAnalytics} className="btn btn-link">
            Disable Analytics
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="archetype-journey">
      <div className="archetype-journey-header">
        <h3>Your Archetype Journey</h3>
        <p className="subtitle">
          {analytics.currentMonth} · {analytics.totalReadingsThisMonth} reading{analytics.totalReadingsThisMonth !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Top 5 Cards This Month */}
      <section className="top-cards-section">
        <h4>Most Frequent Energies</h4>
        <div className="top-cards-grid">
          {analytics.topCards.map((card, index) => (
            <div key={card.card_name} className="top-card-item">
              <div className="card-rank">#{index + 1}</div>
              <div className="card-info">
                <div className="card-name">{card.card_name}</div>
                <div className="card-count">{card.count}× this month</div>
              </div>
              {card.card_number !== null && card.card_number <= 21 && (
                <div className="growth-prompt-link">
                  <button
                    onClick={() => showGrowthPrompt(card)}
                    className="btn-link"
                    aria-label={`View growth prompt for ${card.card_name}`}
                  >
                    What does this mean?
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Streak Badges */}
      {Array.isArray(analytics.streaks) && analytics.streaks.length > 0 && (
        <section className="streaks-section">
          <h4>Recent Patterns</h4>
          <div className="streaks-grid">
            {analytics.streaks.map((streak) => (
              <div key={streak.cardName} className="streak-badge">
                <div className="badge-icon">🔥</div>
                <div className="badge-info">
                  <div className="badge-title">{streak.cardName}</div>
                  <div className="badge-description">
                    Appeared {streak.count}× in {streak.month}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Badges */}
      {preferences.show_badges && Array.isArray(analytics.badges) && analytics.badges.length > 0 && (
        <section className="badges-section">
          <h4>Achievements</h4>
          <div className="badges-grid">
            {analytics.badges.map((badge) => {
              const BadgeIcon = getBadgeIcon(badge.badge_type);
              return (
                <div key={badge.badge_key} className="achievement-badge">
                  <div className="badge-icon">
                    {BadgeIcon ? <BadgeIcon className="h-12 w-12" aria-hidden="true" /> : null}
                  </div>
                  <div className="badge-info">
                    <div className="badge-title">{badge.card_name || 'Milestone'}</div>
                    <div className="badge-description">
                      {badge.metadata?.context || 'Achievement unlocked'}
                    </div>
                    <div className="badge-date">
                      {new Date(badge.earned_at * 1000).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Trends Sparkline (simplified) */}
      {Array.isArray(analytics.trends) && analytics.trends.length > 0 && (
        <section className="trends-section">
          <h4>Six-Month Patterns</h4>
          <div className="trends-info">
            <p className="text-muted">
              {Object.keys(analytics.majorArcanaFrequency).length} Major Arcana cards appeared this month
            </p>
          </div>
        </section>
      )}

      {/* Preferences Footer */}
      <div className="archetype-journey-footer">
        <button onClick={toggleAnalytics} className="btn btn-link">
          Disable Analytics
        </button>
        <button onClick={() => setConfirmReset(true)} className="btn btn-link text-danger">
          Reset Data
        </button>
      </div>

      {/* Modals */}
      <ConfirmModal
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleResetConfirm}
        title="Reset Archetype Journey Data"
        message="Are you sure you want to reset all archetype journey data? This action cannot be undone."
        confirmText="Reset Data"
        cancelText="Cancel"
        variant="danger"
      />

      {growthPromptModal && (
        <GrowthPromptModal
          cardName={growthPromptModal.cardName}
          prompt={growthPromptModal.prompt}
          onClose={() => setGrowthPromptModal(null)}
        />
      )}
    </div>
  );

  /**
   * Show growth prompt for a card
   */
  function showGrowthPrompt(card) {
    const prompt = getGrowthPrompt(card.card_name);
    setGrowthPromptModal({
      cardName: card.card_name,
      prompt
    });
  }
}
