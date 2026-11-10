import { SUIT_PROGRESSIONS } from '../../src/data/knowledgeGraphData.js';
import { MINOR_ARCANA } from '../../src/data/minorArcana.js';
import { groupGraphCardIdentities } from './graphCardMembership.js';

export const COURT_MEMBER_ROLES = {
  Wands: { Page: 'curiosity and inspiration', Knight: 'bold initiative', Queen: 'warmth and confidence', King: 'vision and leadership' },
  Cups: { Page: 'openness and imagination', Knight: 'idealism and romantic expression', Queen: 'receptivity and empathy', King: 'emotional steadiness and compassionate leadership' },
  Swords: { Page: 'inquiry and alertness', Knight: 'assertive pursuit of ideas', Queen: 'discernment and boundaries', King: 'reasoned judgment and ethical authority' },
  Pentacles: { Page: 'study and practical learning', Knight: 'patience and dependable effort', Queen: 'nurture and practical care', King: 'stewardship and resource management' }
};

const minorTypes = new Set(['suit-progression', 'court-lineage']);
const ranks = ['Page', 'Knight', 'Queen', 'King'];

function familyFor(passage) {
  const [suit, stage] = String(passage.patternId).split(':');
  if (!Object.hasOwn(SUIT_PROGRESSIONS, suit)) return null;
  if (passage.type === 'suit-progression' && ['beginning', 'challenge', 'mastery'].includes(stage)) {
    return { suit, stage, members: SUIT_PROGRESSIONS[suit][stage].cards.map(card => ({ key: card.name.toLowerCase(), name: card.name, role: card.role })) };
  }
  if (passage.type === 'court-lineage' && ['alliance', 'council'].includes(stage)) {
    return { suit, stage, members: ranks.map(rank => ({ key: `${rank} of ${suit}`.toLowerCase(), name: `${rank} of ${suit}`, role: COURT_MEMBER_ROLES[suit][rank] })) };
  }
  return null;
}

/** Final construction uses the actual spread even for stale or raw payloads. */
export function bindMinorPassageToCards(passage, cardsInfo, deckStyle) {
  if (!minorTypes.has(passage?.type)) return passage;
  const family = familyFor(passage);
  if (!family) return null;
  const members = groupGraphCardIdentities(cardsInfo, { deckStyle }).members
    .filter(member => family.members.some(card => card.key === member.canonicalKey));
  return { ...passage, matchedCardKeys: members.map(member => member.canonicalKey),
    matchedCardIndices: members.flatMap(member => member.indices) };
}

/** No complete-family prose is reused for a matched subset. */
export function projectMinorPatternReference(passage) {
  if (!minorTypes.has(passage?.type) || !Object.hasOwn(passage, 'matchedCardKeys')) return passage;
  const family = familyFor(passage);
  const keys = passage.matchedCardKeys;
  if (!family || !Array.isArray(keys) || keys.length < 2 || new Set(keys).size !== keys.length
    || !keys.every(key => family.members.some(member => member.key === key))) return null;
  if (passage.type === 'court-lineage' && (family.stage === 'alliance' ? keys.length !== 2 : keys.length < 3)) return null;
  const members = keys.map(key => family.members.find(member => member.key === key));
  const complete = members.length === family.members.length;
  const roles = members.map(member => `${member.name}: ${member.role}`).join('; ');
  const stage = passage.type === 'suit-progression' ? SUIT_PROGRESSIONS[family.suit][family.stage] : null;
  const summary = stage?.summary || `Consider the drawn ${family.suit} court figures as symbolic approaches.`;
  const relationship = complete
    ? `Complete symbolic grouping: ${stage?.completeTheme || 'all four court approaches are present; explore how they complement or challenge one another.'}`
    : 'Partial symbolic grouping: relate only these drawn members; absent members supply no theme.';
  const text = `Possible themes — ${summary} ${roles}. ${relationship} Apply the drawn positions and orientations; interpret reversals through the selected framework, without assuming chronological order.${stage ? '' : ' These are symbolic roles; do not infer actual people, family history, or events.'}`;
  const label = family.stage[0].toUpperCase() + family.stage.slice(1);
  const title = `${family.suit} ${stage ? label : `Court ${label}`}`;
  return { ...passage, title, text, archetypalText: text, theme: summary,
    matchedCardKeys: [...keys], isPartialPattern: !complete, visualAnchors: [],
    projectionVersion: 'minor-members-v1', projectionReviewStatus: 'pending' };
}

export function minorMemberNames(keys = []) {
  return keys.map(key => MINOR_ARCANA.find(card => card.name.toLowerCase() === key)).filter(Boolean);
}
