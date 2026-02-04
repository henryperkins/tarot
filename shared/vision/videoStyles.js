// Shared cinematic video style metadata for UI + backend alignment.

export const VIDEO_STYLE_PRESETS = [
  { id: 'mystical', label: 'Mystical', description: 'Ethereal, dreamlike atmosphere' },
  { id: 'classic', label: 'Classic', description: 'Timeless cinematic drama' },
  { id: 'modern', label: 'Modern', description: 'Clean, contemporary visual style' },
  { id: 'cosmic', label: 'Cosmic', description: 'Otherworldly space atmosphere' }
];

export const VIDEO_STYLE_IDS = VIDEO_STYLE_PRESETS.map((style) => style.id);
export const DEFAULT_VIDEO_STYLE = 'mystical';
