/**
 * Shared class constants for the panels that follow a reading, so they keep
 * one column width and Spread Insights matches Reading Inputs Used.
 */

// The reading text above is capped at max-w-prose, so every panel below it
// shares this narrower column instead of switching between widths.
export const READING_PANEL_COLUMN_CLASS = 'w-full max-w-2xl mx-auto';

// In the built CSS, .panel-mystic's own padding, radius and border come after
// these utilities and win over them.
export const READING_PANEL_CLASS = 'panel-mystic rounded-2xl border border-[color:var(--border-warm-light)] p-[min(1rem,16px)] sm:p-5';

export const READING_PANEL_TITLE_CLASS = 'text-base font-semibold text-main';

// An outline needs no offset colour, so it stays correct on the gradient panel.
export const READING_PANEL_FOCUS_CLASS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring-color)]';

export const READING_PANEL_DISCLOSURE_CLASS = [
  'flex min-h-touch min-w-touch w-full items-center justify-between gap-3 rounded-md text-left',
  READING_PANEL_FOCUS_CLASS,
].join(' ');
