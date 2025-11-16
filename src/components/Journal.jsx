import React, { useEffect, useState } from 'react';
import { ChevronLeft, LogIn, Upload, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlobalNav } from './GlobalNav';
import { useAuth } from '../contexts/AuthContext';
import { useJournal } from '../hooks/useJournal';
import AuthModal from './AuthModal';

const CONTEXT_SUMMARIES = {
  love: 'Relationship lens — center relational reciprocity and communication.',
  career: 'Career lens — focus on vocation, impact, and material pathways.',
  self: 'Self lens — emphasize personal growth and inner landscape.',
  spiritual: 'Spiritual lens — frame insights through devotion, meaning, and practice.'
};

const TIMING_SUMMARIES = {
  'near-term-tilt': 'Timing: energy is likely to shift in the near-term if you engage with it.',
  'longer-arc-tilt': 'Timing: this pattern stretches over a longer arc demanding patience.',
  'developing-arc': 'Timing: expect this to develop as an unfolding chapter, not a single moment.'
};

function buildThemeInsights(entry) {
  const lines = [];
  const themes = entry?.themes;
  if (entry?.context) {
    lines.push(CONTEXT_SUMMARIES[entry.context] || `Context lens: ${entry.context}`);
  }

  if (!themes || typeof themes !== 'object') {
    return lines;
  }

  if (themes.suitFocus) {
    lines.push(themes.suitFocus);
  } else if (themes.dominantSuit) {
    lines.push(`Suit focus: ${themes.dominantSuit} themes stand out in this spread.`);
  }

  if (themes.elementalBalance) {
    lines.push(themes.elementalBalance);
  }

  if (themes.archetypeDescription) {
    lines.push(themes.archetypeDescription);
  }

  if (themes.reversalDescription?.name) {
    const desc = themes.reversalDescription.description
      ? ` — ${themes.reversalDescription.description}`
      : '';
    lines.push(`Reversal lens: ${themes.reversalDescription.name}${desc}`);
  }

  if (themes.timingProfile && TIMING_SUMMARIES[themes.timingProfile]) {
    lines.push(TIMING_SUMMARIES[themes.timingProfile]);
  }

  return lines.filter(Boolean);
}

function JournalEntryCard({ entry }) {
  const insights = buildThemeInsights(entry);
  const [showNarrative, setShowNarrative] = useState(false);

  return (
    <div className="bg-slate-900/80 p-6 rounded-xl border border-emerald-400/40">
      <h2 className="text-xl font-serif text-amber-200 mb-2">{entry.spread}</h2>
      <p className="text-sm text-amber-100/70 mb-4">
        {new Date(entry.ts).toLocaleString()}
      </p>
      {entry.question && (
        <p className="italic text-amber-100/80 mb-4">Question: {entry.question}</p>
      )}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-amber-200 mb-2">Cards</h3>
        <ul className="list-disc pl-5 space-y-1 text-amber-100/80">
          {entry.cards.map((card, idx) => (
            <li key={idx}>
              {card.position}: {card.name} ({card.orientation})
            </li>
          ))}
        </ul>
      </div>
      {insights.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-amber-200 mb-2">Saved Insights</h3>
          <ul className="list-disc pl-5 space-y-1 text-amber-100/80">
            {insights.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </div>
      )}
      {entry.personalReading && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowNarrative(prev => !prev)}
            className="mb-2 inline-flex items-center px-3 py-1.5 rounded-full border border-amber-400/60 text-xs sm:text-sm text-amber-100 hover:bg-amber-500/10 transition"
          >
            {showNarrative ? 'Hide narrative' : 'View narrative'}
          </button>
          {showNarrative && (
            <div>
              <h3 className="text-sm font-semibold text-amber-200 mb-2">Narrative</h3>
              <p className="text-amber-100/80 whitespace-pre-wrap">
                {entry.personalReading}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Journal() {
  const { isAuthenticated, user, logout } = useAuth();
  const { entries, loading, deleteEntry, migrateToCloud } = useJournal();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrateMessage, setMigrateMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const storedTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('tarot-theme') : null;
    const activeTheme = storedTheme === 'light' ? 'light' : 'dark';
    const root = typeof document !== 'undefined' ? document.documentElement : null;
    if (root) {
      root.classList.toggle('light', activeTheme === 'light');
    }
  }, []);

  const handleMigrate = async () => {
    setMigrating(true);
    setMigrateMessage('');

    const result = await migrateToCloud();

    if (result.success) {
      setMigrateMessage(`Successfully migrated ${result.migrated} entries to the cloud!`);
      setTimeout(() => setMigrateMessage(''), 5000);
    } else {
      setMigrateMessage(`Migration failed: ${result.error}`);
    }

    setMigrating(false);
  };

  const handleDelete = async (entryId) => {
    if (!confirm('Are you sure you want to delete this journal entry?')) {
      return;
    }

    await deleteEntry(entryId);
  };

  // Check if we have localStorage entries that can be migrated
  const hasLocalStorageEntries = () => {
    if (typeof localStorage === 'undefined') return false;
    const stored = localStorage.getItem('tarot_journal');
    if (!stored) return false;
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-amber-50">
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <GlobalNav />

          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate('/')}
              className="flex items-center text-amber-200 hover:text-amber-100"
            >
              <ChevronLeft className="w-5 h-5 mr-2" />
              Back to Reading
            </button>

            {/* Auth controls */}
            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                <>
                  <span className="text-sm text-amber-200">
                    {user?.username}
                  </span>
                  <button
                    onClick={logout}
                    className="text-sm text-amber-300 hover:text-amber-200 underline"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </div>

          <h1 className="text-3xl font-serif text-amber-200 mb-4">Your Tarot Journal</h1>

          {/* Auth status & migration banner */}
          {isAuthenticated ? (
            <div className="mb-6 p-4 bg-emerald-900/30 border border-emerald-400/40 rounded-lg">
              <p className="text-sm text-emerald-200">
                ✓ Signed in — Your journal is synced across devices
              </p>
              {hasLocalStorageEntries() && !migrating && (
                <button
                  onClick={handleMigrate}
                  className="mt-2 flex items-center gap-2 text-sm text-emerald-300 hover:text-emerald-200 underline"
                >
                  <Upload className="w-4 h-4" />
                  Migrate localStorage entries to cloud
                </button>
              )}
              {migrating && (
                <p className="mt-2 text-sm text-emerald-300">Migrating...</p>
              )}
              {migrateMessage && (
                <p className="mt-2 text-sm text-emerald-200">{migrateMessage}</p>
              )}
            </div>
          ) : (
            <div className="mb-6 p-4 bg-amber-900/30 border border-amber-400/40 rounded-lg">
              <p className="text-sm text-amber-200">
                Your journal is currently stored locally in this browser only.{' '}
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="underline hover:text-amber-100"
                >
                  Sign in
                </button>{' '}
                to sync across devices.
              </p>
            </div>
          )}

          {/* Loading state */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
              <p className="mt-4 text-amber-100/70">Loading journal...</p>
            </div>
          ) : entries.length === 0 ? (
            <p className="text-amber-100/80">No entries yet. Save a reading to start your journal.</p>
          ) : (
            <div className="space-y-8">
              {entries.map((entry) => (
                <div key={entry.id} className="relative">
                  <JournalEntryCard entry={entry} />
                  {isAuthenticated && (
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="absolute top-4 right-4 p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition"
                      title="Delete entry"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
}
