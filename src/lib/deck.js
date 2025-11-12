import { MAJOR_ARCANA } from '../data/majorArcana';
import { SPREADS } from '../data/spreads';
import { MINOR_ARCANA } from '../data/minorArcana';

export function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function xorshift32(seed) {
  let x = seed >>> 0 || 0x9e3779b9;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0x100000000;
  };
}

export function seededShuffle(arr, seed) {
  const copy = arr.slice();
  const rand = xorshift32(seed >>> 0);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function cryptoShuffle(arr) {
  const copy = arr.slice();
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const cryptoObj = window.crypto;
    for (let i = copy.length - 1; i > 0; i--) {
      const r = cryptoObj.getRandomValues(new Uint32Array(1))[0];
      const j = r % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
  } else {
    for (let i = copy.length - 1; i > 0; i--) {
      const r = Math.floor(Math.random() * 2 ** 32);
      const j = r % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
  }
  return copy;
}

export function computeSeed({ cutIndex, knockTimes, userQuestion }) {
  const intervals = (knockTimes || [])
    .slice(-3)
    .map((t, i, arr) => (i ? t - arr[i - 1] : 0))
    .reduce((sum, value) => sum + value, 0);

  const qHash = hashString(userQuestion || '');
  let seed = (qHash ^ (cutIndex * 2654435761) ^ Math.floor(intervals)) >>> 0;
  if (seed === 0) seed = 0x9e3779b9;
  return seed >>> 0;
}

// Active deck pool based on toggle (with safety fallback)
export function getDeckPool(includeMinors = false) {
  try {
    if (includeMinors) {
      // Basic dataset integrity guard; if missing, fall back to majors
      if (!Array.isArray(MINOR_ARCANA) || MINOR_ARCANA.length !== 56) {
        console.warn('Minor Arcana dataset incomplete; falling back to majors-only.');
        return MAJOR_ARCANA;
      }
      return [...MAJOR_ARCANA, ...MINOR_ARCANA];
    }
    return MAJOR_ARCANA;
  } catch (err) {
    console.error('getDeckPool failed:', err);
    return MAJOR_ARCANA;
  }
}

export function computeRelationships(cards) {
  if (!cards || cards.length === 0) return [];

  const relationships = [];
  const numbers = cards.map(card => card.number);

  if (numbers.length > 1) {
    const hasSequence = numbers.some(
      (number, index) => index > 0 && Math.abs(number - numbers[index - 1]) === 1
    );
    if (hasSequence) {
      relationships.push({
        type: 'sequence',
        text: 'Sequential cards suggest a natural progression or journey through connected themes.'
      });
    }
  }

  const pairings = [
    {
      cards: ['The Fool', 'The Magician'],
      desc: 'New beginnings (Fool) empowered by manifesting ability (Magician).'
    },
    {
      cards: ['Death', 'The Star'],
      desc: 'Transformation (Death) leading to hope and renewal (Star).'
    },
    {
      cards: ['The Tower', 'The Sun'],
      desc: 'Upheaval (Tower) clearing the path to joy and clarity (Sun).'
    },
    {
      cards: ['The Devil', 'The Lovers'],
      desc: 'Attachment patterns (Devil) affecting relationship choices (Lovers).'
    },
    {
      cards: ['The Hermit', 'The High Priestess'],
      desc: 'Deep introspection (Hermit) accessing inner wisdom (High Priestess).'
    }
  ];

  const cardNames = cards.map(card => card.name);
  pairings.forEach(pair => {
    if (pair.cards.every(name => cardNames.includes(name))) {
      relationships.push({ type: 'pairing', text: pair.desc });
    }
  });

  if (cards.length >= 3) {
    const firstNum = cards[0].number;
    const lastNum = cards[cards.length - 1].number;
    if (typeof firstNum === 'number' && typeof lastNum === 'number' && lastNum > firstNum + 5) {
      relationships.push({
        type: 'arc',
        text: 'Your spread shows significant growth from early stages to mastery or completion.'
      });
    }
  }

  // Suit-run detection for Minors (3+ consecutive ranks in one suit)
  const suitMap = new Map();
  for (const c of cards) {
    if (!c || typeof c.rankValue !== 'number' || !c.suit) continue;
    if (!suitMap.has(c.suit)) suitMap.set(c.suit, new Set());
    suitMap.get(c.suit).add(c.rankValue);
  }
  for (const [suit, ranksSet] of suitMap.entries()) {
    const ranks = Array.from(ranksSet).sort((a, b) => a - b);
    if (ranks.length < 3) continue;
    let bestLen = 1;
    let currLen = 1;
    let bestStart = ranks[0];
    let currStart = ranks[0];
    for (let i = 1; i < ranks.length; i++) {
      if (ranks[i] === ranks[i - 1] + 1) {
        currLen += 1;
      } else {
        if (currLen > bestLen) {
          bestLen = currLen;
          bestStart = currStart;
        }
        currLen = 1;
        currStart = ranks[i];
      }
    }
    if (currLen > bestLen) {
      bestLen = currLen;
      bestStart = currStart;
    }
    if (bestLen >= 3 && typeof bestStart === 'number') {
      const run = Array.from({ length: bestLen }, (_, i) => bestStart + i);
      relationships.push({
        type: 'suit-run',
        text: `Consecutive ranks in ${suit} (${run.join(', ')}) highlight a focused theme in this suit.`
      });
    }
  }

  return relationships;
}

export function drawSpread({ spreadKey, useSeed, seed, includeMinors = false }) {
  const spread = SPREADS[spreadKey];
  if (!spread) throw new Error(`Unknown spread: ${spreadKey}`);

  const poolSource = getDeckPool(includeMinors);
  const pool = useSeed ? seededShuffle(poolSource, seed) : cryptoShuffle(poolSource);
  const count = spread.count;

  const orientationRand = useSeed ? xorshift32((seed ^ 0xa5a5a5a5) >>> 0) : null;

  return pool.slice(0, count).map(card => ({
    ...card,
    isReversed: useSeed ? orientationRand() > 0.5 : Math.random() > 0.5
  }));
}