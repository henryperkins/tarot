/**
 * How long a reading's share link stays open. The choices match Export &
 * Share; a single reading defaults to a week rather than forever.
 */
export const SHARE_LINK_EXPIRY_OPTIONS = Object.freeze([
  Object.freeze({ hours: 24, label: '24 hours' }),
  Object.freeze({ hours: 168, label: '7 days' }),
  Object.freeze({ hours: 720, label: '30 days' }),
  Object.freeze({ hours: null, label: 'No expiry' })
]);

export const DEFAULT_SHARE_LINK_EXPIRY_HOURS = 168;

/** How long a new link stays open, as a sentence for status messages. */
export function describeShareLinkExpiry(hours) {
  const option = SHARE_LINK_EXPIRY_OPTIONS.find(item => item.hours === hours);
  if (!option || option.hours === null) return 'It stays open until you delete it.';
  return `It stops opening in ${option.label}.`;
}
