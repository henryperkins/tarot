import React, { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

export default function Journal() {
  const [entries, setEntries] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const storedTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('tarot-theme') : null;
    const activeTheme = storedTheme === 'light' ? 'light' : 'dark';
    const root = typeof document !== 'undefined' ? document.documentElement : null;
    if (root) {
      root.classList.toggle('light', activeTheme === 'light');
    }
  }, []);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      const key = 'tarot_journal';
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setEntries(parsed);
          }
        } catch (error) {
          console.error('Failed to load journal', error);
        }
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-amber-50">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => navigate('/')}
          className="mb-6 flex items-center text-amber-200 hover:text-amber-100"
        >
          <ChevronLeft className="w-5 h-5 mr-2" />
          Back to Reading
        </button>
        <h1 className="text-3xl font-serif text-amber-200 mb-8">Your Tarot Journal</h1>
        {entries.length === 0 ? (
          <p className="text-amber-100/80">No entries yet. Save a reading to start your journal.</p>
        ) : (
          <div className="space-y-8">
            {entries.map((entry, index) => {
              const insights = buildThemeInsights(entry);
              return (
                <div key={index} className="bg-slate-900/80 p-6 rounded-xl border border-emerald-400/40">
                  <h2 className="text-xl font-serif text-amber-200 mb-2">{entry.spread}</h2>
                  <p className="text-sm text-amber-100/70 mb-4">{new Date(entry.ts).toLocaleString()}</p>
                  {entry.question && <p className="italic text-amber-100/80 mb-4">Question: {entry.question}</p>}
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-amber-200 mb-2">Cards</h3>
                    <ul className="list-disc pl-5 space-y-1 text-amber-100/80">
                      {entry.cards.map((card, idx) => (
                        <li key={idx}>{card.position}: {card.name} ({card.orientation})</li>
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
                    <div>
                      <h3 className="text-sm font-semibold text-amber-200 mb-2">Narrative</h3>
                      <p className="text-amber-100/80 whitespace-pre-wrap">{entry.personalReading}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
