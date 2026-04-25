export const PERSONALIZATION_DISPLAY_NAME_MAX_LENGTH = 50;

export const PERSONALIZATION_REQUEST_FIELDS = Object.freeze([
  'displayName',
  'readingTone',
  'spiritualFrame',
  'tarotExperience',
  'preferredSpreadDepth',
  'focusAreas'
]);

export const PERSONALIZATION_REQUEST_EXPLICIT_FIELDS_KEY = '_explicitFields';

export const NARRATIVE_PERSONALIZATION_DEFAULTS = Object.freeze({
  displayName: '',
  tarotExperience: 'newbie',
  readingTone: 'balanced',
  focusAreas: [],
  preferredSpreadDepth: 'standard',
  spiritualFrame: 'mixed'
});
