import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

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
      setAnalytics(data.analytics);
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

  const resetAnalytics = async () => {
    if (!confirm('Are you sure you want to reset all archetype journey data?')) {
      return;
    }

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

  if (!analytics || analytics.topCards.length === 0) {
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
      {analytics.streaks.length > 0 && (
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
      {preferences.show_badges && analytics.badges.length > 0 && (
        <section className="badges-section">
          <h4>Achievements</h4>
          <div className="badges-grid">
            {analytics.badges.map((badge) => (
              <div key={badge.badge_key} className="achievement-badge">
                <div className="badge-icon">
                  {getBadgeIcon(badge.badge_type)}
                </div>
                <div className="badge-info">
                  <div className="badge-title">{badge.card_name || 'Milestone'}</div>
                  <div className="badge-description">
                    {badge.metadata.context || 'Achievement unlocked'}
                  </div>
                  <div className="badge-date">
                    {new Date(badge.earned_at * 1000).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Trends Sparkline (simplified) */}
      {analytics.trends.length > 0 && (
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
        <button onClick={resetAnalytics} className="btn btn-link text-danger">
          Reset Data
        </button>
      </div>
    </div>
  );
}

/**
 * Show growth prompt for a card
 */
function showGrowthPrompt(card) {
  // Simple modal or inline expansion - for MVP, just log
  // In full implementation, expand inline or show modal with growth prompt
  const prompt = getGrowthPrompt(card.card_name);
  alert(`${card.card_name}\n\n${prompt}`);
}

/**
 * Get growth prompt for a card based on its archetype
 */
function getGrowthPrompt(cardName) {
  const prompts = {
    'The Fool': 'Recurring Fool energy suggests you\'re in a season of new beginnings. What leap of faith is calling you?',
    'The Magician': 'The Magician appears when you have all the tools you need. What are you ready to manifest?',
    'The High Priestess': 'The High Priestess invites you inward. What wisdom is your intuition revealing?',
    'The Empress': 'The Empress energy calls for nurturing. What in your life needs tending?',
    'The Emperor': 'The Emperor appears when structure is needed. Where can you create healthy boundaries?',
    'The Hierophant': 'The Hierophant suggests learning from tradition. What wisdom do you seek?',
    'The Lovers': 'The Lovers energy highlights choices and alignment. What values guide your path?',
    'The Chariot': 'The Chariot appears when willpower is key. What direction are you moving toward?',
    'Strength': 'Strength energy is about compassion and courage. Where can you be gentle with power?',
    'The Hermit': 'The Hermit calls for solitude and reflection. What inner guidance are you seeking?',
    'Wheel of Fortune': 'The Wheel reminds you of life\'s cycles. What patterns are you noticing?',
    'Justice': 'Justice appears when balance is needed. What truth are you seeking?',
    'The Hanged Man': 'The Hanged Man invites a new perspective. What are you ready to release?',
    'Death': 'Death energy signals transformation. What old form is ready to fall away?',
    'Temperance': 'Temperance calls for integration. What opposing forces seek harmony?',
    'The Devil': 'The Devil appears when examining attachments. What pattern needs awareness?',
    'The Tower': 'Tower energy brings breakthrough. What false structure is crumbling to make space for truth?',
    'The Star': 'The Star brings hope and healing. What dream is worth nurturing?',
    'The Moon': 'The Moon illuminates illusions. What fears need gentle examination?',
    'The Sun': 'The Sun celebrates vitality and joy. What brings you alive?',
    'Judgement': 'Judgement calls for awakening. What is your soul calling you toward?',
    'The World': 'The World signals completion. What cycle is reaching its fulfillment?'
  };

  return prompts[cardName] || 'This card holds important energy for your journey. What does its recurring presence reveal?';
}

/**
 * Get icon for badge type
 */
function getBadgeIcon(badgeType) {
  const icons = {
    'streak': '🔥',
    'frequency': '⭐',
    'completion': '🎯',
    'milestone': '🏆'
  };
  return icons[badgeType] || '✨';
}
