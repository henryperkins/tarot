/**
 * Normalize verbose theme sentences (e.g., narrative summaries)
 * into short labels that read cleanly inside questions and chips.
 *
 * @param {string} theme - Raw theme text from journal stats or spread analysis
 * @returns {string} Concise label (or empty string if input is invalid)
 */
export function normalizeThemeLabel(theme) {
  if (!theme || typeof theme !== 'string') return '';

  const trimmed = theme.trim().replace(/\s+/g, ' ').replace(/[。.!?]+$/, '');
  const lower = trimmed.toLowerCase();
  if (/^(all upright|no elemental data available)$/i.test(trimmed)) return '';

  // Labels describe the subject, independent of the card count in each reading.
  const suit = trimmed.match(/^\d+\s+(wands|batons|staves|cups|swords|pentacles|coins|disks)\s+cards?\b/i)?.[1]?.toLowerCase();
  if (suit) {
    if (['wands', 'batons', 'staves'].includes(suit)) return 'Action and creativity';
    if (suit === 'cups') return 'Emotions and relationships';
    if (suit === 'swords') return 'Communication and clarity';
    return 'Practical matters and resources';
  }
  if (lower.startsWith('archetypal energies dominate')) return 'Archetypal themes';

  // Major Arcana density phrases
  if (lower.startsWith('high major arcana')) {
    return 'High Major Arcana (soul-level shifts)';
  }
  if (lower.startsWith('moderate major arcana')) {
    return 'Moderate Major Arcana (archetypal lessons in daily life)';
  }
  if (lower.startsWith('primarily minor arcana')) {
    return 'Primarily Minor Arcana (everyday dynamics)';
  }

  // Suit balance phrasing (every tied suit, e.g. "Wands, Cups, and Swords")
  if (/^balanced focus between\s+/i.test(trimmed)) {
    const match = trimmed.match(/^balanced focus between\s+(.+?),\s+each surfacing/i);
    const suits = match?.[1]?.replace(/,?\s+and\s+/i, ' & ');
    return suits ? `Balanced focus: ${suits}` : 'Balanced suit focus';
  }

  // Elemental balance phrasing
  if (/^balanced elemental presence/i.test(trimmed)) {
    return 'Balanced elemental presence';
  }
  if (/^mixed elemental energies/i.test(trimmed)) {
    return 'Mixed elemental energies';
  }

  const strongElementMatch = trimmed.match(/^strong\s+([a-z]+)\s+emphasis dominates/i);
  if (strongElementMatch) {
    return `${strongElementMatch[1]} emphasis`;
  }

  const dominatesMatch = trimmed.match(/^([a-z]+)\s+energy strongly dominates/i);
  if (dominatesMatch) {
    return `${dominatesMatch[1]} energy dominance`;
  }

  const sharedLeadMatch = trimmed.match(/^(.+?)\s+share the lead\b/i);
  if (sharedLeadMatch) {
    return `${sharedLeadMatch[1].replace(/,?\s+and\s+/i, ' & ')} share the lead`;
  }

  const leadsMatch = trimmed.match(/^([a-z]+)\s+leads/i);
  if (leadsMatch) {
    return `${leadsMatch[1]} leads`;
  }

  // Keep short, custom labels; unfamiliar long prose is not a theme label.
  return trimmed.length <= 100 ? trimmed : '';
}
