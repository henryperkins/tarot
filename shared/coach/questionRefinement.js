import { checkQuestionTiming } from './questionTiming.js';

// These are conservative editing constraints, not a semantic assessment. New
// substantive vocabulary that cannot be grounded in the question is refused.
// A useful but unfamiliar paraphrase may therefore keep the original instead.
const ADDABLE = new Set(`a an the i me my myself is am are be been being do does
  did have has had can could would should may might what how why where which
  who when to of for about in on at by with as and or if help support understand
  work explore approach navigate reflect learn consider choices choice options
  available insight step steps`.split(/\s+/));
const NEGATION = /\b(?:not|no|never|without|cannot|avoid|refuse|stop)\b|n['’]t\b/iu;
const NEGATORS = /\b(?:not|no|never|without|cannot)\b|n['’]t\b/giu;
const PRONOUN = /\b(?:i|me|my|myself|we|us|our|ourselves|you|your|yourself|he|him|his|she|her|hers|they|them|their|themselves|it|its)\b/giu;
const PEOPLE = /\b(?:my|our|your|his|her|their)\s+(?:(?:older|younger|little|big|ex)\s+)?(?:sister|brother|mother|father|mom|dad|parent|parents|partner|wife|husband|child|children|son|daughter|friend|friends|boss|colleague|team)\b/giu;
const FRAME = /^(?:what\s+(?:can|could|would)\s+(?:help|support)\s+(?:me|us)|how\s+(?:can|could|might|should)\s+(?:i|we)|will\s+i(?:\s+ever)?)\s+/iu;
const SELF_DOUBT = /^will i (?:ever )?stop doubting myself\b/iu;
const tokenise = text => text.normalize('NFC').toLowerCase().replaceAll('’', "'").match(/[\p{L}\p{M}]+(?:['-][\p{L}\p{M}]+)*|\p{N}+(?:[.,]\p{N}+)*/gu) || [];
const folded = text => text.normalize('NFC').toLowerCase().replace(/\s+/gu, ' ').trim();
const clauses = text => text.split(/[.!?](?=\s|$)|[\r\n]+/u).map(part => part.trim()).filter(Boolean);
const matches = (text, regex) => [...text.matchAll(regex)].map(match => folded(match[0]));

function protectedLiterals(text) {
  const concrete = text.match(/[\p{L}\p{N}]+(?:\+\+|#)|[$€£]\s*\p{N}[\p{N},.]*/gu) || [];
  const names = clauses(text).flatMap(clause => clause.replace(FRAME, '').match(/(?<![\p{L}\p{N}])(?:\p{Lu}\p{Ll}+|\p{Lu}{2,})(?![\p{L}\p{N}])/gu) || []);
  return [...concrete, ...names].sort();
}

function canonicaliser(original) {
  const source = new Set(tokenise(original));
  const substitutions = new Map();
  const addFamily = (words, key) => {
    if (words.some(word => source.has(word))) for (const word of words) substitutions.set(word, key);
  };
  const communication = ['speak', 'talk', 'communicate'];
  addFamily(communication, 'speak');
  const ongoingCommunication = ['speaking', 'talking', 'communicating'];
  addFamily(ongoingCommunication, 'speaking');
  if ([...communication, ...ongoingCommunication, 'spoke', 'communication'].some(word => source.has(word))) {
    addFamily(['openly', 'openness', 'honest', 'honestly', 'honesty'], 'openly');
  }
  addFamily(['doubt', 'doubts', 'self-doubt'], 'doubt');
  return word => substitutions.get(word) || word;
}

function isSubsequence(needles, haystack) {
  let next = 0;
  for (const word of haystack) if (word === needles[next]) next++;
  return next === needles.length;
}

/** Refuse known constraint violations; an accepted edit is not proof of meaning. */
export function checkQuestionRefinement(original, candidate) {
  if (typeof original !== 'string' || typeof candidate !== 'string' || !original.trim() || !candidate.trim()) {
    return { valid: false, issues: ['invalid_refinement'] };
  }
  const issues = [...checkQuestionTiming(original, candidate).issues];
  if (candidate === original) return { valid: issues.length === 0, issues };
  if (/[\p{Cc}\p{Cf}]/u.test(candidate.replace(/[\r\n\t]/g, ''))) issues.push('control_characters');
  // Only this known expression may change from ceasing self-doubt to working
  // with it. A later "stop" or another constrained goal is never exempted.
  const reference = original.trim().replace(SELF_DOUBT, 'self-doubt');
  const canon = canonicaliser(reference);
  const sourceWords = tokenise(reference).map(canon);
  const proposedWords = tokenise(candidate).map(canon);
  const sourceSet = new Set(sourceWords);
  if (proposedWords.some(word => !sourceSet.has(word) && !ADDABLE.has(word))) issues.push('unsupported_content');
  const originalWordCount = tokenise(original).length;
  if (proposedWords.length > originalWordCount + Math.max(6, Math.floor(originalWordCount * 0.4))) issues.push('expanded_question');
  if ((candidate.match(/\?/g) || []).length > Math.max(1, (original.match(/\?/g) || []).length)) issues.push('added_question');

  // Preserve syntax-bearing concrete subjects and quantities (C# != C++).
  if (JSON.stringify(protectedLiterals(reference)) !== JSON.stringify(protectedLiterals(candidate))) issues.push('literal_changed');
  const sourcePeople = matches(original, PEOPLE);
  if (JSON.stringify(sourcePeople) !== JSON.stringify(matches(candidate, PEOPLE))) issues.push('people_changed');
  if (JSON.stringify(matches(original, NEGATORS)) !== JSON.stringify(matches(candidate, NEGATORS))) issues.push('negation_changed');

  const sourceClauses = clauses(reference);
  for (const clause of sourceClauses) {
    // Negation and constrained goals have scope. Keep such a clause intact;
    // token overlap alone could move "not" to a different action.
    const questionClause = /^(?:how|what|where|why|which|who|when|will|can|could|should|would|is|are|does|do)\b/iu.test(clause);
    if (NEGATION.test(clause) || !questionClause) {
      if (!folded(candidate).includes(folded(clause))) issues.push('constrained_goal_changed');
    }
    const body = clause.replace(FRAME, '');
    // Retain body words, including tense, relation words and names that happen
    // to spell auxiliaries (May/Will). Only the known outer frame is removable.
    const anchors = tokenise(body).map(canon);
    if (!isSubsequence(anchors, proposedWords)) issues.push('concern_changed');
  }
  if (sourceClauses.length === 1) {
    const sourceFrame = original.trim().match(FRAME)?.[0] || '';
    const candidateFrame = candidate.trim().match(FRAME)?.[0] || '';
    const frameSpeaker = frame => /\b(?:we|us)\b/iu.test(frame) ? 'plural' : frame ? 'singular' : '';
    if (sourceFrame && candidateFrame && frameSpeaker(sourceFrame) !== frameSpeaker(candidateFrame)) issues.push('perspective_changed');
    const sourceBody = reference.trim().replace(FRAME, '');
    const candidateBody = candidate.trim().replace(FRAME, '');
    const refs = text => matches(text, PRONOUN);
    if (JSON.stringify(refs(sourceBody)) !== JSON.stringify(refs(candidateBody))) issues.push('perspective_changed');
  }
  // Recognizing this particular frame does not classify Latin text as English.
  // Do not add it around wording whose frame we cannot conservatively match.
  if (!clauses(original).some(clause => FRAME.test(clause)) && FRAME.test(candidate.trim())) issues.push('unfamiliar_frame_change');
  return { valid: issues.length === 0, issues: [...new Set(issues)] };
}
