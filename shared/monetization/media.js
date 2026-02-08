import { normalizeTier } from './subscription.js';
import { VIDEO_STYLE_IDS } from '../vision/videoStyles.js';

export const STORY_ART_STYLE_IDS = ['watercolor', 'nouveau', 'minimal', 'stained-glass', 'cosmic'];
export const STORY_ART_FORMAT_IDS = ['triptych', 'single', 'panoramic', 'vignette'];

function dedupeStringList(values, fallback = []) {
  if (!Array.isArray(values) || values.length === 0) return [...fallback];
  const normalized = values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

function resolveProCardVideoStyles(availableStyles) {
  return dedupeStringList(availableStyles, VIDEO_STYLE_IDS);
}

function resolveProStoryArtStyles(availableStyles) {
  return dedupeStringList(availableStyles, STORY_ART_STYLE_IDS);
}

function resolveProStoryArtFormats(availableFormats) {
  return dedupeStringList(availableFormats, STORY_ART_FORMAT_IDS);
}

export function getCardVideoLimits(tier, { availableStyles = VIDEO_STYLE_IDS } = {}) {
  const normalizedTier = normalizeTier(tier);
  const proStyles = resolveProCardVideoStyles(availableStyles);

  if (normalizedTier === 'pro') {
    return {
      enabled: true,
      maxPerDay: 50,
      maxSeconds: 8,
      styles: proStyles
    };
  }

  if (normalizedTier === 'plus') {
    return {
      enabled: true,
      maxPerDay: 20,
      maxSeconds: 4,
      styles: ['mystical']
    };
  }

  return {
    enabled: false,
    maxPerDay: 0,
    maxSeconds: 0,
    styles: []
  };
}

export function getStoryArtLimits(
  tier,
  { availableStyles = STORY_ART_STYLE_IDS, availableFormats = STORY_ART_FORMAT_IDS } = {}
) {
  const normalizedTier = normalizeTier(tier);
  const proStyles = resolveProStoryArtStyles(availableStyles);
  const proFormats = resolveProStoryArtFormats(availableFormats);

  if (normalizedTier === 'pro') {
    return {
      enabled: true,
      maxPerDay: 20,
      quality: 'medium',
      styles: proStyles,
      formats: proFormats
    };
  }

  if (normalizedTier === 'plus') {
    return {
      enabled: true,
      maxPerDay: 3,
      quality: 'low',
      styles: ['watercolor'],
      formats: ['single']
    };
  }

  return {
    enabled: false,
    maxPerDay: 0,
    quality: 'low',
    styles: [],
    formats: []
  };
}

export function getMediaTierConfig(
  tier,
  {
    cardVideoStyles = VIDEO_STYLE_IDS,
    storyArtStyles = STORY_ART_STYLE_IDS,
    storyArtFormats = STORY_ART_FORMAT_IDS
  } = {}
) {
  return {
    cardVideo: getCardVideoLimits(tier, { availableStyles: cardVideoStyles }),
    storyArt: getStoryArtLimits(tier, {
      availableStyles: storyArtStyles,
      availableFormats: storyArtFormats
    }),
    gallery: {
      enabled: normalizeTier(tier) !== 'free'
    }
  };
}

