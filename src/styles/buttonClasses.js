/**
 * Shared button class constants for consistent styling across components.
 */

export const OUTLINE_BUTTON_CLASS = [
  'inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10',
  'min-h-touch px-4 py-2 text-xs font-semibold text-main',
  'shadow-[0_12px_30px_-18px_rgb(var(--brand-primary-rgb)/0.65)]',
  'transition-[colors,box-shadow,border-color,background-color] duration-200',
  'hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-18px_rgb(var(--brand-primary-rgb)/0.85)] hover:border-primary/60',
  'active:translate-y-0 active:scale-[0.98]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0',
  'disabled:hover:translate-y-0 disabled:hover:shadow-[0_12px_30px_-18px_rgb(var(--brand-primary-rgb)/0.65)]',
].join(' ');
