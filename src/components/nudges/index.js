/**
 * Contextual Nudge Components
 *
 * These nudges support the "contextual discovery" philosophy of the trimmed
 * onboarding flow. Instead of front-loading education, they appear at natural
 * moments when features become relevant.
 *
 * Trigger points:
 * - RitualNudge: First reading, after spread confirmed, before shuffle
 * - JournalNudge: First reading, after narrative completes
 * - AccountNudge: After 3rd journal save, if not authenticated
 */

export { RitualNudge } from './RitualNudge';
export { JournalNudge } from './JournalNudge';
export { AccountNudge } from './AccountNudge';
