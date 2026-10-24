/**
 * Shared type roles for small uppercase labels (the DESIGN.md "label" role).
 *
 * A label names a field, column, stat or badge, or a section that has no
 * other heading. It is not a kicker above a heading. Callers add colour and
 * spacing. For the spaced coach, journal, ritual and share voice, pair the
 * same size with `tracking-label-wide` instead.
 */

// 12px semibold: section, field and column labels.
export const LABEL_CLASS = 'text-xs font-semibold uppercase tracking-label';

// 11px regular: metadata captions, such as card positions and stat names.
export const META_LABEL_CLASS = 'text-2xs uppercase tracking-label';

// 11px semibold: text set inside pills, chips and count badges.
export const BADGE_LABEL_CLASS = 'text-2xs font-semibold uppercase tracking-label';
