import { MAJOR_ARCANA } from '../data/majorArcana';
import { SPREADS } from '../data/spreads';

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
    if (lastNum > firstNum + 5) {
      relationships.push({
        type: 'arc',
        text: 'Your spread shows significant growth from early stages to mastery or completion.'
      });
    }
  }

  return relationships;
}

export function drawSpread({ spreadKey, useSeed, seed }) {
  const spread = SPREADS[spreadKey];
  if (!spread) throw new Error(`Unknown spread: ${spreadKey}`);

  const pool = useSeed ? seededShuffle(MAJOR_ARCANA, seed) : cryptoShuffle(MAJOR_ARCANA);
  const count = spread.count;

  const orientationRand = useSeed ? xorshift32((seed ^ 0xa5a5a5a5) >>> 0) : null;

  return pool.slice(0, count).map(card => ({
    ...card,
    isReversed: useSeed ? orientationRand() > 0.5 : Math.random() > 0.5
  }));
}