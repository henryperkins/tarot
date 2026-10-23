// These are narrow English phrasing checks, not language detection or a
// judgment of the question's meaning. Unknown words (including names) make
// us abstain rather than attach English advice to uncertain/mixed language.
const ENGLISH_WORDS = new Set(`
  a an the i me my mine myself we us our ourselves you your yourself he him his
  she her hers they them their themselves it its this that these those
  how what where why which who when will would should shall can could might
  must is are am was were be been being do does did have has had
  and or but if as than then so to of for from with without in on at by about
  into through over under before after between during within out up back
  not no nothing ever never always only all any some more less most much
  many enough also still again now next last today tonight tomorrow week
  weeks month months year years day days soon right current moment time
  january february march april may june july august september october november december
  help helps support supports need needs want wants know understand learn
  explore reflect consider choose decide choices choice options path paths
  work works working job jobs career purpose direction team business
  project projects study studies school home family friend friends
  sister brother mother father parent parents partner partners relationship
  relationships love connection connections money finances health wellbeing
  balance energy growth life situation issue problem thing things stuff
  something anything everything someone do doing deal going happen happens
  happening find get make take move moving speak speaking talk talking
  trust care caring return returns come comes coming stay stays leave leaves
  open openly honest honestly better new forward action change changes
  clarity doubt doubting self self-doubt confidence accept accepting live
  living uncertainty uncertain stop stopping seeking needing wanting release
  let go outcome outcomes guarantee guarantees guaranteed certainty certain
  sure promise promises promised destined fated inevitable meant feel feeling
  ready readying bring brings become becoming strongest best start end
`.trim().split(/\s+/));

const OPEN_GRAMMAR = /^(?:how|what|where|why|which|who|when)\s+(?:can|could|do|does|did|should|would|will|am|are|is|was|were|has|have|might|must|needs?|support|help|guidance|insight|choices?|steps?)\b/i;
const CLOSED_GRAMMAR = /^(?:will|would|should|shall|is|are|am|was|were|can|could|does|do|did|has|have|had|might|must)\s+(?:i|we|you|he|she|they|my|our|your|the|this|that|it)\b/i;
const VAGUE_QUESTION = /^(?:what (?:should|can|could) i do|what do i need to know|what is going on|how can i deal with (?:this|that|it))\??$/i;
const FIXED_OUTCOME = /\b(?:guarantee(?:d|s)?|destined|fated|inevitable|for sure|for certain|with certainty|meant to be)\b|\b(?:know|be) (?:certain|sure) that\b/i;
const ACCEPTING_UNCERTAINTY = /\b(?:not guaranteed|nothing is guaranteed)\b|\b(?:accept(?:ing)?|live with|work with)\s+(?:the\s+)?uncertainty\b|\b(?:release|let go of|stop (?:seeking|needing|wanting))\s+(?:the\s+)?(?:(?:need|demand)\s+for\s+)?(?:certainty|guarantees?|guaranteed outcomes?)\b/i;

function hasConfidentEnglishPhrasing(text) {
  if (typeof text !== 'string') return false;
  // Latin letters alone are insufficient; even one unknown letter/word is
  // enough to skip assessment. This deliberately misses some English text.
  if (/[^a-z]/i.test((text.match(/\p{L}/gu) || []).join(''))) return false;
  const words = text.toLowerCase().match(/[a-z]+(?:-[a-z]+)?/g) || [];
  return words.length >= 3
    && words.every(word => ENGLISH_WORDS.has(word))
    && (OPEN_GRAMMAR.test(text) || CLOSED_GRAMMAR.test(text));
}

/** At most two optional phrasing suggestions; never a grade or a time requirement. */
export function getQuestionFramingSuggestions(text) {
  const question = typeof text === 'string' ? text.trim() : '';
  if (!hasConfidentEnglishPhrasing(question)) return [];

  const suggestions = [];
  if (FIXED_OUTCOME.test(question) && !ACCEPTING_UNCERTAINTY.test(question)) {
    suggestions.push('This asks for a guaranteed outcome. Consider what you want to understand or what choices are available to you.');
  }
  if (CLOSED_GRAMMAR.test(question)) {
    suggestions.push('This reads as a yes-or-no question. Asking how or what can give you more to reflect on.');
  }
  if (VAGUE_QUESTION.test(question)) {
    suggestions.push('You could name the situation you want to explore.');
  }
  return suggestions.slice(0, 2);
}

/** A small, explicit local rewrite; unfamiliar wording is retained verbatim. */
export function buildLocalQuestionRefinement(text) {
  if (typeof text !== 'string' || !hasConfidentEnglishPhrasing(text.trim())) return text;
  // Keep the entire contextual/timing suffix. We can safely name self-doubt
  // here, but cannot safely infer a subject from a general yes/no question.
  const selfDoubt = text.trim().match(/^will i (?:ever )?stop doubting myself((?: (?:in|about|at|before|during|this|next|today|by|over)\b[^?!.]*)?)\??$/i);
  if (selfDoubt) {
    return `What can help me understand and work with self-doubt${selfDoubt[1]}?`;
  }
  return text;
}
