import { excludedContextRanges } from './readingContextVocabulary.js';

// Admission for first-person recovery material is intentionally narrow. These
// signals recognize an explicit current statement; ambiguity falls back to the
// general card meanings. "Recovery" or "support" alone can concern many topics.
const ADDICTION = /\b(?:addict(?:ion|ed)?|alcoholic|alcoholism|sobriety|sober|(?:alcohol|drug|opioid|substance) dependence|substance use disorder)\b/u;
// The reader may exclude recovery framing without naming a condition.
const REFERENCE_TOPIC = new RegExp(`${ADDICTION.source}|\\brecovery\\b`, 'u');
const TRAUMA_TOPIC = /\b(?:trauma|traumatic|ptsd|post[-\s]?traumatic stress(?: disorder)?)\b/iu;
const TOPIC = '(?:(?:alcohol|drug|opioid|gambling|substance|substance use) )?addiction|(?:alcohol|drug|opioid|substance) dependence|alcoholism|sobriety|substance use disorder';
// Require the asserted topic to end or take a clause/preposition. An arbitrary
// noun after "my addiction" (e.g. counselor, research) may be the real subject.
const TOPIC_END = '(?: (?:recovery|treatment))?(?=\\s*(?:$|[,:(]|(?:and|or|but|while|with|at|in|on|from|during|before|after|today|now|is|has|affects|feels|makes)\\b|to (?:alcohol|drugs|opioids|gambling)\\b))';
const SELF = new RegExp(
  `\\bmy (?:own )?(?:(?:recovery|treatment) (?:for|from) )?(?:${TOPIC})\\b${TOPIC_END}|` +
  `\\bi (?:have|struggle with|am struggling with|live with|am living with|am recovering from|am in recovery (?:for|from)) (?:an? |my )?(?:${TOPIC})\\b${TOPIC_END}|` +
  '\\bi am (?:an? (?:addict|alcoholic)|addicted to (?:alcohol|drugs|opioids|gambling)|in recovery and (?:getting|staying) sober)\\b',
  'u'
);
const EXCLUDES_TOPIC = /\b(?:without|exclude|avoid|no|leave out|(?:do not|don't|never) (?:discuss|mention|include|assume|suggest|use|focus on))\s+(?:(?:any|an?|the|my) )?$/u;
const EXCLUDES_FRAME = /\b(?:do not|don't|never) (?:frame|interpret|treat|describe|present)\b[^,;.!?]{0,60}\b(?:as|around|through|in terms of)\s+(?:(?:an?|the|my) )?$/u;
const UNCERTAIN = /\b(?:if|whether|maybe|perhaps|might|(?:could|may) (?:be|have)|worried|wonder(?:ing)?|suspect|not sure|is it|is this|do i have|am i addicted|what if)\b/u;
const DENIAL_OR_ATTRIBUTION = /\b(?:not|never|no longer|used to|don't|didn't|doesn't|said|says|told|thinks|believes|called|calls|quote|quoted|suppose|imagine|pretend)\b|["“”]|(?:^|\s)'(?:i |my )/u;
// Allow a current note to clarify a question wholly about the reader's own
// unspecified recovery. Additional subjects ("after surgery", etc.) do not fit.
const ASKS_ABOUT_OWN_RECOVERY = /^(?:how (?:can|could|do|might|should) i |what (?:can|could|should) i do to )(?:stay on track (?:in|with)|(?:find|get|seek) support (?:with|for)|support|sustain|maintain|focus on) my (?:own )?recovery[?.!]*$/iu;
const ASKS_FOR_SUPPORT = /^(?:how (?:can|could|do|should) i (?:find|get|seek|ask for) (?:help|support)|who (?:can|could|should) i (?:ask|turn to) for (?:help|support))(?: (?:with|for) (?:this|that|it))?$/iu;
// Only a complete, open-ended question lets a note establish a sensitive topic.
const OPEN_REQUEST = /^(?:(?:(?:any|some|general|what)\s+)?(?:guidance|insight|advice|direction|clarity|message)(?: for me)?|what (?:should|can|could) i (?:focus on|consider|reflect on|do|know)|what (?:do i need to know|needs my attention|would help me)|how (?:can|could|should) i (?:move forward|deal with (?:this|that|it)))(?: (?:right now|today))?[?.!]*$/iu;

function hasSeparateUnrelatedRequest(text) {
  // A self-disclosure can be background to a later, different ask. Honor a
  // separate final question or explicit "but my question is..." redirection.
  const clauses = text.split(/[.?!;\n]+|,?\s+but\s+/iu).map(clause => clause.trim()).filter(Boolean);
  const ask = clauses.at(-1) || '';
  if (clauses.length < 2 || !/^(?:what|where|how|when|which|why|who|should|can|could|my question|i (?:want|need) to (?:ask|focus))\b/iu.test(ask)) return false;
  return !ADDICTION.test(ask.toLowerCase()) && !ASKS_ABOUT_OWN_RECOVERY.test(ask) && !ASKS_FOR_SUPPORT.test(ask)
    && !OPEN_REQUEST.test(ask);
}

function evidence(text) {
  const normalized = String(text || '').normalize('NFKC').toLowerCase()
    .replace(/[’‘ʼ＇]/gu, "'").replace(/\bi'm\b/gu, 'i am');
  let status = 'absent';
  for (const sentence of normalized.split(/[.!?;\n]+/u)) {
    if (!REFERENCE_TOPIC.test(sentence)) continue;
    const exclusions = excludedContextRanges(sentence);
    if (exclusions.some(range => range.scope === 'topic' && REFERENCE_TOPIC.test(sentence.slice(range.start, range.end)))
      || [...sentence.matchAll(new RegExp(REFERENCE_TOPIC, 'gu'))].some(match => {
        const before = sentence.slice(0, match.index);
        return EXCLUDES_TOPIC.test(before) || EXCLUDES_FRAME.test(before);
      })) return 'excluded';
    if (!ADDICTION.test(sentence)) continue;
    if (!SELF.test(sentence) || UNCERTAIN.test(sentence) || DENIAL_OR_ATTRIBUTION.test(sentence)) status = 'unconfirmed';
    else if (status === 'absent') status = 'self';
  }
  return status;
}

function traumaEvidence(text) {
  const normalized = String(text || '').normalize('NFKC').toLowerCase().replace(/[’‘ʼ＇]/gu, "'");
  const mentions = [...normalized.matchAll(new RegExp(TRAUMA_TOPIC, 'giu'))];
  const exclusions = excludedContextRanges(normalized);
  if (mentions.some(match => {
    const before = normalized.slice(0, match.index);
    return EXCLUDES_TOPIC.test(before) || EXCLUDES_FRAME.test(before)
      || exclusions.some(range => range.scope === 'topic' && match.index >= range.start && match.index < range.end);
  })) return 'excluded';
  return mentions.length > 0 ? 'explicit' : 'absent';
}

/** Private, request-local permission. Only accepted current reader text is evidence. */
export function resolveReadingSensitiveContext({ sources = [], contextSelection } = {}) {
  const question = sources.find(source => source.kind === 'question')?.text || '';
  let addiction = evidence(question);
  if (addiction === 'self' && hasSeparateUnrelatedRequest(question)) addiction = 'unconfirmed';
  const notes = sources.filter(source => source.kind === 'reflection' || source.kind === 'cardReflection');
  const relevantNote = note => !question.trim() || (
    OPEN_REQUEST.test(question.trim())
    && contextSelection?.source === 'reflections' && contextSelection.selectedSourceIds?.includes(note.id)
  );
  const decisions = notes.map(source => ({ source, status: evidence(source.text) }));
  if (decisions.some(note => note.status === 'excluded')) addiction = 'excluded';
  if (addiction === 'absent') {
    // A concrete question about something else cannot inherit a personal
    // recovery note. A broad question may use the reflection that supplied
    // its subject; neither saved preferences nor option labels identify it.
    const relevant = decisions.filter(note => ASKS_ABOUT_OWN_RECOVERY.test(question.trim()) || relevantNote(note.source));
    if (relevant.some(note => note.status === 'unconfirmed')) addiction = 'unconfirmed';
    else if (relevant.some(note => note.status === 'self')) addiction = 'self';
  }
  const questionTrauma = traumaEvidence(question);
  const noteTrauma = notes.map(note => ({ note, status: traumaEvidence(note.text) }));
  const traumaExcluded = questionTrauma === 'excluded' || noteTrauma.some(({ status }) => status === 'excluded');
  const trauma = !traumaExcluded && (
    questionTrauma === 'explicit' || noteTrauma.some(({ note, status }) => status === 'explicit' && relevantNote(note))
  );
  return Object.freeze({ addiction, trauma });
}

/** Called with a registry passage or its verified projection (never caller prose). */
export function isPassageEligibleForSensitiveContext(passage, sensitiveContext) {
  const context = passage.authoredContext || passage.context;
  if (context === 'addiction') return sensitiveContext?.addiction === 'self';
  if (context === 'trauma') return sensitiveContext?.trauma === true;
  return true;
}
