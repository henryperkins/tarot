// Shared definitions for Visual Semantic Profiling
// These anchors are used to translate raw image vectors into narrative-ready descriptors.

export const VISUAL_TONE_ANCHORS = {
  brightness: [
    { label: 'bright', text: 'A bright, high-key image filled with light' },
    { label: 'shadowy', text: 'A dark, low-key image filled with shadows' }
  ],
  saturation: [
    { label: 'vibrant', text: 'A vibrant, highly saturated colorful image' },
    { label: 'muted', text: 'A desaturated, muted, or monochromatic image' }
  ],
  complexity: [
    { label: 'minimalist', text: 'A simple, minimalist image with empty space' },
    { label: 'intricate', text: 'A complex, detailed, busy image' }
  ],
  style: [
    { label: 'traditional', text: 'A classic, traditional woodcut or line art style' },
    { label: 'modern', text: 'A modern, digital, or photographic style' },
    { label: 'abstract', text: 'An abstract, symbolic, or surreal image' }
  ]
};

export const VISUAL_EMOTION_ANCHORS = [
  { label: 'peaceful', text: 'A peaceful, calm, and serene atmosphere' },
  { label: 'chaotic', text: 'A chaotic, turbulent, and intense atmosphere' },
  { label: 'joyful', text: 'A joyful, celebratory, and positive atmosphere' },
  { label: 'melancholic', text: 'A sad, melancholic, or heavy atmosphere' },
  { label: 'mysterious', text: 'A mysterious, esoteric, and hidden atmosphere' },
  { label: 'direct', text: 'A clear, direct, and revealing atmosphere' }
];

/**
 * Select the top matching descriptors from a set of scores.
 * @param {Object} scores - Map of label -> similarity score
 * @param {number} threshold - Minimum similarity to be considered relevant
 * @returns {Array<string>} List of relevant descriptors
 */
export function selectTopDescriptors(scores, threshold = 0.2) {
  return Object.entries(scores)
    .filter(([_, score]) => score >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([label]) => label);
}
