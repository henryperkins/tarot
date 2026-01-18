/**
 * EntryCard.primitives.js
 * Shared design tokens and style utilities for JournalEntryCard components.
 * Based on theme-swatch.html design system.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT & SUIT MAPPINGS
// ─────────────────────────────────────────────────────────────────────────────

export const CONTEXT_SUMMARIES = {
  love: 'Relationship lens — center relational reciprocity and communication.',
  career: 'Career lens — focus on vocation, impact, and material pathways.',
  self: 'Self lens — emphasize personal growth and inner landscape.',
  spiritual: 'Spiritual lens — frame insights through devotion, meaning, and practice.',
  decision: 'Decision lens — weigh the tradeoffs and clarify what aligns before choosing a path.'
};

export const TIMING_SUMMARIES = {
  'near-term-tilt': 'Timing: energy is likely to shift in the near-term if you engage with it.',
  'longer-arc-tilt': 'Timing: this pattern stretches over a longer arc demanding patience.',
  'developing-arc': 'Timing: expect this to develop as an unfolding chapter, not a single moment.'
};

export const CONTEXT_ACCENTS = {
  love: 'var(--brand-primary)',
  career: 'var(--color-pentacles)',
  self: 'var(--brand-accent)',
  spiritual: 'var(--color-wands)',
  wellbeing: 'var(--color-cups)',
  decision: 'var(--color-swords)',
  default: 'var(--brand-primary)'
};

// ─────────────────────────────────────────────────────────────────────────────
// LIMITS & CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_SHARE_LINKS_IN_MENU = 6;

export const FOLLOW_UP_LIMITS = {
  free: 1,
  plus: 3,
  pro: 10
};

// ─────────────────────────────────────────────────────────────────────────────
// STYLE TOKENS (from theme-swatch.html)
// ─────────────────────────────────────────────────────────────────────────────

export const styles = {
  // Section containers
  section:
    'relative overflow-hidden rounded-2xl border border-[color:rgba(255,255,255,0.08)] ' +
    'bg-[linear-gradient(180deg,rgba(14,13,22,0.95),rgba(10,10,18,0.98))] ' +
    'shadow-[0_18px_40px_-28px_rgba(0,0,0,0.8)] ' +
    'before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_55%)] ' +
    'before:opacity-70 before:pointer-events-none before:content-[""]',

  sectionHeader:
    'relative z-10 flex items-center justify-between gap-3 px-4 py-3 border-b border-[color:rgba(255,255,255,0.07)] ' +
    'bg-[color:rgba(9,9,16,0.55)] backdrop-blur',

  sectionHeaderClickable:
    'relative z-10 flex items-center justify-between gap-3 px-4 py-3 border-b border-[color:rgba(255,255,255,0.07)] ' +
    'w-full text-left bg-[color:rgba(9,9,16,0.55)] hover:bg-[color:rgba(255,255,255,0.05)] ' +
    'transition cursor-pointer backdrop-blur',

  sectionLabel:
    'text-[11px] font-semibold tracking-[0.28em] uppercase text-[color:var(--text-muted)]',

  sectionBody: 'relative z-10 px-4 py-4',

  // Pills and chips
  pill:
    'inline-flex items-center gap-2 rounded-full border border-[color:rgba(255,255,255,0.14)] ' +
    'bg-[color:rgba(255,255,255,0.06)] px-2.5 py-1 text-[10px] tracking-[0.22em] uppercase ' +
    'text-[color:var(--text-muted)] shadow-[0_10px_20px_-18px_rgba(0,0,0,0.7)]',

  cardChip:
    'inline-flex max-w-full items-center gap-1 rounded-full border border-[color:rgba(255,255,255,0.12)] ' +
    'bg-[color:rgba(8,9,16,0.55)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--text-muted)] ' +
    'shadow-[0_12px_22px_-18px_rgba(0,0,0,0.7)]',

  reversedBadge:
    'flex-shrink-0 rounded-full border border-[color:color-mix(in_srgb,var(--status-error)_45%,transparent)] ' +
    'bg-[color:color-mix(in_srgb,var(--status-error)_12%,transparent)] px-1.5 py-0.5 text-[10px] ' +
    'font-semibold text-[color:var(--status-error)]',

  uprightBadge:
    'flex-shrink-0 rounded-full border border-[color:rgba(255,255,255,0.12)] px-1.5 py-0.5 text-[10px] ' +
    'text-[color:var(--text-muted)]',

  // Buttons
  iconButton:
    'inline-flex min-h-[44px] min-w-[44px] h-11 w-11 items-center justify-center rounded-2xl ' +
    'border border-[color:rgba(255,255,255,0.14)] bg-[linear-gradient(135deg,rgba(20,19,32,0.9),rgba(12,12,20,0.95))] ' +
    'text-[color:var(--text-muted)] shadow-[0_12px_24px_-16px_rgba(0,0,0,0.75)] ' +
    'hover:border-[color:rgba(255,255,255,0.2)] hover:text-[color:var(--brand-accent)] hover:translate-y-[-1px] ' +
    'transition-all duration-200 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-[color:rgba(232,218,195,0.45)]',

  iconButtonCompact:
    'inline-flex min-h-[44px] min-w-[44px] h-11 w-11 items-center justify-center rounded-2xl ' +
    'border border-[color:rgba(255,255,255,0.08)] bg-[color:rgba(12,12,20,0.55)] ' +
    'text-[color:var(--text-muted)] hover:bg-[color:rgba(255,255,255,0.06)] ' +
    'hover:text-[color:var(--brand-accent)] transition focus-visible:outline-none ' +
    'focus-visible:ring-2 focus-visible:ring-[color:rgba(232,218,195,0.45)] flex-shrink-0',

  actionButton:
    'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold ' +
    'transition focus-visible:outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-[color:rgba(232,218,195,0.45)]',

  actionButtonEnabled:
    'border-[color:rgba(255,255,255,0.14)] bg-[color:rgba(255,255,255,0.06)] ' +
    'text-[color:var(--text-main)] hover:border-[color:rgba(255,255,255,0.24)] ' +
    'hover:bg-[color:rgba(255,255,255,0.1)]',

  actionButtonDisabled:
    'border-[color:rgba(255,255,255,0.08)] bg-[color:rgba(255,255,255,0.03)] ' +
    'text-[color:var(--text-muted)] cursor-not-allowed opacity-70',

  // Cards
  cardBase:
    'group relative overflow-hidden text-[color:var(--text-main)] transition-all duration-300 animate-fade-in ' +
    'before:absolute before:inset-0 before:bg-[linear-gradient(120deg,rgba(255,255,255,0.05),transparent_45%)] ' +
    'before:opacity-70 before:pointer-events-none before:content-[""]',

  cardHover:
    'hover:translate-y-[-2px] hover:shadow-[0_30px_80px_-38px_rgba(0,0,0,0.95)]',

  cardCompact:
    'rounded-2xl border border-amber-200/12 bg-[linear-gradient(160deg,rgba(15,17,34,0.98),rgba(9,10,18,0.98))] ' +
    'shadow-[0_14px_32px_-20px_rgba(0,0,0,0.7)] hover:bg-[color:rgba(255,255,255,0.03)]',

  // Accent bar
  accentBar: 'absolute left-0 w-1 rounded-full opacity-80 shadow-[0_0_12px_rgba(255,255,255,0.2)]',
  accentBarDefault: 'top-3 bottom-3',
  accentBarCompact: 'top-2 bottom-2 w-[3px]',

  // Menu
  menu:
    'fixed z-[200] w-72 max-h-[75vh] overflow-y-auto rounded-2xl ' +
    'border border-[color:var(--border-warm)] bg-[color:rgba(10,10,14,0.96)] p-2 ' +
    'shadow-[0_18px_60px_-34px_rgba(0,0,0,0.95)]',

  menuItem:
    'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ' +
    'transition-colors focus-visible:outline-none focus-visible:ring-2 ' +
    'disabled:opacity-60 disabled:cursor-not-allowed',

  menuItemDefault:
    'text-[color:var(--text-main)] hover:bg-[color:rgba(255,255,255,0.06)] ' +
    'focus-visible:ring-[color:rgba(232,218,195,0.45)]',

  menuItemDanger:
    'text-[color:var(--status-error)] hover:bg-[color:color-mix(in_srgb,var(--status-error)_12%,transparent)] ' +
    'focus-visible:ring-[color:color-mix(in_srgb,var(--status-error)_45%,transparent)]',

  // Follow-up turn card
  turnCard:
    'rounded-2xl border border-[color:rgba(255,255,255,0.1)] bg-[color:rgba(9,10,18,0.6)] ' +
    'p-3 shadow-[0_16px_32px_-24px_rgba(0,0,0,0.8)]',

  // Divider
  divider: 'my-4 h-px bg-[color:rgba(255,255,255,0.06)]'
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get suit accent color CSS variable
 */
export function getSuitAccentVar(suitName) {
  const lower = (suitName || '').toLowerCase();
  if (lower.includes('wands')) return 'var(--color-wands)';
  if (lower.includes('cups')) return 'var(--color-cups)';
  if (lower.includes('swords')) return 'var(--color-swords)';
  if (lower.includes('pentacles')) return 'var(--color-pentacles)';
  return null;
}

/**
 * Get accent color for an entry based on suit or context
 */
export function getEntryAccentColor(entry) {
  return (
    getSuitAccentVar(entry?.themes?.dominantSuit) ||
    CONTEXT_ACCENTS[entry?.context] ||
    CONTEXT_ACCENTS.default
  );
}

/**
 * Combine class names, filtering falsy values
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
