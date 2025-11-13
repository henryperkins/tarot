/**
 * Timing Meta (Soft Trajectory Heuristics)
 *
 * Provides non-deterministic timing hints derived from traditional suit/rank associations.
 * Used to gently describe pacing/arc (shorter-term vs longer arc), never fixed dates.
 *
 * Design:
 * - Wands: fast, initiating, catalytic
 * - Swords: quick but volatile; mental pivots
 * - Cups: emotional/relational tempo; moderate
 * - Pentacles: slow, steady, infrastructural
 *
 * - Early pip ranks (Aces–4): near-term shifts; opening moves
 * - Mid ranks (5–9): developing processes
 * - Tens + some Majors: longer arcs / completion cycles
 *
 * Majors:
 * - Many function as multi-chapter arcs. We bias them toward "developing" or "longer arc",
 *   but keep language soft and contextual.
 */

const FAST_SUITS = new Set(['Wands', 'Swords']);
const SLOW_SUITS = new Set(['Pentacles']);
const MID_SUITS = new Set(['Cups']);

function getSuitSpeedWeight(suit) {
  if (FAST_SUITS.has(suit)) return 1;          // leans sooner
  if (MID_SUITS.has(suit)) return 0;          // neutral
  if (SLOW_SUITS.has(suit)) return -1;        // leans longer
  return 0;
}

function getRankTempoWeight(rankValue) {
  if (typeof rankValue !== 'number') return 0;
  if (rankValue >= 1 && rankValue <= 4) return 1;   // earlier phase
  if (rankValue >= 5 && rankValue <= 9) return 0;   // mid-phase
  if (rankValue >= 10) return -1;              // culmination / slower arc
  return 0;
}

function getMajorTimingWeight(number) {
  if (typeof number !== 'number') return 0;
  // Light-touch heuristic: early majors slightly "sooner", late majors "longer arc"
  if (number >= 0 && number <= 6) return 0;     // The Fool–Lovers: can break quickly, but still arcs
  if (number >= 7 && number <= 14) return -0.5;  // Chariot–Temperance: process journeys
  if (number >= 15) return -1;                  // Devil–World: extended structural cycles
  return 0;
}

/**
 * getTimingHintForCard(card)
 *
 * Returns one of:
 * - 'sooner'       → feels nearer-term / quicker to move
 * - 'developing'   → unfolding across a chapter; medium arc
 * - 'longer-arc'   → slow-burn, structural or long-integration theme
 * - null           → no clear signal
 *
 * Always for internal meta; narrative must phrase these as non-guaranteed trajectories.
 */
export function getTimingHintForCard(card = {}) {
  if (!card) return null;

  // Major Arcana
  if (typeof card.number === 'number' && card.number >= 0 && card.number <= 21) {
    const w = getMajorTimingWeight(card.number);
    if (w <= -1) return 'longer-arc';
    if (w < 0) return 'developing';
    return 'developing';
  }

  // Minors and other cards
  const suit = card.suit || inferSuitFromName(card.card);
  const suitWeight = getSuitSpeedWeight(suit);
  const rankWeight = getRankTempoWeight(card.rankValue);

  const total = suitWeight + rankWeight;

  if (total >= 2) return 'sooner';
  if (total >= 1) return 'sooner';
  if (total <= -2) return 'longer-arc';
  if (total <= -1) return 'longer-arc';

  // Neutral / ambiguous => treat as "developing" only if we have any structure
  if (suit || typeof card.rankValue === 'number') return 'developing';

  return null;
}

/**
 * getSpreadTimingProfile({ cardsInfo, themes })
 *
 * Aggregates card-level hints with soft logic:
 * - Focus on future / outcome positions when present.
 * - If clear bias emerges, return a profile string:
 *   - 'near-term-tilt'
 *   - 'developing-arc'
 *   - 'longer-arc-tilt'
 * Otherwise null.
 */
export function getSpreadTimingProfile({ cardsInfo = [], themes = {} } = {}) {
  if (!Array.isArray(cardsInfo) || cardsInfo.length === 0) return null;

  // Prefer labeled positions commonly used as trajectory indicators
  const namedFuturePositions = new Set([
    'Future — trajectory if nothing shifts',
    'Near Future — what lies before (Card 4)',
    'Likely direction on current path',
    'Outcome — likely path if unchanged (Card 10)',
    'Outcome / what this can become'
  ]);

  const focusCards = cardsInfo.filter(c => {
    const pos = (c.position || '').trim();
    return namedFuturePositions.has(pos);
  });

  const sample = focusCards.length > 0 ? focusCards : cardsInfo;

  let sooner = 0;
  let developing = 0;
  let longer = 0;

  for (const card of sample) {
    const hint = getTimingHintForCard(card);
    if (hint === 'sooner') sooner++;
    else if (hint === 'developing') developing++;
    else if (hint === 'longer-arc') longer++;
  }

  const total = sooner + developing + longer;
  if (!total) return null;

  // Soft thresholds; we only speak when there's a clear lean
  if (sooner / total >= 0.55 && sooner >= 2) {
    return 'near-term-tilt';
  }
  if (longer / total >= 0.55 && longer >= 2) {
    return 'longer-arc-tilt';
  }

  // Default: treat as chapter-based unfolding
  return 'developing-arc';
}

function inferSuitFromName(name) {
  if (typeof name !== 'string') return null;
  if (name.includes('Wands')) return 'Wands';
  if (name.includes('Cups')) return 'Cups';
  if (name.includes('Swords')) return 'Swords';
  if (name.includes('Pentacles')) return 'Pentacles';
  return null;
}