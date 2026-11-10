// These patterns recognize explicit notation and a bounded set of English and
// Spanish timing phrases. They do not detect language, infer dates, or assess
// meaning. Unrecognized wording is deliberately left to the refinement prompt.
const MONTH = String.raw`(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan\.?|Feb\.?|Mar\.?|Apr\.?|Jun\.?|Jul\.?|Aug\.?|Sept?\.?|Oct\.?|Nov\.?|Dec\.?)`;
const WEEKDAY = '(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)';
const SPANISH_WEEKDAY = '(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)';
const YEAR = '(?:19|20|21)\\d{2}';
const DAY = String.raw`\d{1,2}(?:st|nd|rd|th)?`;
const EN_NUMBER = String.raw`(?:\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a|an|few|several)`;
const EN_UNIT = '(?:days?|weeks?|months?|years?|hours?|minutes?|weekends?|quarters?|seasons?|mornings?|afternoons?|evenings?|nights?)';
const ES_NUMBER = String.raw`(?:\d{1,3}|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)`;
const ES_UNIT = '(?:días?|dias?|semanas?|mes(?:es)?|años?|anos?|horas?|minutos?|noches?)';
const DAYPART = '(?:morning|afternoon|evening|night)';
const BOUND = String.raw`(?:at\s+(?:least|most)|no\s+(?:more|less)\s+than)`;
const ZONE = String.raw`(?:UTC|GMT|[ECMP][SD]T|Z|[+-]\d{2}:?\d{2})`;
const EN_RELATION = String.raw`(?:(?:not\s+)?(?:before|after|until|by|on|at|in|within|over|during|for|from|since|through|around|starting|ending)|no\s+(?:earlier|later)\s+than|as\s+of)`;
const ES_RELATION = String.raw`(?:(?:no\s+)?(?:antes\s+(?:de|del)|después\s+(?:de|del)|despues\s+(?:de|del)|hasta|desde|durante|dentro\s+de|para|por|en|el))`;
const RELATION = `(?:${EN_RELATION}|${ES_RELATION})`;
const ARTICLE = String.raw`(?:(?:the|la|el)\s+)?`;

const BASE = [
  // Preserve an ISO timestamp as one value, not a date plus clock fragments.
  String.raw`\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:?\d{2})?`,
  String.raw`\d{4}-\d{2}-\d{2}`,
  String.raw`\d{1,2}[/-]\d{1,2}[/-]\d{2,4}`,
  `${MONTH}\\s+${DAY}(?:(?:,\\s*|\\s+)${YEAR})?(?:\\s+${DAYPART})?`,
  `${DAY}(?:\\s+of)?\\s+${MONTH}(?:\\s+${YEAR})?(?:\\s+${DAYPART})?`,
  String.raw`(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(?:\s?[ap]\.?m\.?)?(?:\s?${ZONE})?`,
  String.raw`(?:1[0-2]|0?[1-9])\s?[ap]\.?m\.?(?:\s?${ZONE})?`,
  `Q[1-4]\\s+${YEAR}`,
  String.raw`(?:the\s+)?(?:this|next|last|coming|previous|current)\s+(?:${EN_NUMBER}\s+)?${EN_UNIT}`,
  String.raw`(?:the\s+)?(?:this|next|last|coming)\s+${WEEKDAY}(?:\s+${DAYPART})?`,
  String.raw`(?:${BOUND}\s+)?${EN_NUMBER}\s+${EN_UNIT}`,
  String.raw`(?:la\s+|el\s+)?(?:esta|este|próxima|próximo|proxima|proximo|siguiente|pasada|pasado|última|último|ultima|ultimo)\s+${ES_UNIT}`,
  String.raw`${ES_NUMBER}\s+${ES_UNIT}`,
  String.raw`${WEEKDAY}(?:\s+${DAYPART})?`,
  SPANISH_WEEKDAY,
  String.raw`(?:today|tomorrow|yesterday|tonight|hoy|mañana|manana|ayer)(?:\s+${DAYPART})?`,
  String.raw`(?:right\s+now|the\s+current\s+moment)`
].map(value => `(?:${value})`).join('|');

const BASE_VALUE = `(?:${BASE})`;
const CONTEXT_VALUE = String.raw`(?:${BASE}|\d{1,2}[/-]\d{1,2}|${MONTH}|${YEAR}|${DAYPART}|tarde|noche)`;
const JOIN = String.raw`(?:\s+(?:to|through|until|and|hasta|a|y)\s+|\s+[–—-]\s+)`;
const PATTERNS = [
  // Both endpoints and the words connecting them belong to the constraint.
  String.raw`(?:from|between|desde|entre)\s+${ARTICLE}${CONTEXT_VALUE}${JOIN}${ARTICLE}${CONTEXT_VALUE}`,
  String.raw`(?:${RELATION}\s+${ARTICLE}|not\s+)?${BASE_VALUE}(?:${JOIN}${ARTICLE}${BASE_VALUE})?`,
  // Month names and bare years are ambiguous unless a timing relation gives
  // them context. A month followed by a day is already covered above.
  String.raw`${RELATION}\s+${ARTICLE}${CONTEXT_VALUE}`
].map(pattern => String.raw`(?<![\p{L}\p{N}])(?:${pattern})(?![\p{L}\p{N}])`);

/** Return recognized literal timing spans without interpreting their dates. */
export function extractQuestionTiming(text) {
  if (typeof text !== 'string' || !text) return [];
  const candidates = [];
  for (const pattern of PATTERNS) {
    for (const match of text.matchAll(new RegExp(pattern, 'giu'))) {
      candidates.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
    }
  }
  candidates.sort((a, b) => a.start - b.start || b.end - a.end);
  const spans = [];
  let end = -1;
  for (const candidate of candidates) {
    if (candidate.start < end) continue;
    spans.push(candidate.text);
    end = candidate.end;
  }
  return spans;
}

/** Fail closed on recognized changes; no recognized timing means abstention. */
export function checkQuestionTiming(original, candidate) {
  const source = typeof original === 'string' ? original : '';
  const result = typeof candidate === 'string' ? candidate : '';
  const issues = [];
  const sourceSpans = extractQuestionTiming(source);
  const resultSpans = extractQuestionTiming(result);
  if (sourceSpans.some(span => !resultSpans.includes(span))) issues.push('timing_changed');
  if (resultSpans.some(span => !sourceSpans.includes(span))) issues.push('timing_added');
  return { valid: issues.length === 0, issues };
}
