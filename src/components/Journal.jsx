import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, LogIn, Upload, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlobalNav } from './GlobalNav';
import { useAuth } from '../contexts/AuthContext';
import { useJournal } from '../hooks/useJournal';
import AuthModal from './AuthModal';
import { CardSymbolInsights } from './CardSymbolInsights';
import {
  buildCardInsightPayload,
  computeJournalStats,
  exportJournalEntriesToCsv,
  copyJournalShareSummary,
  copyJournalEntrySummary,
  loadShareTokenHistory,
  revokeShareToken,
  saveCoachRecommendation
} from '../lib/journalInsights';

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

const CONTEXT_TO_SPREAD = {
  love: {
    spread: 'Relationship Snapshot',
    spreadKey: 'relationship',
    question: 'How can I nurture reciprocity in my closest connection right now?'
  },
  career: {
    spread: 'Decision / Two-Path',
    spreadKey: 'decision',
    question: 'What would help me choose the path that aligns with my purpose?'
  },
  self: {
    spread: 'Three-Card Story',
    spreadKey: 'threeCard',
    question: 'What inner story is ready to evolve this season?'
  },
  spiritual: {
    spread: 'Celtic Cross',
    spreadKey: 'celtic',
    question: 'How can I deepen trust with my spiritual practice now?'
  },
  wellbeing: {
    spread: 'Five-Card Clarity',
    spreadKey: 'fiveCard',
    question: 'Where can I rebalance my energy in the days ahead?'
  }
};

function mapContextToTopic(context) {
  switch (context) {
    case 'love':
      return 'relationships';
    case 'career':
      return 'career';
    case 'self':
      return 'growth';
    case 'spiritual':
      return 'growth';
    case 'wellbeing':
      return 'wellbeing';
    case 'decision':
      return 'decision';
    default:
      return null;
  }
}

function JournalCardListItem({ card }) {
  const insightCard = buildCardInsightPayload(card);

  return (
    <li className="rounded-2xl border border-emerald-400/30 bg-slate-950/60 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-200">{card.position}</p>
          <p className="text-sm text-amber-100/80">
            {card.name} ({card.orientation})
          </p>
        </div>
        {insightCard && (
          <CardSymbolInsights card={insightCard} position={card.position} />
        )}
      </div>
    </li>
  );
}

function JournalInsightsPanel({
  stats,
  entries,
  shareHistory = [],
  onShareHistoryRefresh,
  onRevokeShareToken
}) {
  if (!stats) return null;

  const [actionMessage, setActionMessage] = useState('');

  const handleExport = () => {
    const result = exportJournalEntriesToCsv(entries);
    if (result) {
      onShareHistoryRefresh?.();
    }
    setActionMessage(result ? 'Exported journal.csv' : 'Unable to export right now');
    setTimeout(() => setActionMessage(''), 3500);
  };

  const handleShare = async () => {
    const success = await copyJournalShareSummary(stats);
    setActionMessage(success ? 'Snapshot copied for sharing' : 'Unable to copy snapshot');
    setTimeout(() => setActionMessage(''), 3500);
  };

  const topContext = stats.contextBreakdown?.slice().sort((a, b) => b.count - a.count)[0];
  const contextSuggestion = topContext && CONTEXT_TO_SPREAD[topContext.name];
  const topCard = stats.frequentCards?.[0];
  const coachRecommendation = useMemo(() => {
    if (contextSuggestion) {
      return {
        question: contextSuggestion.question,
        spreadName: contextSuggestion.spread,
        spreadKey: contextSuggestion.spreadKey,
        topicValue: mapContextToTopic(topContext?.name),
        timeframeValue: 'week',
        depthValue: 'guided',
        source: topContext?.name ? `context:${topContext.name}` : 'context'
      };
    }
    if (topCard) {
      return {
        question: `What is ${topCard.name} inviting me to embody next?`,
        spreadName: 'Three-Card Story',
        spreadKey: 'threeCard',
        topicValue: 'growth',
        timeframeValue: 'open',
        depthValue: 'lesson',
        source: `card:${topCard.name}`,
        cardName: topCard.name
      };
    }
    return null;
  }, [contextSuggestion, topCard, topContext]);

  useEffect(() => {
    saveCoachRecommendation(coachRecommendation);
  }, [coachRecommendation]);

  return (
    <section className="mb-8 rounded-3xl border border-emerald-400/40 bg-slate-950/70 p-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">Journal pulse</p>
          <h2 className="text-2xl font-serif text-amber-100">Reading insights at a glance</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="rounded-full border border-amber-400/50 px-3 py-1 text-xs text-amber-200 hover:bg-amber-500/10"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="rounded-full border border-emerald-400/50 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/10"
          >
            Share snapshot
          </button>
        </div>
      </div>

      <p className="mt-2 text-sm text-amber-200/70">
        {stats.totalReadings} entries · {stats.totalCards} cards logged · {stats.reversalRate}% reversed
      </p>
      {actionMessage && (
        <p className="mt-2 text-xs text-emerald-200/70">{actionMessage}</p>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-amber-400/30 bg-slate-950/80 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-300/70">Entries</p>
          <p className="text-2xl font-semibold text-amber-100">{stats.totalReadings}</p>
          <p className="text-xs text-amber-200/70">Saved sessions</p>
        </div>
        <div className="rounded-2xl border border-amber-400/30 bg-slate-950/80 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-300/70">Cards logged</p>
          <p className="text-2xl font-semibold text-amber-100">{stats.totalCards}</p>
          <p className="text-xs text-amber-200/70">Across spreads</p>
        </div>
        <div className="rounded-2xl border border-amber-400/30 bg-slate-950/80 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-300/70">Reversal tilt</p>
          <p className="text-2xl font-semibold text-amber-100">{stats.reversalRate}%</p>
          <p className="text-xs text-amber-200/70">Of cards pulled</p>
        </div>
      </div>

      {stats.frequentCards.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400/80">Most frequent cards</h3>
          <ul className="mt-3 space-y-2">
            {stats.frequentCards.map((card) => (
              <li
                key={card.name}
                className="flex items-center justify-between rounded-2xl bg-slate-900/60 px-4 py-3 text-sm text-amber-100/90"
              >
                <span>{card.name}</span>
                <span className="text-amber-300/80">
                  {card.count}×{card.reversed ? ` · ${card.reversed} reversed` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stats.contextBreakdown.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400/80">Context mix</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.contextBreakdown.map((context) => (
              <span
                key={context.name}
                className="rounded-full border border-emerald-400/30 px-3 py-1 text-xs text-emerald-200"
              >
                {context.name}: {context.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {stats.monthlyCadence.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400/80">Monthly cadence</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {stats.monthlyCadence.map((month) => (
              <div key={month.label} className="rounded-2xl border border-emerald-400/30 bg-slate-950/60 p-3 text-center">
                <p className="text-xs text-amber-200/70">{month.label}</p>
                <p className="text-lg font-semibold text-amber-100">{month.count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.recentThemes?.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400/80">Recent themes</h3>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-100/80">
            {stats.recentThemes.map((theme, idx) => (
              <li key={`${theme}-${idx}`}>{theme}</li>
            ))}
          </ul>
        </div>
      )}

      {(contextSuggestion || topCard) && (
        <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Next reading idea</p>
          <p className="mt-2 font-serif text-lg text-amber-50">
            {contextSuggestion?.spread || 'Three-Card Story'}
          </p>
          <p className="mt-2 text-sm text-amber-100/80">
            {contextSuggestion?.question ||
              (topCard
                ? `What is ${topCard.name} inviting me to embody next?`
                : 'What pattern is ready to shift in my story?')}
          </p>
          {coachRecommendation && (
            <button
              type="button"
              onClick={() => {
                saveCoachRecommendation(coachRecommendation);
                setActionMessage('Sent suggestion to intention coach');
                setTimeout(() => setActionMessage(''), 3500);
              }}
              className="mt-3 inline-flex items-center rounded-full border border-emerald-300/50 px-3 py-1 text-xs text-emerald-100 hover:bg-emerald-500/10"
            >
              Pre-fill intention coach
            </button>
          )}
        </div>
      )}

      {shareHistory.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400/80">Manage share links</h3>
          <div className="mt-3 space-y-2 text-xs text-amber-100/80">
            {shareHistory.slice(0, 5).map((record) => (
              <div key={record.token} className="rounded-2xl border border-emerald-400/20 bg-slate-900/60 p-3 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-semibold text-amber-200">{record.scope === 'entry' ? 'Entry share' : 'Journal export'}</p>
                  <p className="text-amber-100/70">{new Date(record.createdAt).toLocaleString()}</p>
                  <p className="text-amber-200/60">{record.count} readings • token {record.token.slice(0, 8)}…</p>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        if (navigator?.clipboard?.writeText) {
                          await navigator.clipboard.writeText(record.token);
                          setActionMessage('Share token copied');
                        } else {
                          setActionMessage('Clipboard not available');
                        }
                      } catch (error) {
                        setActionMessage('Unable to copy token');
                      }
                      setTimeout(() => setActionMessage(''), 3500);
                    }}
                    className="rounded-full border border-emerald-400/40 px-3 py-1 text-emerald-100 hover:bg-emerald-500/10"
                  >
                    Copy token
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.open(`/share/${record.token}`, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    className="rounded-full border border-amber-400/40 px-3 py-1 text-amber-100 hover:bg-amber-500/10"
                  >
                    Open link
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onRevokeShareToken?.(record.token);
                      setActionMessage('Share token revoked');
                      setTimeout(() => setActionMessage(''), 3500);
                    }}
                    className="rounded-full border border-red-400/40 px-3 py-1 text-red-100 hover:bg-red-500/10"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

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

function JournalEntryCard({ entry, onShareHistoryRefresh }) {
  const insights = buildThemeInsights(entry);
  const [showNarrative, setShowNarrative] = useState(false);
  const [entryActionMessage, setEntryActionMessage] = useState('');

  const handleEntryExport = () => {
    const filename = `tarot-entry-${entry.id || entry.ts || 'reading'}.csv`;
    const success = exportJournalEntriesToCsv([entry], filename);
    if (success) {
      onShareHistoryRefresh?.();
    }
    setEntryActionMessage(success ? 'Entry CSV downloaded' : 'Export unavailable');
    setTimeout(() => setEntryActionMessage(''), 3500);
  };

  const handleEntryShare = async () => {
    const success = await copyJournalEntrySummary(entry);
    setEntryActionMessage(success ? 'Entry snapshot ready to share' : 'Unable to share entry now');
    setTimeout(() => setEntryActionMessage(''), 3500);
  };

  return (
    <div className="bg-slate-900/80 p-6 rounded-xl border border-emerald-400/40">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-serif text-amber-200">{entry.spread}</h2>
          <p className="text-sm text-amber-100/70">
            {new Date(entry.ts).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={handleEntryExport}
            className="rounded-full border border-amber-400/50 px-3 py-1 text-amber-200 hover:bg-amber-500/10"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleEntryShare}
            className="rounded-full border border-emerald-400/50 px-3 py-1 text-emerald-200 hover:bg-emerald-500/10"
          >
            Share snapshot
          </button>
        </div>
      </div>
      {entryActionMessage && (
        <p className="mt-2 text-xs text-emerald-200/70">{entryActionMessage}</p>
      )}
      <div className="mt-4">
        {entry.question && (
          <p className="italic text-amber-100/80 mb-4">Question: {entry.question}</p>
        )}
      </div>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-amber-200 mb-2">Cards</h3>
        <ul className="space-y-3">
          {entry.cards.map((card, idx) => (
            <JournalCardListItem key={idx} card={card} />
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
  const [shareHistory, setShareHistory] = useState(() => loadShareTokenHistory());
  const navigate = useNavigate();
  const journalStats = useMemo(() => computeJournalStats(entries), [entries]);

  const refreshShareHistory = () => {
    setShareHistory(loadShareTokenHistory());
  };

  const handleShareTokenRevoke = (token) => {
    setShareHistory(revokeShareToken(token));
  };

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
              {journalStats && (
                <JournalInsightsPanel
                  stats={journalStats}
                  entries={entries}
                  shareHistory={shareHistory}
                  onShareHistoryRefresh={refreshShareHistory}
                  onRevokeShareToken={handleShareTokenRevoke}
                />
              )}
              {entries.map((entry) => (
                <div key={entry.id} className="relative">
                  <JournalEntryCard entry={entry} onShareHistoryRefresh={refreshShareHistory} />
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
