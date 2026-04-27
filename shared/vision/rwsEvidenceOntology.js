import { MAJOR_ARCANA } from '../../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../../src/data/minorArcana.js';
import { SYMBOL_ANNOTATIONS } from '../symbols/symbolAnnotations.js';
import { canonicalizeCardName } from './cardNameMapping.js';

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

export function normalizeRwsSymbolName(value) {
  return slug(value);
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

function buildCardEvidence(card) {
  const annotation = SYMBOL_ANNOTATIONS[card.number] || null;
  const visualSymbols = (annotation?.symbols || []).map((symbol) => ({
    symbol: normalizeRwsSymbolName(symbol.object),
    label: symbol.object,
    location: symbol.position || null,
    color: symbol.color || null,
    literalObservation: literalObservation(symbol),
    symbolicMeaning: splitMeaning(symbol.meaning)
  }));

  return {
    stableId: getStableId(card),
    deck: 'Rider-Waite-Smith',
    card: card.name,
    arcana: typeof card.number === 'number' && card.number <= 21 ? 'Major' : 'Minor',
    number: typeof card.number === 'number' ? card.number : null,
    suit: card.suit || null,
    rank: card.rank || null,
    visualSymbols,
    dominantColors: annotation?.dominantColors || [],
    composition: annotation?.composition || null,
    archetype: annotation?.archetype || null,
    coreThemes: CORE_THEME_OVERRIDES[card.name] || splitMeaning(card.upright || card.meaning || ''),
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

export function getRwsEvidenceByStableId(stableId) {
  return STABLE_ID_EVIDENCE.get(stableId) || null;
}

export function getRwsSymbolEvidence(cardName, symbolName) {
  const card = getRwsCardEvidence(cardName);
  const normalized = normalizeRwsSymbolName(symbolName);
  return card?.visualSymbols.find((symbol) => symbol.symbol === normalized) || null;
}
