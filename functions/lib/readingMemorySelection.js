import { resolveContextSelection } from './contextDetection.js';
import { projectReadingContextSpans } from './readingRetrievalQuery.js';
import { CONTEXT_KEYWORDS, GRAPH_RAG_CONTEXT_KEYWORDS } from './readingContextVocabulary.js';
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
const DETAIL_CLAUSE_SEPARATOR = new RegExp(String.raw`,(?!\d)\s*(?:and\s+)?|\s+(?:and(?!\s+${FRACTION_START})|but)\s+|\s*&(?!\s*${FRACTION_START})\s*`, 'i');
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
    // A prefixed number needs the same age continuation as bare shorthand;
    // otherwise a fraction, range or non-year unit could become a year-age claim.
    for (const match of fragment.matchAll(agePattern)) details.push({
      kind: 'age', value: Number(match[1] || match[2]), index: match.index,
      ambiguous: Boolean(match[1]) && !AGE_CONTINUATION.test(fragment.slice(match.index + match[0].length))
    });
    // These are ages, not ordinary durations. Their units are outside the
    // year-age matcher, so fail closed instead of equating eight months to eight years.
    for (const match of fragment.matchAll(/\b(?:days?|weeks?|months?)(?:\s+|[-–])old\b/gi)) {
      details.push({ kind: 'age', value: null, index: match.index, ambiguous: true });
    }
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

// These admission grammars are intentionally small. Unknown factual language is
// omitted; Unicode tokenization is not multilingual subject/negation analysis.
const SUBJECT = String.raw`(?:[Ii]|[Mm]y\s+(?:${RELATIONS})(?:\s+[\p{Lu}][\p{L}'-]*(?:\s+[\p{Lu}][\p{L}'-]*)*)?|[\p{Lu}][\p{L}'-]*(?:\s+[\p{Lu}][\p{L}'-]*)*)`;
const AGE_CLAUSE = new RegExp(String.raw`^${SUBJECT}(?:'s|'m)?\s*(?:(?:am|is|are|was|will\s+be)\s+)?(?:a\s+)?(?:(?:turn(?:s|ing)?|aged?)\s+)?\d{1,3}(?:\s*(?:years?\s+old|[-–]year[-–]old|y\s*\/\s*o))?(?:\s+(?:reader|today|now|this\s+year))?$`, 'u');
const BIRTHDAY_CLAUSE = new RegExp(String.raw`^(?:[Mm]y|${SUBJECT}(?:'s)?)\s+birthday(?:\s+is\s+approaching)?$`, 'u');
const STYLE = /^(?:(?:i\s+)?prefer|prefers)\s+(?:(?:concise|brief|gentle|blunt|balanced|practical|direct|detailed|short|clear|simple|warm)\s+)*(?:advice|language|words|style|responses|readings|explanations|guidance)$/i;
const FOOD_PREFERENCE = /^(?:i\s+(?:prefer|dislike)|prefers|dislikes)\s+(?:(?:vegetarian|vegan|simple|fresh|spicy)\s+)*(?:food|meals|shellfish|vegetables)$/i;
// Reading admission only. This does not change saving or manual memory controls,
// and containsSensitiveContent remains a limited identifier/instruction detector.
const RESTRICTED_HEALTH = /\b(?:allerg(?:y|ies|ic)|anaphylaxis|diagnos(?:is|ed)|medicat(?:ion|ions|ed)|medical(?:ly)?|treatment|prescription)\b/i;
const THEME_WORDS = new Set([
  ...Object.values(CONTEXT_KEYWORDS).flat(), ...Object.values(GRAPH_RAG_CONTEXT_KEYWORDS).flat(),
  'navigating uncertainty choices choice transition transitions exploration exploring prepare preparing guidance advice clarity workplace romantic relationships birthday approaching decisions gardening brings joy creativity créativité woodland hiking making things enjoys working change changing considering seeking practical support process processing reflection gentle balance energy'
].flatMap(text => normalize(text).match(/[\p{L}]+/gu) || []));

function nonfactualKind(text) {
  if (STYLE.test(text)) return 'style';
  if (FOOD_PREFERENCE.test(text)) return 'preference';
  const plain = normalize(text).replace(/^(?:i\s+am|i'm|am|is|are)\s+(?=considering|seeking|navigating|changing)/, '').replace(/^(?:considering|seeking|navigating|working on)\s+/, '');
  const words = plain.match(/[\p{L}]+/gu) || [];
  if (!words.length || /[\p{N}]|[^\p{L}\p{M}\p{Z}'-]/u.test(plain)) return null;
  return words.every(word => THEME_WORDS.has(word) || ['a', 'an', 'the', 'and', 'on', 'in', 'of', 'for', 'with'].includes(word)) ? 'theme' : null;
}

function memoryClauses(text) {
  return text.normalize('NFKC').replace(/[’‘]/g, "'")
    .split(/[;!\n]+|(?<!\d)\.|\.(?!\d)|(?<=[?？])/)
    .flatMap(clause => {
      const parts = clause.split(/\s+(?:and|but)\s+(?=(?:[Ii]\b|[Mm]y\b|[\p{Lu}][\p{L}'-]*\s+(?:is|turns?|works?)\b|(?:am\s+)?considering\b))|\s*&\s*(?=[Ii]\b|[Mm]y\b)|,(?!\d)\s*(?=[\p{Lu}][\p{L}'-]*\s+(?:is|turns?)\b)/u);
      const complete = [];
      let pending = parts.shift() || '';
      for (const part of parts) {
        // Keep coordinated owners together unless the preceding subject already
        // has its own predicate; splitting 'Alice and Bob work' invents Bob's.
        if (extractPersonalDetailClaims(pending).hasPersonalDetails || COPULA_NUMBER.test(pending) || eventClaim(pending.trim(), '') || nonfactualKind(pending.trim())) {
          complete.push(pending);
          pending = part;
        } else pending += ` and ${part}`;
      }
      return [...complete, pending];
    })
    .map(clause => clause.trim()).filter(Boolean);
}

function eventClaim(text, displayName) {
  const wedding = new RegExp(String.raw`^(${SUBJECT})\s+(?:(?:am|is|are)\s+)?(not\s+|no\s+longer\s+)?planning\s+a\s+wedding(\s+with\s+my\s+partner)?$`, 'u').exec(text);
  const canceled = new RegExp(String.raw`^(${SUBJECT})\s+cancel(?:l)?ed\s+(?:my|a|the)\s+wedding$`, 'u').exec(text);
  const employment = new RegExp(String.raw`^(${SUBJECT})\s+(?:(do(?:es)?\s+not|no\s+longer)\s+)?works?\s+at\s+([\p{L}][\p{L}'-]*(?:\s+[\p{Lu}][\p{L}'-]*)*)$`, 'u').exec(text);
  const left = new RegExp(String.raw`^(${SUBJECT})\s+left\s+(?:my|a|the)\s+job\s+at\s+([\p{L}][\p{L}'-]*(?:\s+[\p{Lu}][\p{L}'-]*)*)$`, 'u').exec(text);
  const match = wedding || canceled || employment || left;
  if (!match) return null;
  const subjectKey = ownerFromPrefix(match[1], { displayName: normalize(sanitizeDisplayName(displayName) || ''), source: 'memory', fragment: text, kind: 'event' });
  if (!subjectKey) return null;
  return wedding || canceled
    ? { kind: 'wedding', subjectKey, value: wedding?.[3] ? 'partner' : 'unspecified', negative: Boolean(canceled || wedding?.[2]) }
    : { kind: 'employment', subjectKey, value: normalize(left ? left[2] : employment[3]), negative: Boolean(left || employment[2]) };
}

function unresolvedRetraction(text, displayName) {
  const employment = new RegExp(String.raw`^(${SUBJECT})\s+(?:no\s+longer|do(?:es)?\s+not)\s+works?\s+there$`, 'u').exec(text);
  const canceled = new RegExp(String.raw`^(${SUBJECT})\s+cancel(?:l)?ed\s+it$`, 'u').exec(text);
  const match = employment || canceled;
  if (!match) return null;
  const subjectKey = ownerFromPrefix(match[1], { displayName: normalize(sanitizeDisplayName(displayName) || ''), source: 'memory', fragment: text, kind: 'event' });
  // This records a veto, never an employer or an event resolved from a pronoun.
  return subjectKey ? { kind: employment ? 'employment' : 'unspecified_event', subjectKey } : null;
}

function contractedEmploymentVeto(text, displayName) {
  // Only current-source negative auxiliaries are expanded, and only bounded
  // employment/retraction grammar can produce a veto. No positive authority.
  const expanded = text.replace(/\b(don't|doesn't)\b/gi, auxiliary => auxiliary.toLowerCase() === "don't" ? 'do not' : 'does not');
  if (expanded === text) return { event: null, retraction: null };
  const event = eventClaim(expanded, displayName);
  return {
    event: event?.kind === 'employment' && event.negative ? event : null,
    retraction: unresolvedRetraction(expanded, displayName)
  };
}

function currentDetailEvidence(source, displayName) {
  const extracted = extractPersonalDetailClaims(source.text, { displayName, source: source.id || 'question' });
  const hypothetical = /^(?:if|unless|whether|suppose|assuming|perhaps|maybe|possibly|am|is|are|was|were|will|would|could|should)\b/i.test(source.text);
  const currentShorthand = /^turning\s+\d{1,3}(?:\s+(?:today|now|this\s+year))?$/i.test(source.text);
  const supported = !hypothetical && !extracted.ambiguous && (AGE_CLAUSE.test(source.text) || BIRTHDAY_CLAUSE.test(source.text) || currentShorthand);
  // A negative predicate may intentionally have no positive extractor claim.
  // Parse its affirmative shape only to veto that exact subject/value, never to
  // authorize a memory. Unknown syntax remains unsupported.
  const affirmative = source.text.replace(/\b(?:no\s+longer|not|never)\s+/i, '');
  const negative = affirmative !== source.text && AGE_CLAUSE.test(affirmative)
    ? extractPersonalDetailClaims(affirmative, { displayName, source: source.id || 'question' }).claims : [];
  return { claims: supported ? extracted.claims : [], ambiguousClaims: supported ? [] : extracted.claims, negative };
}

function roleVetoes(sources) {
  const ambiguous = new Set();
  const names = new Map();
  for (const source of sources) {
    const roles = analyzeRoleMultiplicity(source.text);
    for (const role of roles.ambiguousRoles) ambiguous.add(role);
    for (const [role, values] of roles.namedRoles) {
      if (!names.has(role)) names.set(role, new Set());
      for (const value of values) names.get(role).add(value);
      if (names.get(role).size > 1) ambiguous.add(role);
    }
  }
  return ambiguous;
}

/**
 * Conservative, pure reading-admission guard. It recognizes only documented
 * age/birthday, wedding, employment and nonfactual preference/theme forms.
 * Optional displayName is internal context, never a client authority marker.
 */
export function checkMemoryCompatibility(memory, currentSources = [], { displayName = '' } = {}) {
  const text = typeof memory === 'string' ? memory : memory?.text;
  const reject = (status, reason) => ({ status, reason });
  if (typeof text !== 'string' || !text.trim()) return reject('ambiguous', 'malformed');
  if (containsSensitiveContent(text)) return reject('ambiguous', 'unsafe');
  if (RESTRICTED_HEALTH.test(text)) return reject('ambiguous', 'restricted_detail');
  const current = (Array.isArray(currentSources) ? currentSources : []).filter(source => typeof source?.text === 'string');
  const currentVetoes = roleVetoes(current);
  const memoryDetails = extractPersonalDetailClaims(text, { displayName, source: 'memory' });
  if (memoryDetails.ambiguous) return reject('ambiguous', 'unmatched_detail');
  const currentClauses = current.flatMap(source => memoryClauses(source.text).map(text => ({ ...source, text })));
  const evidence = currentClauses.map(source => currentDetailEvidence(source, displayName));
  const detailEvidence = evidence.flatMap(result => result.claims);
  const ambiguousDetails = evidence.flatMap(result => result.ambiguousClaims);
  const negativeDetails = evidence.flatMap(result => result.negative);
  let supported = false;
  for (const claim of memoryDetails.claims) {
    if (claim.subjectKey.startsWith('relation:') && currentVetoes.has(claim.subjectKey.slice(9))) return reject('ambiguous', 'unmatched_detail');
    const sameSubject = detailEvidence.filter(candidate => candidate.subjectKey === claim.subjectKey && candidate.kind === claim.kind);
    if (sameSubject.some(candidate => candidate.value !== claim.value)) return reject('conflicting', 'conflicting_detail');
    if (negativeDetails.some(candidate => claimKey(candidate) === claimKey(claim))) return reject('conflicting', 'conflicting_detail');
    if (ambiguousDetails.some(candidate => candidate.kind === claim.kind && candidate.subjectKey === claim.subjectKey)) return reject('ambiguous', 'unmatched_detail');
    if (!sameSubject.some(candidate => claimKey(candidate) === claimKey(claim))) return reject('ambiguous', 'unmatched_detail');
    supported = true;
  }
  const contractedVetoes = currentClauses.map(source => contractedEmploymentVeto(source.text, displayName));
  const currentEvents = [...currentClauses.map(source => eventClaim(source.text, displayName)), ...contractedVetoes.map(veto => veto.event)].filter(Boolean);
  const unresolvedRetractions = [...currentClauses.map(source => unresolvedRetraction(source.text, displayName)), ...contractedVetoes.map(veto => veto.retraction)].filter(Boolean);
  for (const clause of memoryClauses(text)) {
    if (nonfactualKind(clause)) continue;
    const event = eventClaim(clause, displayName);
    if (event) {
      if (unresolvedRetractions.some(retraction => retraction.subjectKey === event.subjectKey && (retraction.kind === event.kind || event.kind === 'wedding' && retraction.kind === 'unspecified_event'))) return reject('ambiguous', 'unmatched_detail');
      if (event.subjectKey.startsWith('relation:') && currentVetoes.has(event.subjectKey.slice(9))) return reject('ambiguous', 'unmatched_detail');
      const evidence = currentEvents.filter(candidate => candidate.kind === event.kind && candidate.subjectKey === event.subjectKey);
      if (evidence.some(candidate => candidate.value !== event.value && candidate.negative === event.negative)) return reject('ambiguous', 'unmatched_detail');
      if (evidence.some(candidate => candidate.negative !== event.negative && (candidate.value === event.value || event.kind === 'wedding'))) return reject('conflicting', 'conflicting_detail');
      if (!evidence.some(candidate => candidate.value === event.value && candidate.negative === event.negative)) return reject('ambiguous', 'unmatched_detail');
      supported = true;
      continue;
    }
    if ((AGE_CLAUSE.test(clause) || BIRTHDAY_CLAUSE.test(clause)) && extractPersonalDetailClaims(clause, { displayName, source: 'memory' }).claims.length) continue;
    return reject('ambiguous', 'unsupported_claim');
  }
  return supported ? reject('supported', 'current_claim_agreement') : reject('nonfactual', 'recognized_nonfactual');
}

function currentSourceKind(source) {
  if (source.kind) return source.kind;
  if (source.id === 'question') return 'question';
  if (String(source.id).startsWith('focus-')) return 'savedFocus';
  if (String(source.id).startsWith('card-')) return 'cardReflection';
  if (/^path[AB]$/.test(source.id)) return 'decisionPath';
  return 'reflection';
}

function conflictsWithCurrentStyle(text, personalization) {
  return memoryClauses(text).some(clause => {
    if (!STYLE.test(clause)) return false;
    const normalized = normalize(clause);
    const tone = /\b(gentle|blunt|balanced)\b/.exec(normalized)?.[1];
    if (personalization?.readingTone && tone && tone !== personalization.readingTone) return true;
    if (personalization?.preferredSpreadDepth === 'deep' && /\b(?:brief|concise|short)\b/.test(normalized)) return true;
    return personalization?.preferredSpreadDepth === 'short' && /\bdetailed\b/.test(normalized);
  });
}

/**
 * Pure selection, frozen for this request. userId/personalization are optional
 * INTERNAL bindings for direct candidates/current preferences, never wire fields.
 * DB-loaded candidate ownership remains enforced by the loader's bound SQL.
 */
export function selectMemoriesForReading(candidates, { sources = [], contextSelection, displayName = '', userId, personalization, limit = 3, referenceTime } = {}) {
  const input = Array.isArray(candidates) ? candidates : [];
  const loadStats = getMemoryCandidateLoadStats(input);
  const candidateCount = loadStats?.candidateCount ?? input.length;
  const exclusionReasons = loadStats?.unsafeCount ? { unsafe: loadStats.unsafeCount } : {};
  const exclude = reason => { exclusionReasons[reason] = (exclusionReasons[reason] || 0) + 1; };
  const cached = selectionsByArray.get(input);
  const now = Number.isFinite(referenceTime) ? referenceTime : cached?.referenceTime ?? Date.now();
  const stats = { candidateCount, selectedCount: 0, exclusionReasons };
  const result = { memories: [], selectedIds: [], stats, candidateCount, selectedCount: 0, exclusionReasons, referenceTime: now };
  const freeze = () => {
    result.selectedCount = result.memories.length;
    result.selectedIds = Object.freeze(result.memories.map(row => row.id).filter(Boolean));
    stats.selectedCount = result.selectedCount;
    Object.freeze(exclusionReasons);
    Object.freeze(stats);
    result.memories = Object.freeze(result.memories.map(row => Object.freeze({ ...row, keywords: Object.freeze(Array.isArray(row.keywords) ? row.keywords.filter(value => typeof value === 'string') : []) })));
    return Object.freeze(result);
  };
  if (!Number.isInteger(limit) || limit <= 0) return freeze();
  const prepared = (Array.isArray(sources) ? sources : []).filter(source => source && typeof source.text === 'string' && !String(source.id || '').startsWith('interpretation-')).map(source => ({ ...source, kind: currentSourceKind(source) }));
  const selection = contextSelection || resolveContextSelection({ sources: prepared });
  // A source ID or mandatory query excerpt does not authorize its other clauses.
  const current = projectReadingContextSpans(prepared, selection).filter(entry => entry.source.kind !== 'savedFocus').flatMap(entry => entry.spans.map(span => ({ ...entry.source, text: span.text })));
  const signature = JSON.stringify([current.map(field => [field.id, field.text]), selection.context, selection.graphRAGContext, sanitizeDisplayName(displayName), userId, personalization, limit, now]);
  if (cached?.signature === signature) return cached.result;
  const currentTokens = meaningfulTokens(current.map(field => field.text).join(' '));
  const seenIds = new Set();
  const seenText = new Set();
  const eligible = [];
  for (const row of input) {
    if (!row || Array.isArray(row) || typeof row.text !== 'string' || !row.text.trim() || (row.id !== undefined && (typeof row.id !== 'string' || !row.id)) || (row.category && !CATEGORIES.has(row.category))) { exclude('malformed'); continue; }
    if (userId && ((row.userId !== undefined && row.userId !== userId) || (row.user_id !== undefined && row.user_id !== userId))) { exclude('wrong_owner'); continue; }
    if (row.scope !== undefined && row.scope !== 'global') { exclude('non_global'); continue; }
    const expiry = row.expiresAt ?? (row.expires_at == null ? null : Number(row.expires_at) * 1000);
    if (expiry != null && (!Number.isFinite(expiry) || expiry <= now)) { exclude('expired'); continue; }
    const compatibility = checkMemoryCompatibility(row, current, { displayName });
    if (!['supported', 'nonfactual'].includes(compatibility.status)) { exclude(compatibility.reason); continue; }
    const textKey = normalize(row.text);
    if ((row.id && seenIds.has(row.id)) || seenText.has(textKey)) { exclude('duplicate'); continue; }
    if (row.id) seenIds.add(row.id);
    seenText.add(textKey);
    const clauses = memoryClauses(row.text);
    const style = clauses.length === 1 && STYLE.test(clauses[0]);
    if (conflictsWithCurrentStyle(row.text, personalization)) { exclude('current_preference_conflict'); continue; }
    // Text must independently establish relevance. Metadata keywords may help
    // ranking only after admission; they cannot smuggle unrelated private facts.
    const tokens = meaningfulTokens(row.text);
    const textOverlap = [...tokens].filter(token => currentTokens.has(token)).length;
    const keywords = Array.isArray(row.keywords) ? row.keywords.filter(value => typeof value === 'string' && value.trim().length <= 30 && !containsSensitiveContent(value)) : [];
    const overlap = [...meaningfulTokens([row.text, ...keywords].join(' '))].filter(token => currentTokens.has(token)).length;
    if (compatibility.status !== 'supported' && !textOverlap && !(style && row.category === 'communication')) { exclude('irrelevant'); continue; }
    eligible.push({ row, detailCount: compatibility.status === 'supported' ? Math.max(1, extractPersonalDetailClaims(row.text, { displayName }).claims.length) : 0, overlap, textOverlap, style, recency: Number(row.createdAt ?? (Number(row.created_at || 0) * 1000)) || 0, stable: row.id || textKey });
  }
  eligible.sort((a, b) => b.detailCount - a.detailCount || b.overlap - a.overlap || b.recency - a.recency || a.stable.localeCompare(b.stable));
  let offTopicCommunication = false;
  for (const candidate of eligible) {
    if (candidate.style && !candidate.textOverlap) {
      if (offTopicCommunication) { exclude('communication_cap'); continue; }
      offTopicCommunication = true;
    }
    if (result.memories.length >= Math.min(3, limit)) { exclude('limit'); continue; }
    result.memories.push(candidate.row);
  }
  freeze();
  selectionsByArray.set(result.memories, { signature, result, referenceTime: now });
  return result;
}
