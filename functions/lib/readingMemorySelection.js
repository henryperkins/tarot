import { containsSensitiveContent, getMemoryCandidateLoadStats } from './userMemory.js';
import { sanitizeDisplayName } from './narrative/styleHelpers.js';

const selectionsByArray = new WeakMap();

const STOP_WORDS = new Set('about been from have into just right that their there they this what when which will with would year years your birthday approaching turns turn turning old aged'.split(' '));
const CATEGORIES = new Set(['theme', 'card_affinity', 'communication', 'life_context', 'general']);
const RELATIONS = 'child|kid|son|daughter|partner|spouse|husband|wife|mother|mom|mum|father|dad|parent|sister|brother|friend|grandmother|grandfather';
const ALIASES = { kid: 'child', mom: 'mother', mum: 'mother', dad: 'father' };
const MEASUREMENT_UNIT = /^\s*(?:(?:nautical|square|cubic|metric)\s+)*(?:miles?|yards?|feet|foot|inch(?:es)?|ounces?|stones?|ton(?:ne)?s?|(?:milli|centi|kilo)?met(?:er|re)s?|(?:milli|centi|kilo)?grams?|kilogrammes?|kilos?|(?:milli)?lit(?:er|re)s?|gallons?|mi|yds?|ft|[cmk]?m|kgs?|mg|g|lbs?|oz|ml|l|mph|kph)\b/i;
const COPULA_NUMBER = /\b(?:am|is|are|was|were)\s+(\d{1,3})(?!\d)|'(?:m|s|re)\s+(\d{1,3})(?!\d)/i;
const AGE_CONTINUATION = /^\s*(?:$|(?:years?\s+old|[-–]year[-–]old|y\s*\/\s*o|today|now|this\s+year)\b)/i;
// NFKC expands Unicode fractions to digits separated by the fraction slash.
const FRACTION_START = String.raw`(?:(?:(?:a|an|one|two|three|four|five|six|seven|eight|nine|\d+)(?:\s+|[-–]))?(?:half|halves|thirds?|quarters?|fourths?|fifths?|sixths?|sevenths?|eighths?|ninths?|tenths?)\b|\d+\s*[/⁄]\s*\d+\b)`;
const DETAIL_CLAUSE_SEPARATOR = new RegExp(String.raw`,(?!\d)\s*(?:and\s+)?|\s+(?:and(?!\s+${FRACTION_START})|but)\s+|\s*&\s*`, 'i');
const normalize = text => text.normalize('NFKC').replace(/[’‘]/g, "'").toLocaleLowerCase().replace(/\s+/g, ' ').trim();
const claimKey = claim => `${claim.kind}:${claim.value}:${claim.subjectKey}`;
const meaningfulTokens = text => new Set((normalize(text).match(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu) || []).filter(token => token.length >= 4 && !STOP_WORDS.has(token)));

/** Multiplicity can veto a role match without assigning any detail to a person. */
function analyzeRoleMultiplicity(text) {
  const namedRoles = new Map();
  const ambiguousRoles = new Set();
  if (typeof text !== 'string') return { namedRoles, ambiguousRoles };
  const value = text.normalize('NFKC').replace(/[’‘]/g, "'");
  const pluralForms = 'children|kids|sons|daughters|partners|spouses|husbands|wives|mothers|moms|mums|fathers|dads|parents|sisters|brothers|friends|grandmothers|grandfathers';
  const pluralAliases = { children: 'child', wives: 'wife' };
  const pattern = new RegExp(`\\bmy\\s+((?:(?:other|another|two|three|both|multiple|several|older|younger|eldest|youngest|first|second|third|[2-9])\\s+)*)(${RELATIONS}|${pluralForms})\\b(?:'s)?`, 'gi');
  for (const match of value.matchAll(pattern)) {
    const rawRole = match[2].toLowerCase();
    const singular = pluralAliases[rawRole] || (rawRole.endsWith('s') ? rawRole.slice(0, -1) : rawRole);
    const role = ALIASES[singular] || singular;
    if (match[1] || rawRole !== singular) ambiguousRoles.add(role);
    const tail = value.slice(match.index + match[0].length);
    const named = /^\s+(?:(?:named|called)\s+)?([\p{Lu}][\p{L}'-]*(?:\s+[\p{Lu}][\p{L}'-]*)*)/u.exec(tail);
    if (!named) continue;
    if (!namedRoles.has(role)) namedRoles.set(role, new Set());
    namedRoles.get(role).add(normalize(named[1]).replace(/'s$/, ''));
    if (/^\s*(?:&|,|\band\b|\bor\b)\s*(?:and\s+)?[\p{Lu}]/u.test(tail.slice(named[0].length))) ambiguousRoles.add(role);
  }
  for (const [role, names] of namedRoles) if (names.size > 1) ambiguousRoles.add(role);
  return { namedRoles, ambiguousRoles };
}

// A copula followed by a bare number can state an age without "years old".
// Keep attribution in the existing clause-local owner recognizer. Measurements,
// money and counts cannot establish an age merely by sharing that grammar.
function bareAgeDetails(fragment) {
  const details = [];
  for (const match of fragment.matchAll(new RegExp(COPULA_NUMBER, 'gi'))) {
    const numeric = match[1] || match[2];
    const index = match.index + match[0].length - numeric.length;
    const suffix = fragment.slice(index + numeric.length);
    if (MEASUREMENT_UNIT.test(suffix)) continue;
    if (/^[.,]\d|^\s*(?:[%°$€£]|cards?\b|pages?\b|degrees?\b|times?\b|dollars?\b|euros?\b|pounds?\b|cents?\b|usd\b|eur\b|gbp\b|hours?\b|minutes?\b|seconds?\b|days?\b|weeks?\b|months?\b|percent\b|per\s+(?:hour|day|week|month|year)\b|(?:an?|each)\s+(?:hour|day|week|month|year)\b)/i.test(suffix)) continue;
    // Unknown continuations cannot authorize an age. Keep them ambiguous so
    // a stored bare age cannot evade the detail guard as an ordinary note.
    details.push({ kind: 'age', value: Number(numeric), index, ambiguous: !AGE_CONTINUATION.test(suffix) });
  }
  return details;
}

function ownerFromPrefix(prefix, { displayName, source, fragment, kind }) {
  const clean = prefix.trim().replace(new RegExp(`\\bmy\\s+(${RELATIONS})\\b`, 'gi'), (_match, role) => `my ${role.toLowerCase()}`).replace(/(?:\s+(?:am|is|are|was|will|be|a|an|almost|now|soon|about|to))+\s*$/gi, '').trim();
  if (/[&+,]|\b(?:and|or|nor)\b/i.test(clean)) return null;
  if (/\b(?:their|his|her|they|he|she|our|we|children|kids|parents|friends|siblings|both|two|three|other)\b/i.test(clean)) return null;
  // Possessive age modifiers may describe a following person, not the possessor.
  // Fail closed before relation/name/self attribution. Use the original prefix
  // so explicit predicates ("Alice's a 42-year-old reader") remain supported.
  const possessiveAgeModifier = /'s\s*$/i.test(prefix)
    && /^\d{1,3}\s*(?:years?\s+old|[-–]year[-–]old|y\s*\/\s*o)\b\s+\p{L}/iu.test(fragment.slice(prefix.length));
  if (kind === 'age' && (/\bmy(?:'s)?\s*$/i.test(clean) || possessiveAgeModifier)) return null;
  const relation = new RegExp(`(?:^|\\b)my\\s+(${RELATIONS})(?:'s)?(?:\\s+([\\p{Lu}][\\p{L}'-]*(?:\\s+[\\p{Lu}][\\p{L}'-]*)*))?\\s*$`, 'u').exec(clean);
  if (relation) {
    const name = relation[2];
    if (name) return `name:${normalize(name).replace(/'s$/, '')}`;
    return `relation:${ALIASES[relation[1].toLowerCase()] || relation[1].toLowerCase()}`;
  }
  if (/\b(?:i(?:'m)?|me|my|the user|the querent)(?:'s)?\s*$/i.test(clean)) return 'self';
  // Possessive first person nested inside a relation must not become self.
  const named = /(?:^|\s)([\p{Lu}][\p{L}'-]*(?:\s+[\p{Lu}][\p{L}'-]*)*)(?:'s)?\s*$/u.exec(clean);
  if (named) {
    const name = normalize(named[1]).replace(/'s$/, '');
    if (!new Set(['turning', 'turn', 'turns', 'birthday', 'aged', 'age']).has(name)) return name === displayName ? 'self' : `name:${name}`;
  }
  if (displayName && normalize(clean).replace(/'s$/, '') === displayName) return 'self';
  if (kind === 'age' && source !== 'memory' && !clean && /^\s*turning\s+\d{1,3}\b/i.test(fragment)) return 'self';
  return null;
}

/** A conservative, clause-local recognizer, not general person recognition. */
export function extractPersonalDetailClaims(text, { displayName = '', source = 'memory' } = {}) {
  const result = { hasPersonalDetails: false, ambiguous: false, claims: [] };
  if (typeof text !== 'string' || !text.trim()) return result;
  const normalizedText = text.normalize('NFKC').replace(/[’‘]/g, "'").replace(new RegExp(`\\bmy\\s+(${RELATIONS})\\b`, 'gi'), (_match, role) => `my ${role.toLowerCase()}`);
  const safeDisplayName = normalize(sanitizeDisplayName(displayName) || '');
  const fragments = normalizedText.split(/[;!?\n]+|(?<!\d)\.|\.(?!\d)/).flatMap(clause => {
    // Keep numeric commas and mixed fractions intact before recognizing ages;
    // splitting '42,000 feet' or '42 and a half miles' would invent 'I am 42'.
    const parts = clause.split(DETAIL_CLAUSE_SEPARATOR);
    const resolved = [];
    let pending = parts.shift() || '';
    for (const part of parts) {
      // Coordinated subjects ('Alice and Bob turn 42') stay together and
      // ambiguous. Completed numeric predicates also split measurement clauses.
      if (/\bbirthday\b|\b(?:turn(?:s|ing)?|aged?)\s+\d{1,3}\b|\d{1,3}\s*(?:years?\s+old|[-–]year[-–]old|y\s*\/\s*o)\b/i.test(pending) || COPULA_NUMBER.test(pending)) {
        resolved.push(pending);
        pending = part;
      } else pending += ` and ${part}`;
    }
    return [...resolved, pending];
  });
  for (const fragment of fragments) {
    const details = bareAgeDetails(fragment);
    const agePattern = /\b(?:turn(?:s|ing)?|aged?)\s+(\d{1,3})(?!\d)(?!\s+(?:cards?|pages?|degrees?|times?)\b)|\b(\d{1,3})(?!\d)\s*(?:years?\s+old|[-–]year[-–]old|y\s*\/\s*o)\b/gi;
    for (const match of fragment.matchAll(agePattern)) details.push({ kind: 'age', value: Number(match[1] || match[2]), index: match.index });
    for (const match of fragment.matchAll(/\bbirthdays?\b/gi)) details.push({ kind: 'birthday', value: null, index: match.index });
    for (const detail of details.sort((a, b) => a.index - b.index)) {
      result.hasPersonalDetails = true;
      if (detail.ambiguous) {
        result.ambiguous = true;
        continue;
      }
      const subjectKey = ownerFromPrefix(fragment.slice(0, detail.index), { displayName: safeDisplayName, source, fragment, kind: detail.kind });
      if (!subjectKey) result.ambiguous = true;
      else result.claims.push({ kind: detail.kind, value: detail.value, subjectKey });
    }
  }
  // An unnamed role is only a role-level match. Explicitly multiple people in
  // that role cannot authorize that match, including named people elsewhere.
  const { ambiguousRoles } = analyzeRoleMultiplicity(normalizedText);
  result.claims = result.claims.filter(claim => {
    const role = claim.subjectKey.replace(/^relation:/, '');
    if (claim.subjectKey.startsWith('relation:') && ambiguousRoles.has(role)) {
      result.ambiguous = true;
      return false;
    }
    return true;
  });
  result.claims = [...new Map(result.claims.map(claim => [claimKey(claim), claim])).values()];
  return result;
}

/** Pure selection. Current fields stay separate; saved focus is never evidence. */
export function selectMemoriesForReading(candidates, { sources = [], displayName = '', limit = 3, referenceTime } = {}) {
  const input = Array.isArray(candidates) ? candidates : [];
  const loadStats = getMemoryCandidateLoadStats(input);
  const candidateCount = loadStats?.candidateCount ?? input.length;
  const exclusionReasons = loadStats?.unsafeCount ? { unsafe: loadStats.unsafeCount } : {};
  const exclude = reason => { exclusionReasons[reason] = (exclusionReasons[reason] || 0) + 1; };
  const cached = selectionsByArray.get(input);
  const now = Number.isFinite(referenceTime) ? referenceTime : cached?.referenceTime ?? Date.now();
  const stats = { candidateCount, selectedCount: 0, exclusionReasons };
  const result = { memories: [], selectedIds: [], stats, candidateCount, selectedCount: 0, exclusionReasons, referenceTime: now };
  if (!Number.isInteger(limit) || limit <= 0) {
    Object.freeze(result.memories);
    Object.freeze(result.selectedIds);
    Object.freeze(exclusionReasons);
    Object.freeze(stats);
    return Object.freeze(result);
  }
  const current = (Array.isArray(sources) ? sources : []).filter(field => field && typeof field.text === 'string' && field.kind !== 'savedFocus' && !String(field.id || '').startsWith('focus-'));
  const signature = JSON.stringify([current.map(field => [field.id, field.text]), sanitizeDisplayName(displayName), limit, now]);
  if (cached?.signature === signature) return cached.result;
  const currentTokens = meaningfulTokens(current.map(field => field.text).join(' '));
  // Analyze fields independently, then merge only role ambiguity metadata.
  // This can invalidate an unnamed role; it can never create a detail owner.
  const currentAmbiguousRoles = new Set();
  const currentRoleNames = new Map();
  for (const field of current) {
    const roles = analyzeRoleMultiplicity(field.text);
    for (const role of roles.ambiguousRoles) currentAmbiguousRoles.add(role);
    for (const [role, names] of roles.namedRoles) {
      if (!currentRoleNames.has(role)) currentRoleNames.set(role, new Set());
      for (const name of names) currentRoleNames.get(role).add(name);
      if (currentRoleNames.get(role).size > 1) currentAmbiguousRoles.add(role);
    }
  }
  const currentClaims = new Set(current.flatMap(field => extractPersonalDetailClaims(field.text, { displayName, source: field.id || 'question' }).claims)
    .filter(claim => !claim.subjectKey.startsWith('relation:') || !currentAmbiguousRoles.has(claim.subjectKey.slice('relation:'.length)))
    .map(claimKey));
  const seenIds = new Set();
  const seenText = new Set();
  const eligible = [];
  for (const row of input) {
    if (!row || Array.isArray(row) || typeof row.text !== 'string' || !row.text.trim() || (row.id !== undefined && (typeof row.id !== 'string' || !row.id)) || (row.category && !CATEGORIES.has(row.category))) { exclude('malformed'); continue; }
    if (row.scope !== undefined && row.scope !== 'global') { exclude('non_global'); continue; }
    const expiry = row.expiresAt ?? (row.expires_at == null ? null : Number(row.expires_at) * 1000);
    if (expiry != null && (!Number.isFinite(expiry) || expiry <= now)) { exclude('expired'); continue; }
    if (containsSensitiveContent(row.text)) { exclude('unsafe'); continue; }
    const textKey = normalize(row.text);
    if ((row.id && seenIds.has(row.id)) || seenText.has(textKey)) { exclude('duplicate'); continue; }
    if (row.id) seenIds.add(row.id);
    seenText.add(textKey);
    const details = extractPersonalDetailClaims(row.text, { displayName, source: 'memory' });
    if (details.hasPersonalDetails && (details.ambiguous || !details.claims.length || details.claims.some(claim => !currentClaims.has(claimKey(claim))))) { exclude('unmatched_detail'); continue; }
    const keywords = Array.isArray(row.keywords) ? row.keywords.filter(value => typeof value === 'string') : [];
    const tokens = meaningfulTokens([row.text, ...keywords].join(' '));
    const overlap = [...tokens].filter(token => currentTokens.has(token)).length;
    if (!details.claims.length && !overlap && row.category !== 'communication') { exclude('irrelevant'); continue; }
    eligible.push({ row, detailCount: details.claims.length, overlap, recency: Number(row.createdAt ?? (Number(row.created_at || 0) * 1000)) || 0, stable: row.id || textKey });
  }
  eligible.sort((a, b) => b.detailCount - a.detailCount || b.overlap - a.overlap || (!a.detailCount && !b.detailCount ? Number(b.row.category === 'communication') - Number(a.row.category === 'communication') : 0) || b.recency - a.recency || a.stable.localeCompare(b.stable));
  let offTopicCommunication = false;
  for (const candidate of eligible) {
    if (candidate.row.category === 'communication' && !candidate.overlap) {
      if (offTopicCommunication) { exclude('communication_cap'); continue; }
      offTopicCommunication = true;
    }
    if (result.memories.length >= Math.min(3, limit)) { exclude('limit'); continue; }
    result.memories.push(candidate.row);
  }
  result.selectedCount = result.memories.length;
  result.selectedIds = Object.freeze(result.memories.map(row => row.id).filter(Boolean));
  stats.selectedCount = result.selectedCount;
  Object.freeze(stats);
  result.memories = Object.freeze(result.memories.map(row => Object.freeze({ ...row, keywords: Object.freeze(Array.isArray(row.keywords) ? row.keywords.filter(value => typeof value === 'string') : []) })));
  Object.freeze(result.exclusionReasons);
  Object.freeze(result);
  selectionsByArray.set(result.memories, { signature, result, referenceTime: now });
  return result;
}
