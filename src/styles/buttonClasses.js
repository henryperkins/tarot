/**
 * Shared button class constants for consistent styling across components.
 */

export const OUTLINE_BUTTON_CLASS = [
  'inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10',
  'min-h-touch px-4 py-2 text-xs-plus font-semibold text-main',
  'shadow-[0_12px_30px_-18px_rgb(var(--brand-primary-rgb)/0.65)]',
  'transition-[colors,box-shadow,border-color,background-color] duration-200',
  'hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-18px_rgb(var(--brand-primary-rgb)/0.85)] hover:border-primary/60',
  'active:translate-y-0 active:scale-[0.98]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0',
  'disabled:hover:translate-y-0 disabled:hover:shadow-[0_12px_30px_-18px_rgb(var(--brand-primary-rgb)/0.65)]',
].join(' ');

export const PANEL_OUTLINE_BUTTON_CLASS = [
  'flex items-center gap-1.5 px-4 py-2.5 min-h-touch rounded-lg text-sm font-medium',
  'border border-[color:var(--border-warm-light)] text-[color:var(--text-muted-high)] bg-[color:var(--border-warm-subtle)]',
  'hover:bg-[color:var(--border-warm-light)] hover:border-[color:var(--border-warm)]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]',
  'transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation',
].join(' ');

export const JOURNEY_PRIMARY_BUTTON_CLASS = [
  'flex items-center gap-2 px-4 py-2.5 min-h-touch rounded-xl text-sm font-medium',
  'bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 text-main',
  'hover:from-primary/30 hover:to-primary/20 hover:border-primary/40',
  'shadow-[0_8px_20px_-10px_rgb(var(--brand-primary-rgb)/0.4)]',
  'transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]',
  'disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation',
].join(' ');

export const COMPACT_SYNC_ACTION_BUTTON_CLASS = [
  'flex items-center gap-1.5 min-h-touch px-3 py-2 text-xs sm:text-2xs font-medium',
  'text-muted-high hover:text-main',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]',
  'disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation',
].join(' ');
