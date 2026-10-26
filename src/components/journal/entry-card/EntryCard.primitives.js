/**
 * EntryCard.primitives.js
 * Shared design tokens and style utilities for JournalEntryCard components.
 * Based on theme-swatch.html design system.
 */

import { META_LABEL_CLASS } from '../../../styles/labelClasses';

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT & SUIT MAPPINGS
// ─────────────────────────────────────────────────────────────────────────────

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
  // Sections are regions of one entry, not cards inside it: a hairline and
  // space separate them, and the first sits directly under the entry header.
  section:
    'relative min-w-0 border-t border-(--border-warm-subtle) pt-3 first:mt-0 first:border-t-0 first:pt-0',

  // Every section header is a 44px row, so static and collapsible sections
  // share one rhythm. Labels shrink and wrap so a count or chevron is never
  // pushed out at large text sizes. Headers are size containers: see sectionLabel.
  sectionHeader: 'relative @container flex min-h-touch items-center justify-between gap-3',

  // The hover wash reaches slightly past the text edge, never further than half
  // the entry's side padding (min(1rem,4vw)), so the inset ring is never clipped.
  sectionHeaderClickable:
    'relative @container -mx-[min(0.5rem,2vw)] flex min-h-touch w-[calc(100%+2*min(0.5rem,2vw))] items-center ' +
    'justify-between gap-3 rounded-lg px-[min(0.5rem,2vw)] ' +
    'text-left transition-colors cursor-pointer hover:bg-(--border-warm-subtle) ' +
    'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--focus-ring-color)',

  // When enlarged text leaves a header under 12rem wide (too narrow for a word
  // like REFLECTIONS with its spacing), the label drops its wide spacing and
  // the icon steps aside, so whole words still fit a line. A 320px phone at
  // normal text size stays above it.
  sectionLabel:
    'min-w-0 wrap-anywhere text-2xs font-semibold tracking-label-wide uppercase text-(--text-muted) ' +
    '@max-[12rem]:tracking-normal',

  sectionIcon: 'h-4 w-4 shrink-0 text-(--brand-primary) @max-[12rem]:hidden',

  // Counts beside a section label.
  sectionCount: 'shrink-0 text-xs tabular-nums text-(--text-muted)',

  sectionBody: 'relative pt-2',

  // Pills and chips
  pill:
    'inline-flex items-center gap-2 rounded-full border border-(--border-warm-light) ' +
    `${META_LABEL_CLASS} bg-(--border-warm-subtle) px-2.5 py-1 text-(--text-muted)`,

  cardChip:
    'inline-flex max-w-full items-center gap-1 rounded-full border border-(--border-warm-light) ' +
    'bg-(--panel-dark-2) px-2.5 py-1 text-2xs font-semibold text-(--text-muted)',

  reversedBadge:
    'shrink-0 rounded-full border border-(--border-warm-light) ' +
    'bg-(--panel-dark-2) px-1.5 py-0.5 text-2xs font-semibold text-(--text-muted-high)',

  // Over card artwork: an opaque surface keeps the label readable on any art.
  reversedBadgeSolid:
    'shrink-0 rounded-full border border-(--border-warm) ' +
    'bg-(--bg-surface) px-1.5 py-0.5 text-2xs font-semibold leading-none text-(--text-main) ' +
    'shadow-[0_2px_6px_-2px_rgba(0,0,0,0.5)]',

  uprightBadge:
    'shrink-0 rounded-full border border-(--border-warm-light) px-1.5 py-0.5 text-2xs ' +
    'text-(--text-muted)',

  // Buttons
  iconButton:
    'inline-flex min-h-touch min-w-touch h-11 w-11 items-center justify-center rounded-2xl ' +
    'border border-(--border-warm-light) bg-[linear-gradient(135deg,var(--bg-surface-muted),var(--bg-surface))] ' +
    'text-(--text-muted) shadow-[0_12px_24px_-16px_rgba(0,0,0,0.75)] ' +
    'hover:border-(--border-warm) hover:text-(--brand-accent) hover:-translate-y-px ' +
    'transition-all duration-200 active:translate-y-0 focus-visible:outline-hidden focus-visible:ring-2 ' +
    'focus-visible:ring-(--focus-ring-color)',

  iconButtonCompact:
    'inline-flex min-h-touch min-w-touch h-11 w-11 items-center justify-center rounded-2xl ' +
    'border border-(--border-warm-subtle) bg-(--panel-dark-2) ' +
    'text-(--text-muted) hover:bg-(--border-warm-subtle) ' +
    'hover:text-(--brand-accent) transition focus-visible:outline-hidden ' +
    'focus-visible:ring-2 focus-visible:ring-(--focus-ring-color) shrink-0',

  actionButton:
    'inline-flex min-h-touch items-center justify-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ' +
    'transition focus-visible:outline-hidden focus-visible:ring-2 ' +
    'focus-visible:ring-(--focus-ring-color)',

  actionButtonEnabled:
    'border-(--border-warm-light) bg-(--border-warm-subtle) ' +
    'text-(--text-main) hover:border-(--border-warm) ' +
    'hover:bg-(--border-warm-light)',

  actionButtonDisabled:
    'border-(--border-warm-subtle) bg-(--border-warm-subtle) ' +
    'text-(--text-muted) cursor-not-allowed opacity-70',

  // Cards
  // No `group` here: hover inside an open entry must not restyle its parts.
  cardBase:
    'relative overflow-hidden text-(--text-main) transition-[translate,border-color] duration-(--duration-medium) ease-(--ease-out) animate-fade-in ' +
    'before:absolute before:inset-0 before:bg-[linear-gradient(120deg,var(--border-warm-subtle),transparent_45%)] ' +
    'before:opacity-70 before:pointer-events-none before:content-[""]',

  // Collapsed entries only: a small lift and a warmer edge mark them as openable.
  cardHover:
    'hover:border-(--border-warm) motion-safe:hover:-translate-y-0.5',

  cardCompact:
    'rounded-2xl border border-(--border-warm-light) bg-[linear-gradient(160deg,var(--bg-surface),var(--bg-main))] ' +
    'shadow-[0_14px_32px_-20px_rgba(0,0,0,0.7)] hover:bg-(--border-warm-subtle)',

  // Accent bar
  accentBar: 'absolute left-0 w-1 rounded-full opacity-80',
  accentBarDefault: 'top-3 bottom-3',
  accentBarCompact: 'top-2 bottom-2 w-[3px]',

  // Menu
  menu:
    'fixed z-toast w-72 max-w-[calc(100vw-16px)] max-h-[75vh] overflow-y-auto rounded-2xl ' +
    'border border-(--border-warm) bg-(--bg-main) p-2 ' +
    'shadow-[0_18px_60px_-34px_rgba(0,0,0,0.95)]',

  menuItem:
    'flex min-h-touch w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ' +
    'transition-colors focus-visible:outline-hidden focus-visible:ring-2 ' +
    'disabled:opacity-60 disabled:cursor-not-allowed',

  menuItemDefault:
    'text-(--text-main) hover:bg-(--border-warm-subtle) ' +
    'focus-visible:ring-(--focus-ring-color)',

  menuItemDanger:
    'text-(--status-error) hover:bg-[color-mix(in_srgb,var(--status-error)_12%,transparent)] ' +
    'focus-visible:ring-[color-mix(in_srgb,var(--status-error)_45%,transparent)]',

  // Follow-up turns: separated by a hairline, not boxed inside the entry.
  turnCard: 'border-t border-(--border-warm-subtle) pt-3 first:border-t-0 first:pt-0',

  // Divider
  divider: 'my-4 h-px bg-(--border-warm-subtle)'
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get suit accent color CSS variable
 */
export function getSuitAccentVar(suitName) {
  const lower = (suitName || '').toLowerCase();
  if (lower.includes('wands') || lower.includes('staves') || lower.includes('rods')) {
    return 'var(--color-wands)';
  }
  if (lower.includes('cups') || lower.includes('chalices')) return 'var(--color-cups)';
  if (lower.includes('swords') || lower.includes('blades')) return 'var(--color-swords)';
  if (lower.includes('pentacles') || lower.includes('coins') || lower.includes('disks')) {
    return 'var(--color-pentacles)';
  }
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
