export function CupsIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M5 2h14c1.1 0 2 .9 2 2v4c0 3.9-2.6 7.2-6.3 8.2.3.5.3 1.2.3 1.8v2h2c.6 0 1 .4 1 1s-.4 1-1 1H7c-.6 0-1-.4-1-1s.4-1 1-1h2v-2c0-.6 0-1.3.3-1.8C5.6 15.2 3 11.9 3 8V4c0-1.1.9-2 2-2zm14 6V4H5v4c0 3.3 2.7 6 6 6s6-2.7 6-6z" />
    </svg>
  );
}

export function WandsIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M19.6 3.3c-.4-.4-1-.4-1.4 0l-1.8 1.8-1.1-1.1c-.4-.4-1-.4-1.4 0l-1.1 1.1L11 3.3c-.4-.4-1-.4-1.4 0l-1.8 1.8L6.7 4c-.4-.4-1-.4-1.4 0L3.5 5.8c-.4.4-.4 1 0 1.4l1.8 1.8-1.1 1.1c-.4.4-.4 1 0 1.4l1.1 1.1-1.8 1.8c-.4.4-.4 1 0 1.4l1.8 1.8 1.1 1.1c.4.4 1 .4 1.4 0l1.1-1.1 1.8 1.8c.4.4 1 .4 1.4 0l1.8-1.8 1.1 1.1c.4.4 1 .4 1.4 0l1.1-1.1 1.8-1.8c.4-.4.4-1 0-1.4l-1.8-1.8 1.1-1.1c.4-.4.4-1 0-1.4l-1.1-1.1 1.8-1.8c.4-.4.4-1 0-1.4L19.6 3.3z" />
    </svg>
  );
}

export function SwordsIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M20.7 3.3c-.4-.4-1-.4-1.4 0l-7.1 7.1-3.5-3.5c-.4-.4-1-.4-1.4 0l-1.4 1.4c-.4.4-.4 1 0 1.4l2.1 2.1L3.3 16.5c-.4.4-.4 1 0 1.4l2.8 2.8c.4.4 1 .4 1.4 0l4.7-4.7 2.1 2.1c.4.4 1 .4 1.4 0l1.4-1.4c.4-.4.4-1 0-1.4l-3.5-3.5 7.1-7.1c.4-.4.4-1 0-1.4l-.7-.7z" />
    </svg>
  );
}

export function PentaclesIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm-1-13h2l2.5 6-5 3.5-5-3.5 2.5-6z" />
    </svg>
  );
}

export function MajorIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z" />
    </svg>
  );
}

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
    case 'Cups': return CupsIcon;
    case 'Wands': return WandsIcon;
    case 'Swords': return SwordsIcon;
    case 'Pentacles': return PentaclesIcon;
    case 'Major': return MajorIcon;
    default: return null;
  }
}
