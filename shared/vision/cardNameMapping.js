import { MAJOR_ARCANA } from '../../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../../src/data/minorArcana.js';
import { getDeckAlias } from './deckAssets.js';

const aliasCache = new Map();

function normalizeKey(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function registerName(map, name, canonical) {
  const key = normalizeKey(name);
  if (!key || map.has(key)) {
    return;
  }
  map.set(key, canonical);
}

function registerAliasVariants(map, alias, canonical) {
  if (!alias) return;
  registerName(map, alias, canonical);

  if (alias.includes('(') && alias.includes(')')) {
    const before = alias.split('(')[0];
    registerName(map, before, canonical);
    const inside = alias.slice(alias.indexOf('(') + 1, alias.indexOf(')'));
    registerName(map, inside, canonical);
  }
}

function buildAliasMap(deckStyle = 'rws-1909') {
  const map = new Map();
  const cards = [...MAJOR_ARCANA, ...MINOR_ARCANA];

  // FIRST PASS: Register deck-specific aliases (Thoth, Marseille) → RWS canonical names
  // This must happen BEFORE registering RWS self-references to avoid collision
  // e.g., Thoth "Knight of Cups" → RWS "King of Cups" must be registered
  // before RWS "Knight of Cups" → "Knight of Cups"
  if (deckStyle !== 'rws-1909') {
    cards.forEach((card) => {
      if (!card?.name) return;
      const alias = getDeckAlias(card, deckStyle);
      if (alias && alias !== card.name) {
        registerAliasVariants(map, alias, card.name);
      }
    });
  }

  // SECOND PASS: Register RWS canonical names → themselves
  // This allows RWS names to work as-is, while deck aliases take priority
  cards.forEach((card) => {
    if (!card?.name) return;
    registerName(map, card.name, card.name);
  });

  return map;
}

export function canonicalizeCardName(name, deckStyle = 'rws-1909') {
  const key = normalizeKey(name);
  if (!key) return null;
  if (!aliasCache.has(deckStyle)) {
    aliasCache.set(deckStyle, buildAliasMap(deckStyle));
  }
  const lookup = aliasCache.get(deckStyle);
  return lookup.get(key) || (typeof name === 'string' ? name.trim() : null);
}

export function canonicalCardKey(name, deckStyle = 'rws-1909') {
  const canonical = canonicalizeCardName(name, deckStyle);
  return canonical ? canonical.toLowerCase() : null;
}
