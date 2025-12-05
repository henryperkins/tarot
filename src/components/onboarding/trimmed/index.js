/**
 * Trimmed Onboarding Components
 *
 * 4-step streamlined onboarding flow for the A/B test variant.
 * Reduces friction by deferring account setup, ritual intro,
 * and journal intro to contextual nudges.
 *
 * Target completion time: 50-75 seconds (vs 120-180s for 7-step)
 */

export { WelcomeStep } from './WelcomeStep';
export { SpreadStep } from './SpreadStep';
export { IntentionStep } from './IntentionStep';
export { BeginStep } from './BeginStep';

/**
 * Step configuration for the trimmed onboarding variant
 */
export const TRIMMED_STEPS = [
  { key: 'welcome', Component: null },    // Will be set dynamically
  { key: 'spread', Component: null },
  { key: 'intention', Component: null },
  { key: 'begin', Component: null }
];
