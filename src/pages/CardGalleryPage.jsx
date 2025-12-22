import { useState, useEffect, useMemo } from 'react';
import { CaretLeft, Funnel, SortAscending, LockKey } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { GlobalNav } from '../components/GlobalNav';
import { MAJOR_ARCANA } from '../data/majorArcana';
import { MINOR_ARCANA } from '../data/minorArcana';
import { useAuth } from '../contexts/AuthContext';

const ALL_CARDS = [...MAJOR_ARCANA, ...MINOR_ARCANA];

function CardItem({ card, stats }) {
  const isFound = !!stats;
  const count = stats?.total_count || 0;
  
  // Format last seen date
  const lastSeenLabel = stats?.last_seen 
    ? new Date(stats.last_seen * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  return (
    <div className={`group relative aspect-[2/3] rounded-xl border transition-all duration-300 overflow-hidden
      ${isFound 
        ? 'border-amber-300/20 bg-gradient-to-b from-[#120f1f] via-[#0c0a14] to-[#0a0911] shadow-lg hover:-translate-y-1 hover:border-amber-300/40 hover:shadow-amber-300/10' 
        : 'border-white/5 bg-white/[0.02] opacity-60 grayscale hover:opacity-80'
      }`}
    >
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
              {count}×
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
    </div>
  );
}

export default function CardGalleryPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filterSuit, setFilterSuit] = useState('all'); // all, major, wands, cups, swords, pentacles
  const [filterStatus, setFilterStatus] = useState('all'); // all, found, missing
  const [sortBy, setSortBy] = useState('deck'); // deck, count_desc, count_asc, recency

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    async function fetchStats() {
      try {
        const res = await fetch('/api/archetype-journey/card-frequency');
        if (res.ok) {
          const data = await res.json();
          // Convert array to map for O(1) lookup
          const map = {};
          data.cards.forEach(c => {
            map[c.card_name] = c;
          });
          setStats(map);
        }
      } catch (err) {
        console.error('Failed to load card stats', err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [isAuthenticated]);

  // Derived state
  const totalFound = Object.keys(stats).length;
  const progressPercent = Math.round((totalFound / 78) * 100);

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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-main text-main p-8 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-serif text-accent mb-2">Sign in required</h2>
          <p className="text-muted mb-4">Please sign in to view your card collection.</p>
          <button 
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-full border border-accent/30 text-accent hover:bg-accent/10"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-main text-main animate-fade-in">
      <GlobalNav />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <button 
            onClick={() => navigate('/journal')}
            className="flex items-center text-sm text-accent hover:text-main mb-4 transition-colors"
          >
            <CaretLeft className="w-4 h-4 mr-1" />
            Back to Journal
          </button>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-serif text-accent mb-2">Card Collection</h1>
              <p className="text-muted text-sm">
                Discover the full deck through your readings.
              </p>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full md:w-64">
              <div className="flex justify-between text-xs text-muted mb-1.5 uppercase tracking-wider font-medium">
                <span>Progress</span>
                <span>{totalFound} / 78</span>
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
            <select
              value={filterSuit}
              onChange={(e) => setFilterSuit(e.target.value)}
              className="appearance-none bg-white/5 border border-white/10 rounded-lg pl-3 pr-8 py-2 text-sm text-main focus:ring-1 focus:ring-accent/50 outline-none cursor-pointer hover:bg-white/10"
            >
              <option value="all">All Suits</option>
              <option value="major">Major Arcana</option>
              <option value="wands">Wands</option>
              <option value="cups">Cups</option>
              <option value="swords">Swords</option>
              <option value="pentacles">Pentacles</option>
            </select>
            <Funnel className="absolute right-2.5 top-2.5 w-4 h-4 text-muted pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${filterStatus === 'all' ? 'bg-accent/20 text-accent' : 'text-muted hover:text-main'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('found')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${filterStatus === 'found' ? 'bg-accent/20 text-accent' : 'text-muted hover:text-main'}`}
            >
              Found
            </button>
            <button
              onClick={() => setFilterStatus('missing')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${filterStatus === 'missing' ? 'bg-accent/20 text-accent' : 'text-muted hover:text-main'}`}
            >
              Missing
            </button>
          </div>

          <div className="flex-1" />

          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none bg-white/5 border border-white/10 rounded-lg pl-3 pr-8 py-2 text-sm text-main focus:ring-1 focus:ring-accent/50 outline-none cursor-pointer hover:bg-white/10"
            >
              <option value="deck">Deck Order</option>
              <option value="count_desc">Most Frequent</option>
              <option value="count_asc">Rarely Drawn</option>
              <option value="recency">Recently Seen</option>
            </select>
            <SortAscending className="absolute right-2.5 top-2.5 w-4 h-4 text-muted pointer-events-none" />
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
            {filteredCards.map(card => (
              <CardItem 
                key={card.name} 
                card={card} 
                stats={stats[card.name]} 
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
    </div>
  );
}
