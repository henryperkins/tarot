/**
 * ThemeIcons - Custom SVG icons for journal themes
 *
 * Icons representing common tarot reading themes:
 * - Relationships (intertwined hands)
 * - Growth (sprouting plant)
 * - Transition (bridge/doorway)
 * - Abundance (overflowing cup)
 * - Challenge (mountain peak)
 * - Healing (heart with bandage)
 * - Clarity (eye with rays)
 * - Balance (scales)
 * - Creativity (paintbrush/spark)
 * - Intuition (third eye)
 */

function RelationshipsIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      {/* Two intertwined hands forming a heart shape */}
      <path d="M12 4.5C7 4.5 2.7 7.6 1 12c1.7 4.4 6 7.5 11 7.5s9.3-3.1 11-7.5c-1.7-4.4-6-7.5-11-7.5zm0 12.5c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z" opacity="0.3" />
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

function GrowthIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      {/* Sprouting plant from soil */}
      <path d="M12 20c-4.4 0-8-3.6-8-8 0-3.5 2.3-6.5 5.5-7.6.5-.2 1-.2 1.5 0C14.2 5.5 16.5 8.5 16.5 12c0 4.4-3.6 8-8 8zm0-14c-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6-2.7-6-6-6z" opacity="0.3" />
      <path d="M12 2C8 2 5 5 5 9c0 2.5 1.3 4.7 3.3 6H4v2h16v-2h-4.3c2-1.3 3.3-3.5 3.3-6 0-4-3-7-7-7zm0 2c2.8 0 5 2.2 5 5 0 2.2-1.5 4.2-3.5 4.8V10c1.4-.3 2.5-1.5 2.5-3 0-1.7-1.3-3-3-3s-3 1.3-3 3c0 1.5 1.1 2.7 2.5 3v3.8C9.5 13.2 8 11.2 8 9c0-2.8 2.2-5 5-5z" />
      <path d="M12 18v4M12 22l-2-2M12 22l2-2" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function TransitionIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      {/* Doorway/portal opening */}
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z" />
      <path d="M9 7h6v10H9z" opacity="0.3" />
      <path d="M12 11l3 3-3 3v-2H9v-2h3v-2z" />
    </svg>
  );
}

function AbundanceIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      {/* Overflowing cup/vessel */}
      <path d="M5 2h14c1.1 0 2 .9 2 2v4c0 3.9-2.6 7.2-6.3 8.2.3.5.3 1.2.3 1.8v2h2c.6 0 1 .4 1 1s-.4 1-1 1H7c-.6 0-1-.4-1-1s.4-1 1-1h2v-2c0-.6 0-1.3.3-1.8C5.6 15.2 3 11.9 3 8V4c0-1.1.9-2 2-2z" />
      <path d="M19 8V4H5v4c0 3.3 2.7 6 6 6s6-2.7 6-6z" opacity="0.3" />
      {/* Overflow sparkles */}
      <circle cx="7" cy="3" r="1" />
      <circle cx="17" cy="2" r="1" />
      <circle cx="12" cy="1" r="1" />
    </svg>
  );
}

function ChallengeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      {/* Mountain peak with flag */}
      <path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z" />
      <path d="M7 10l4.5 6H2l5-6z" opacity="0.3" />
      {/* Flag at summit */}
      <path d="M14 4V2h-1v6h1V6l2-1-2-1z" />
    </svg>
  );
}

function HealingIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      {/* Heart with healing cross */}
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" opacity="0.3" />
      <path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z" />
      {/* Healing cross */}
      <path d="M11 8h2v3h3v2h-3v3h-2v-3H8v-2h3V8z" fill="currentColor" />
    </svg>
  );
}

function ClarityIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      {/* Eye with radiating light */}
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5z" opacity="0.3" />
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
      {/* Light rays */}
      <circle cx="12" cy="12" r="1.5" />
    </svg>
  );
}

function BalanceIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      {/* Balance scales */}
      <path d="M12 3v18M12 3L4 9l8-1M12 3l8 6-8-1" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="4" cy="11" r="3" opacity="0.3" />
      <circle cx="20" cy="11" r="3" opacity="0.3" />
      <path d="M4 8c-1.66 0-3 1.34-3 3v2h6v-2c0-1.66-1.34-3-3-3zM20 8c-1.66 0-3 1.34-3 3v2h6v-2c0-1.66-1.34-3-3-3z" />
    </svg>
  );
}

function CreativityIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      {/* Paintbrush with sparkle */}
      <path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3z" />
      <path d="M20.71 4.63l-1.34-1.34c-.39-.39-1.02-.39-1.41 0L9 12.25 11.75 15l8.96-8.96c.39-.39.39-1.02 0-1.41z" />
      <path d="M9 12.25L11.75 15l-2.75.75.75-2.75z" opacity="0.3" />
      {/* Sparkle */}
      <path d="M19 9l.94-2.06L22 6l-2.06-.94L19 3l-.94 2.06L16 6l2.06.94z" />
    </svg>
  );
}

function IntuitionIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      {/* Third eye / inner vision */}
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
      <circle cx="12" cy="12" r="4" opacity="0.3" />
      <circle cx="12" cy="12" r="2" />
      {/* Third eye symbol */}
      <path d="M12 6c-3 0-5.5 2-6.5 4.5.3.7.7 1.3 1.2 1.9C7.5 9.7 9.5 8 12 8s4.5 1.7 5.3 4.4c.5-.6.9-1.2 1.2-1.9C17.5 8 15 6 12 6z" />
    </svg>
  );
}

function DefaultThemeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      {/* Generic sparkle/star */}
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" opacity="0.3" />
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6L12 2zm0 4.2l-1.5 4.6H6.2l3.5 2.5-1.3 4.2L12 15l3.6 2.5-1.3-4.2 3.5-2.5h-4.3L12 6.2z" />
    </svg>
  );
}

/**
 * Maps a theme label to its corresponding icon component
 * @param {string} theme - The theme label (e.g., "Relationships", "Growth")
 * @returns {Function} The icon component
 */
function resolveThemeIcon(theme) {
  if (!theme) return DefaultThemeIcon;

  const normalized = theme.toLowerCase().trim();

  // Direct matches
  const directMatches = {
    'relationships': RelationshipsIcon,
    'relationship': RelationshipsIcon,
    'love': RelationshipsIcon,
    'growth': GrowthIcon,
    'personal growth': GrowthIcon,
    'self-growth': GrowthIcon,
    'transition': TransitionIcon,
    'change': TransitionIcon,
    'transformation': TransitionIcon,
    'abundance': AbundanceIcon,
    'prosperity': AbundanceIcon,
    'wealth': AbundanceIcon,
    'challenge': ChallengeIcon,
    'challenges': ChallengeIcon,
    'obstacle': ChallengeIcon,
    'obstacles': ChallengeIcon,
    'healing': HealingIcon,
    'recovery': HealingIcon,
    'health': HealingIcon,
    'clarity': ClarityIcon,
    'insight': ClarityIcon,
    'understanding': ClarityIcon,
    'balance': BalanceIcon,
    'harmony': BalanceIcon,
    'equilibrium': BalanceIcon,
    'creativity': CreativityIcon,
    'creative': CreativityIcon,
    'artistic': CreativityIcon,
    'intuition': IntuitionIcon,
    'inner wisdom': IntuitionIcon,
    'spiritual': IntuitionIcon
  };

  if (directMatches[normalized]) {
    return directMatches[normalized];
  }

  // Partial matches for common theme keywords
  if (normalized.includes('relationship') || normalized.includes('love') || normalized.includes('heart')) {
    return RelationshipsIcon;
  }
  if (normalized.includes('growth') || normalized.includes('develop') || normalized.includes('evolv')) {
    return GrowthIcon;
  }
  if (normalized.includes('change') || normalized.includes('transition') || normalized.includes('transform')) {
    return TransitionIcon;
  }
  if (normalized.includes('abundan') || normalized.includes('prosper') || normalized.includes('wealth')) {
    return AbundanceIcon;
  }
  if (normalized.includes('challeng') || normalized.includes('obstacl') || normalized.includes('difficult')) {
    return ChallengeIcon;
  }
  if (normalized.includes('heal') || normalized.includes('recover') || normalized.includes('wellbeing')) {
    return HealingIcon;
  }
  if (normalized.includes('clarity') || normalized.includes('insight') || normalized.includes('understand')) {
    return ClarityIcon;
  }
  if (normalized.includes('balance') || normalized.includes('harmon') || normalized.includes('equilib')) {
    return BalanceIcon;
  }
  if (normalized.includes('creativ') || normalized.includes('artist') || normalized.includes('inspir')) {
    return CreativityIcon;
  }
  if (normalized.includes('intuit') || normalized.includes('inner') || normalized.includes('spirit')) {
    return IntuitionIcon;
  }

  return DefaultThemeIcon;
}

/**
 * Component that renders the icon for a given theme
 */
export function ThemeIcon({ theme, ...props }) {
  const Icon = resolveThemeIcon(theme);
  return <Icon {...props} />;
}
