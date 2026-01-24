import { CupsIcon, WandsIcon, SwordsIcon, PentaclesIcon, MajorIcon } from './SuitIcons';

/**
 * Detect suit from card name string
 * @param {string} cardName - e.g. "Three of Cups", "The Fool"
 * @returns {'Cups'|'Wands'|'Swords'|'Pentacles'|'Major'|null}
 */
export function getSuitFromCardName(cardName) {
  if (!cardName || typeof cardName !== 'string') return null;
  const name = cardName.toLowerCase();
  if (name.includes(' of cups')) return 'Cups';
  if (name.includes(' of wands')) return 'Wands';
  if (name.includes(' of swords')) return 'Swords';
  if (name.includes(' of pentacles')) return 'Pentacles';
  // Major Arcana - no "of" in name
  if (!name.includes(' of ')) return 'Major';
  return null;
}

/**
 * Get the appropriate SuitIcon component for a card
 * @param {string|object} cardOrName - Card name string or card object with .name/.suit
 * @returns {Function|null} React component
 */
export function getSuitIcon(cardOrName) {
  const name = typeof cardOrName === 'string' ? cardOrName : cardOrName?.name;
  const explicitSuit = typeof cardOrName === 'object' ? cardOrName?.suit : null;
  const suit = explicitSuit || getSuitFromCardName(name);

  switch (suit) {
    case 'Cups':
      return CupsIcon;
    case 'Wands':
      return WandsIcon;
    case 'Swords':
      return SwordsIcon;
    case 'Pentacles':
      return PentaclesIcon;
    case 'Major':
      return MajorIcon;
    default:
      return null;
  }
}
