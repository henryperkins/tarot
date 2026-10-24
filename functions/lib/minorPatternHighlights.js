import { SUIT_PROGRESSIONS } from '../../src/data/knowledgeGraphData.js';
import { MINOR_ARCANA } from '../../src/data/minorArcana.js';
import { getDeckAlias } from '../../shared/vision/deckAssets.js';
import { groupGraphCardIdentities } from './graphCardMembership.js';

/** A stage is a symbolic grouping of actual members, never a biography or forecast. */
export function renderSuitProgressionHighlight(progression, { deckStyle = 'rws-1909' } = {}) {
  const stage = SUIT_PROGRESSIONS[progression?.suit]?.[progression?.stage];
  if (!stage) return null;
  const members = groupGraphCardIdentities(progression.stageCards, { deckStyle }).members
    .filter(member => stage.cards.some(authored => authored.name.toLowerCase() === member.canonicalKey));
  if (members.length < 2) return null;
  const roles = members.map(member => {
    const authored = stage.cards.find(card => card.name.toLowerCase() === member.canonicalKey);
    const catalog = MINOR_ARCANA.find(card => card.name === authored.name);
    const label = getDeckAlias(catalog, deckStyle);
    const orientation = member.card.orientation === 'Reversed' ? 'Reversed' : 'Upright';
    return `${label} (${orientation}): ${authored.role}`;
  });
  const complete = members.length === stage.cards.length;
  const relationship = complete ? `Complete symbolic grouping: ${stage.completeTheme}`
    : 'Partial symbolic grouping: relate only these drawn members; absent members supply no theme.';
  return {
    text: `Possible themes — ${stage.summary} ${roles.join('; ')}. ${relationship} Apply the drawn positions and orientations; interpret reversals through the selected framework, without assuming chronological order.`,
    matchedCardKeys: members.map(member => member.canonicalKey),
    matchedCardIndices: [...(progression.matchedCardIndices || [])],
    suit: progression.suit,
    stage: progression.stage,
    isComplete: complete
  };
}
