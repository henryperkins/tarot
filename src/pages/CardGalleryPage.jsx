import { useState, useEffect, useMemo, useCallback } from 'react';
import { CaretLeft, Funnel, SortAscending, LockKey } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { GlobalNav } from '../components/GlobalNav';
import { CardModal } from '../components/CardModal';
import { MAJOR_ARCANA } from '../data/majorArcana';
import { MINOR_ARCANA } from '../data/minorArcana';
import { useAuth } from '../contexts/AuthContext';
import { useJournal } from '../hooks/useJournal';
import { getCanonicalCard } from '../lib/cardLookup';
import { getTimestampSeconds, safeJsonParse } from '../../shared/journal/utils.js';
import { pickStats, computeGalleryLoading } from './cardGallerySelectors';
import { useReducedMotion } from '../hooks/useReducedMotion';

const ALL_CARDS = [...MAJOR_ARCANA, ...MINOR_ARCANA];

function normalizeCardName(name) {
  if (!name || typeof name !== 'string') return null;
  const canonical = getCanonicalCard(name);
  return canonical?.name || name.trim();
}

function safeGetEntryCards(entry) {
  if (!entry) return [];
  if (Array.isArray(entry.cards)) return entry.cards;
  return safeJsonParse(entry?.cards_json, []);
}

function buildRelatedEntries(entries, cardName) {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  if (!cardName) return [];

  const normalizedTarget = normalizeCardName(cardName);
  if (!normalizedTarget) return [];

  const matches = [];
  for (const entry of entries) {
    const cards = safeGetEntryCards(entry);
    const hasCard = cards.some((card) => {
      const rawName = card?.name || card?.card || '';
      const normalized = normalizeCardName(rawName);
      return normalized && normalized === normalizedTarget;
    });
    if (!hasCard) continue;

    // Use seconds consistently to avoid mixed ms/seconds ordering bugs.
    const tsSeconds = getTimestampSeconds(entry);
    matches.push({
      id: entry?.id,
      ts: tsSeconds,
      question: entry?.question,
      spread: entry?.spread,
    });
  }

  // Most recent first
  matches.sort((a, b) => (b?.ts || 0) - (a?.ts || 0));
  return matches;
}

function buildLocalCardStats(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return {};

  const map = {};

  entries.forEach((entry) => {
    const ts = getTimestampSeconds(entry);
    if (!ts) return;

    const cards = Array.isArray(entry?.cards)
      ? entry.cards
      : (() => {
          try {
            return entry?.cards_json ? JSON.parse(entry.cards_json) : [];
          } catch {
            return [];
          }
        })();

    cards.forEach((card) => {
      const rawName = card?.name || card?.card || '';
      const cardName = normalizeCardName(rawName);
      if (!cardName) return;

      const existing = map[cardName] || {
        card_name: cardName,
        total_count: 0,
        last_seen: ts,
        first_seen: ts,
      };

      existing.total_count += 1;
      existing.last_seen = Math.max(existing.last_seen || ts, ts);
      existing.first_seen = Math.min(existing.first_seen || ts, ts);
      map[cardName] = existing;
    });
  });

  return map;
}

function CardItem({ card, stats, onSelect, onViewInJournal, index = 0 }) {
  const prefersReducedMotion = useReducedMotion();
  const isFound = !!stats;
  const count = stats?.total_count || 0;

  // Format last seen date
  const lastSeenLabel = stats?.last_seen
    ? new Date(stats.last_seen * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  const content = (
    <>
      {/* Card Image */}
      <div className="absolute inset-0">
        <img
          src={card.image}
          alt={card.name}
          className={`h-full w-full object-cover transition-opacity duration-500 ${isFound ? 'opacity-90 group-hover:opacity-100' : 'opacity-30'}`}
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
      </div>

      {/* Content Overlay */}
      <div className="absolute inset-0 p-3 flex flex-col justify-between">
        {/* Top: Status */}
        <div className="flex justify-between items-start">
          {isFound ? (
            <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-amber-300/90 text-[10px] font-bold text-slate-900 shadow-sm">
              {count}x
            </span>
          ) : (
            <LockKey className="w-4 h-4 text-white/30" />
          )}
        </div>

        {/* Bottom: Name & Date */}
        <div>
          <p className={`font-serif text-sm leading-tight mb-0.5 ${isFound ? 'text-amber-50' : 'text-white/50'}`}>
            {card.name}
          </p>
          {isFound && (
            <p className="text-[10px] text-amber-200/60 font-medium">
              Seen {lastSeenLabel}
            </p>
          )}
        </div>
      </div>
    </>
  );

  const animationVariants = prefersReducedMotion ? {
    initial: { opacity: 0 },
    animate: { opacity: 1 }
  } : {
    initial: { opacity: 0, y: 20, scale: 0.9 },
    animate: { opacity: 1, y: 0, scale: 1 }
  };

  if (isFound) {
    return (
      <motion.div
        className="group relative aspect-[2/3] rounded-xl border transition-all duration-300 overflow-hidden text-left border-amber-300/20 bg-gradient-to-b from-[#120f1f] via-[#0c0a14] to-[#0a0911] shadow-lg hover:-translate-y-1 hover:border-amber-300/40 hover:shadow-amber-300/10"
        aria-label={`Card ${card.name}`}
        variants={animationVariants}
        initial="initial"
        animate="animate"
        transition={{
          duration: prefersReducedMotion ? 0.15 : 0.4,
          delay: prefersReducedMotion ? 0 : index * 0.03,
          ease: [0.4, 0, 0.2, 1]
        }}
      >
        <button
          type="button"
          onClick={() => onSelect?.(card)}
          className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-main"
          aria-label={`Open details for ${card.name}`}
        />
        {content}
        {onViewInJournal && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onViewInJournal(card);
            }}
            className="absolute top-2 right-2 z-20 rounded-full border border-amber-200/30 bg-black/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/80 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50"
            aria-label={`View ${card.name} in Journal`}
          >
            View in Journal
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      className="group relative aspect-[2/3] rounded-xl border transition-all duration-300 overflow-hidden border-white/5 bg-white/[0.02] opacity-60 grayscale hover:opacity-80"
      aria-label={`${card.name} (not yet discovered)`}
      variants={animationVariants}
      initial="initial"
      animate="animate"
      transition={{
        duration: prefersReducedMotion ? 0.15 : 0.4,
        delay: prefersReducedMotion ? 0 : index * 0.03,
        ease: [0.4, 0, 0.2, 1]
      }}
    >
      {content}
    </motion.div>
  );
}

export default function CardGalleryPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { entries, loading: journalLoading } = useJournal();
  const prefersReducedMotion = useReducedMotion();

  const [selected, setSelected] = useState(null);

  const [remoteStats, setRemoteStats] = useState(null);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [analyticsDisabled, setAnalyticsDisabled] = useState(false);

  // Filters
  const [filterSuit, setFilterSuit] = useState('all'); // all, major, wands, cups, swords, pentacles
  const [filterStatus, setFilterStatus] = useState('all'); // all, found, missing
  const [sortBy, setSortBy] = useState('deck'); // deck, count_desc, count_asc, recency

  // Reset remote state when auth status or user changes to avoid cross-account leakage.
  useEffect(() => {
    setRemoteStats(null);
    setRemoteLoading(false);
    setAnalyticsDisabled(false);
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    async function fetchStats() {
      if (!isAuthenticated) return;

      try {
        setRemoteLoading(true);
        setAnalyticsDisabled(false);

        const res = await fetch('/api/archetype-journey/card-frequency', {
          credentials: 'include'
        });

        if (res.status === 403) {
          setAnalyticsDisabled(true);
          setRemoteStats(null);
          return;
        }

        if (res.ok) {
          const data = await res.json();
          // Convert array to map for O(1) lookup
          const map = {};
          (data.cards || []).forEach(c => {
            const cardName = normalizeCardName(c.card_name);
            if (!cardName) return;
            map[cardName] = {
              ...c,
              card_name: cardName,
            };
          });
          setRemoteStats(map);
        } else {
          // Non-fatal: fall back to local computation.
          setRemoteStats(null);
        }
      } catch (err) {
        console.error('Failed to load card stats', err);
        setRemoteStats(null);
      } finally {
        setRemoteLoading(false);
      }
    }

    fetchStats();
  }, [isAuthenticated, user?.id]);

  const localStats = useMemo(() => buildLocalCardStats(entries), [entries]);

  const stats = useMemo(() => pickStats({
    isAuthenticated,
    analyticsDisabled,
    remoteStats,
    localStats
  }), [analyticsDisabled, isAuthenticated, localStats, remoteStats]);

  const loading = useMemo(() => computeGalleryLoading({
    isAuthenticated,
    analyticsDisabled,
    remoteStats,
    remoteLoading,
    journalLoading
  }), [analyticsDisabled, isAuthenticated, journalLoading, remoteLoading, remoteStats]);

  // Derived state
  const deckSize = ALL_CARDS.length;
  const totalFound = ALL_CARDS.reduce((sum, card) => sum + (stats[card.name] ? 1 : 0), 0);
  const progressPercent = deckSize ? Math.round((totalFound / deckSize) * 100) : 0;

  const filteredCards = useMemo(() => {
    let result = [...ALL_CARDS];

    // Filter by Suit
    if (filterSuit !== 'all') {
      if (filterSuit === 'major') {
        result = result.filter(c => !c.suit);
      } else {
        // Suit names are "Wands", "Cups", etc. (Capitalized)
        const target = filterSuit.charAt(0).toUpperCase() + filterSuit.slice(1);
        result = result.filter(c => c.suit === target);
      }
    }

    // Filter by Status
    if (filterStatus !== 'all') {
      if (filterStatus === 'found') {
        result = result.filter(c => stats[c.name]);
      } else if (filterStatus === 'missing') {
        result = result.filter(c => !stats[c.name]);
      }
    }

    // Sort
    result.sort((a, b) => {
      const statA = stats[a.name];
      const statB = stats[b.name];

      if (sortBy === 'count_desc') {
        return (statB?.total_count || 0) - (statA?.total_count || 0);
      }
      if (sortBy === 'count_asc') {
        return (statA?.total_count || 0) - (statB?.total_count || 0);
      }
      if (sortBy === 'recency') {
        return (statB?.last_seen || 0) - (statA?.last_seen || 0);
      }
      // Default: Deck order (Major 0-21, then Minors by suit/rank)
      // The ALL_CARDS array is already in deck order.
      return 0;
    });

    return result;
  }, [filterSuit, filterStatus, sortBy, stats]);

  const handleSelectCard = useCallback((card) => {
    if (!card) return;
    const stat = stats[card.name];
    if (!stat) return;

    const related = buildRelatedEntries(entries, card.name);
    setSelected({
      card,
      stats: stat,
      relatedEntries: related,
    });
  }, [stats, entries]);

  const handleViewAllInJournal = useCallback((cardName) => {
    navigate('/journal', {
      state: {
        prefillQuery: cardName,
      }
    });
  }, [navigate]);

  const handleOpenEntry = useCallback((entry, cardName) => {
    navigate('/journal', {
      state: {
        prefillQuery: cardName,
        highlightEntryId: entry?.id,
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-main text-main animate-fade-in">
      {/* Sticky navigation header with safe-area padding */}
      <header 
        className="sticky top-0 z-40 bg-main/95 backdrop-blur-sm border-b border-secondary/20"
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), 0.75rem)',
          paddingLeft: 'env(safe-area-inset-left, 1rem)',
          paddingRight: 'env(safe-area-inset-right, 1rem)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <GlobalNav withUserChip />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/journal')}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-3 py-2 text-accent hover:text-main hover:bg-surface-muted/30 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50 mb-4"
          >
            <CaretLeft className="w-5 h-5" />
            <span>Back to Journal</span>
          </button>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-serif text-accent mb-2">Card Collection</h1>
              <p className="text-muted text-sm">
                Discover the full deck through your readings.
              </p>
              {!isAuthenticated && (
                <p className="mt-2 text-xs text-amber-100/60">
                  You&apos;re viewing a local collection. Sign in to sync your journal across devices.
                </p>
              )}
            </div>

            {/* Progress Bar */}
            <div className="w-full md:w-64">
              <div className="flex justify-between text-xs text-muted mb-1.5 uppercase tracking-wider font-medium">
                <span>Progress</span>
                <span>{totalFound} / {deckSize}</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-1000 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="sticky top-4 z-20 mb-6 p-1 rounded-xl bg-black/40 backdrop-blur-md border border-white/5 flex flex-wrap gap-2 items-center">
          {/* Suit Filter */}
          <div className="relative group">
            <label htmlFor="suit-filter" className="sr-only">Filter by suit</label>
            <select
              id="suit-filter"
              aria-label="Filter by suit"
              value={filterSuit}
              onChange={(e) => setFilterSuit(e.target.value)}
              className="appearance-none min-h-[44px] bg-white/5 border border-white/10 rounded-lg pl-3 pr-8 py-2 text-sm text-main focus:ring-1 focus:ring-accent/50 outline-none cursor-pointer hover:bg-white/10 touch-manipulation"
            >
              <option value="all">All Suits</option>
              <option value="major">Major Arcana</option>
              <option value="wands">Wands</option>
              <option value="cups">Cups</option>
              <option value="swords">Swords</option>
              <option value="pentacles">Pentacles</option>
            </select>
            <Funnel className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div
            className="flex bg-white/5 rounded-lg p-1 border border-white/10"
            role="group"
            aria-label="Filter by card status"
          >
            <button
              onClick={() => setFilterStatus('all')}
              aria-pressed={filterStatus === 'all'}
              className={`min-h-[44px] px-4 py-2 text-xs font-medium rounded-md transition-all touch-manipulation ${filterStatus === 'all' ? 'bg-accent/20 text-accent' : 'text-muted hover:text-main'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('found')}
              aria-pressed={filterStatus === 'found'}
              className={`min-h-[44px] px-4 py-2 text-xs font-medium rounded-md transition-all touch-manipulation ${filterStatus === 'found' ? 'bg-accent/20 text-accent' : 'text-muted hover:text-main'}`}
            >
              Found
            </button>
            <button
              onClick={() => setFilterStatus('missing')}
              aria-pressed={filterStatus === 'missing'}
              className={`min-h-[44px] px-4 py-2 text-xs font-medium rounded-md transition-all touch-manipulation ${filterStatus === 'missing' ? 'bg-accent/20 text-accent' : 'text-muted hover:text-main'}`}
            >
              Missing
            </button>
          </div>

          <div className="flex-1" />

          {/* Sort */}
          <div className="relative">
            <label htmlFor="sort-by" className="sr-only">Sort cards by</label>
            <select
              id="sort-by"
              aria-label="Sort cards by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none min-h-[44px] bg-white/5 border border-white/10 rounded-lg pl-3 pr-8 py-2 text-sm text-main focus:ring-1 focus:ring-accent/50 outline-none cursor-pointer hover:bg-white/10 touch-manipulation"
            >
              <option value="deck">Deck Order</option>
              <option value="count_desc">Most Frequent</option>
              <option value="count_asc">Rarely Drawn</option>
              <option value="recency">Recently Seen</option>
            </select>
            <SortAscending className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          </div>
        </div>

        {/* Grid */}
        {analyticsDisabled ? (
          <div className="rounded-2xl border border-amber-300/15 bg-amber-200/5 p-6 text-center">
            <h2 className="text-lg font-serif text-amber-50 mb-2">Collection tracking is disabled</h2>
            <p className="text-sm text-amber-100/70 mb-4">
              Enable Journey analytics in your account settings to track your card collection.
            </p>
            <button
              type="button"
              onClick={() => navigate('/account#analytics')}
              className="px-4 py-2 rounded-full border border-amber-200/25 text-amber-50 hover:bg-amber-200/10"
            >
              Go to Settings
            </button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => {
              const skeletonVariants = prefersReducedMotion ? {
                initial: { opacity: 0 },
                animate: { opacity: 1 }
              } : {
                initial: { opacity: 0, scale: 0.9 },
                animate: { opacity: 1, scale: 1 }
              };

              return (
                <motion.div
                  key={i}
                  className="aspect-[2/3] rounded-xl bg-white/5 animate-pulse"
                  variants={skeletonVariants}
                  initial="initial"
                  animate="animate"
                  transition={{
                    duration: prefersReducedMotion ? 0.15 : 0.3,
                    delay: prefersReducedMotion ? 0 : i * 0.05,
                    ease: [0.4, 0, 0.2, 1]
                  }}
                />
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
            {filteredCards.map((card, index) => (
              <CardItem
                key={card.name}
                card={card}
                stats={stats[card.name]}
                onSelect={handleSelectCard}
                onViewInJournal={(selectedCard) => handleViewAllInJournal(selectedCard?.name)}
                index={index}
              />
            ))}
          </div>
        )}

        {!loading && filteredCards.length === 0 && (
          <div className="text-center py-20 text-muted">
            <p>No cards match your filters.</p>
            <button
              onClick={() => { setFilterSuit('all'); setFilterStatus('all'); }}
              className="mt-4 text-accent hover:underline text-sm"
            >
              Clear filters
            </button>
          </div>
        )}
      </main>

      <AnimatePresence>
        {selected?.card && (
          <CardModal
            card={selected.card}
            position="In your collection"
            stats={selected.stats}
            relatedEntries={selected.relatedEntries}
            isOpen={!!selected}
            onClose={() => setSelected(null)}
            layoutId={`gallery-${(selected.card?.name || 'card').toLowerCase().replace(/\s+/g, '-')}`}
            onViewAllInJournal={() => handleViewAllInJournal(selected.card?.name)}
            onOpenEntry={(entry) => handleOpenEntry(entry, selected.card?.name)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
