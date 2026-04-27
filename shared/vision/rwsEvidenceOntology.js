import { MAJOR_ARCANA } from '../../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../../src/data/minorArcana.js';
import { SYMBOL_COORDINATES } from '../../src/data/symbolCoordinates.js';
import { SYMBOL_ANNOTATIONS } from '../symbols/symbolAnnotations.js';
import { canonicalizeCardName } from './cardNameMapping.js';
import { getMinorSymbolAnnotation } from './minorSymbolLexicon.js';
import { getRwsHardNegatives as resolveRwsHardNegatives } from './rwsHardNegatives.js';

const DEFAULT_AVOID_CLAIMS = Object.freeze([
  'Do not say a specific future event will happen.',
  'Do not frame the reading as certainty.',
  'Do not provide medical, legal, financial, pregnancy, or crisis directives.'
]);

const CORE_THEME_OVERRIDES = Object.freeze({
  'The Fool': ['beginnings', 'trust', 'risk', 'freedom', 'naivety'],
  'The Magician': ['focused will', 'available tools', 'manifestation', 'skill'],
  'Two of Swords': ['choice', 'guarded thought', 'limited information', 'stalemate']
});

const SYMBOL_MEANING_ALIASES = Object.freeze({
  'eternal potential, as above so below': ['eternal potential', 'alignment', 'as above so below'],
  'risk, the unknown, leap of faith': ['threshold', 'risk', 'unknown outcome'],
  'purity, innocence': ['innocence', 'purity of intention', 'openness'],
  'loyalty, instinct, warning': ['instinct', 'companionship', 'warning', 'enthusiasm']
});

const SYMBOL_SALIENCE_OVERRIDES = Object.freeze({
  'The Fool': {
    cliff: 0.95,
    dog: 0.85,
    white_rose: 0.7,
    sun: 0.65,
    bundle: 0.55,
    feather: 0.35
  },
  'The Magician': {
    wand: 0.9,
    infinity_symbol: 0.85,
    cup: 0.75,
    sword: 0.75,
    pentacle: 0.75
  },
  'The High Priestess': {
    pillars: 0.9,
    scroll: 0.8,
    veil: 0.75,
    crescent_moon: 0.75,
    lunar_crown: 0.7
  }
});

const MANUAL_SYMBOL_ALIASES = Object.freeze({
  cliff: ['precipice', 'cliff edge'],
  dog: ['small dog', 'canine companion'],
  bundle: ['travel bundle', 'knapsack'],
  white_rose: ['rose', 'white flower'],
  crescent_moon: ['moon', 'lunar crescent'],
  lunar_crown: ['moon crown', 'triple crown'],
  infinity_symbol: ['lemniscate', 'infinity'],
  two_razor_sharp_swords: ['two swords', 'crossed swords']
});

const COMMON_ABSENT_SYMBOLS = Object.freeze({
  'The Fool': ['scales', 'throne', 'crossed keys', 'tomb'],
  'The High Priestess': ['sword', 'scales', 'raised hand', 'two acolytes'],
  'The Sun': ['lion', 'cliff edge', 'small dog', 'white rose'],
  'Two of Swords': ['bound figure', 'eight swords', 'tomb', 'recumbent figure'],
  'Queen of Cups': ['pillars', 'scroll', 'fish in cup', 'standing figure']
});

const SUIT_OFFSETS = Object.freeze({
  Wands: 22,
  Cups: 36,
  Swords: 50,
  Pentacles: 64
});

const ALL_CARDS = [...MAJOR_ARCANA, ...MINOR_ARCANA];

function slug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getStableId(card) {
  if (typeof card?.number === 'number' && card.number >= 0 && card.number <= 21) {
    return `major_${String(card.number).padStart(2, '0')}_${slug(card.name)}`;
  }
  const suit = slug(card?.suit || 'minor');
  const rank = typeof card?.rankValue === 'number'
    ? String(card.rankValue).padStart(2, '0')
    : slug(card?.rank || card?.name);
  return `${suit}_${rank}`;
}

function getAnnotationIndex(card) {
  if (typeof card?.number === 'number') {
    return card.number;
  }

  const suitOffset = SUIT_OFFSETS[card?.suit];
  if (typeof suitOffset !== 'number' || typeof card?.rankValue !== 'number') {
    return null;
  }

  return suitOffset + card.rankValue - 1;
}

function getAnnotation(card) {
  if (typeof card?.number === 'number') {
    return SYMBOL_ANNOTATIONS[card.number] || null;
  }

  if (card?.suit && card?.rank) {
    return getMinorSymbolAnnotation(card);
  }

  return null;
}

export function normalizeRwsSymbolName(value) {
  return slug(value);
}

export function symbolId(cardName, symbolName) {
  return `rws.${slug(cardName)}.${normalizeRwsSymbolName(symbolName)}`;
}

function splitMeaning(meaning) {
  const explicit = SYMBOL_MEANING_ALIASES[meaning];
  if (explicit) return explicit;
  return String(meaning || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function literalObservation(symbol) {
  const object = String(symbol?.object || '').trim();
  const position = String(symbol?.position || '').trim();
  if (position) return `The ${object} appears at ${position}.`;
  return `The ${object} is visible on the card.`;
}

function getSymbolSalience(cardName, normalizedSymbol) {
  return SYMBOL_SALIENCE_OVERRIDES[cardName]?.[normalizedSymbol] ?? 0.6;
}

function removeColorAdjective(label, color) {
  if (!label || !color) return null;
  const colorTokens = String(color)
    .toLowerCase()
    .split(/\s+|and|&|-/g)
    .map((token) => token.trim())
    .filter(Boolean);
  let normalized = String(label).toLowerCase();
  colorTokens.forEach((token) => {
    normalized = normalized.replace(new RegExp(`\\b${token}\\b`, 'g'), ' ');
  });
  return normalized.replace(/\s+/g, ' ').trim() || null;
}

function buildAliases(symbol) {
  const label = String(symbol?.object || '').trim().toLowerCase();
  const normalized = normalizeRwsSymbolName(label);
  const withoutColor = removeColorAdjective(label, symbol?.color);
  return Array.from(new Set([
    label,
    normalized,
    withoutColor,
    withoutColor ? normalizeRwsSymbolName(withoutColor) : null,
    ...(MANUAL_SYMBOL_ALIASES[normalized] || [])
  ].filter(Boolean)));
}

function normalizeCoordinateShape(coord) {
  if (!coord || typeof coord !== 'object') return null;
  const round = (value) => Number(Number(value).toFixed(3));
  if (coord.shape === 'rect') {
    return {
      shape: 'rect',
      x: round((coord.x ?? 0) / 820),
      y: round((coord.y ?? 0) / 1430),
      width: round((coord.width ?? 0) / 820),
      height: round((coord.height ?? 0) / 1430)
    };
  }
  if (coord.shape === 'circle') {
    return {
      shape: 'circle',
      cx: round((coord.cx ?? 0) / 820),
      cy: round((coord.cy ?? 0) / 1430),
      r: round((coord.r ?? 0) / Math.min(820, 1430))
    };
  }
  if (coord.shape === 'polygon' && typeof coord.points === 'string') {
    const points = coord.points
      .split(/\s+/g)
      .map((point) => point.split(',').map(Number))
      .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
      .map(([x, y]) => [round(x / 820), round(y / 1430)]);
    return points.length ? { shape: 'polygon', points } : null;
  }
  return null;
}

function getExpectedRegion(card, symbol) {
  const coordinateGroup = typeof card?.number === 'number' ? SYMBOL_COORDINATES[card.number] : null;
  const normalized = normalizeRwsSymbolName(symbol?.object);
  const coord = coordinateGroup?.symbols?.find((entry) => normalizeRwsSymbolName(entry?.symbol?.object) === normalized);
  return normalizeCoordinateShape(coord);
}

function buildAbsenceNegatives(cardName, hardNegatives) {
  return Array.from(new Set([
    ...(COMMON_ABSENT_SYMBOLS[cardName] || []),
    ...hardNegatives.flatMap((entry) => entry.distinguishingFeatures || [])
  ].map((entry) => String(entry || '').trim()).filter(Boolean)));
}

function buildCardEvidence(card) {
  const annotationIndex = getAnnotationIndex(card);
  const annotation = getAnnotation(card);
  const hardNegatives = resolveRwsHardNegatives(card.name);
  const absenceNegatives = buildAbsenceNegatives(card.name, hardNegatives);
  const visualSymbols = (annotation?.symbols || []).map((symbol) => ({
    symbol: normalizeRwsSymbolName(symbol.object),
    symbolId: symbolId(card.name, symbol.object),
    label: symbol.object,
    location: symbol.position || null,
    color: symbol.color || null,
    salience: getSymbolSalience(card.name, normalizeRwsSymbolName(symbol.object)),
    expectedRegion: getExpectedRegion(card, symbol),
    aliases: buildAliases(symbol),
    literalObservation: literalObservation(symbol),
    symbolicMeaning: splitMeaning(symbol.meaning),
    absenceNegatives
  }));

  return {
    stableId: getStableId(card),
    deck: 'Rider-Waite-Smith',
    card: card.name,
    arcana: typeof card.number === 'number' && card.number <= 21 ? 'Major' : 'Minor',
    number: typeof card.number === 'number' ? card.number : null,
    annotationIndex,
    suit: card.suit || null,
    rank: card.rank || null,
    visualSymbols,
    dominantColors: annotation?.dominantColors || [],
    composition: annotation?.composition || null,
    archetype: annotation?.archetype || null,
    coreThemes: CORE_THEME_OVERRIDES[card.name] || splitMeaning(card.upright || card.meaning || ''),
    hardNegatives,
    absenceNegatives,
    avoidClaims: DEFAULT_AVOID_CLAIMS
  };
}

const CARD_EVIDENCE = new Map();
const STABLE_ID_EVIDENCE = new Map();

ALL_CARDS.forEach((card) => {
  if (!card?.name) return;
  const evidence = buildCardEvidence(card);
  CARD_EVIDENCE.set(card.name.toLowerCase(), evidence);
  STABLE_ID_EVIDENCE.set(evidence.stableId, evidence);
});

export function getRwsCardEvidence(cardName) {
  const canonical = canonicalizeCardName(cardName, 'rws-1909') || cardName;
  return CARD_EVIDENCE.get(String(canonical || '').toLowerCase()) || null;
}

export function getRwsHardNegatives(cardName) {
  return resolveRwsHardNegatives(cardName);
}

export function getRwsEvidenceByStableId(stableId) {
  return STABLE_ID_EVIDENCE.get(stableId) || null;
}

export function getRwsSymbolEvidence(cardName, symbolName) {
  const card = getRwsCardEvidence(cardName);
  const normalized = normalizeRwsSymbolName(symbolName);
  return card?.visualSymbols.find((symbol) => (
    symbol.symbol === normalized
    || symbol.aliases?.some((alias) => normalizeRwsSymbolName(alias) === normalized)
  )) || null;
}
