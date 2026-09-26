import { CheckCircle, Lightbulb, PencilSimpleLine, Sparkle } from '@phosphor-icons/react';

// One drawn icon per question-quality level, shared by every surface that shows
// the score, so the badge reads the same everywhere and never falls back to
// platform emoji.
const LEVEL_ICONS = {
  excellent: Sparkle,
  good: CheckCircle,
  fair: Lightbulb,
  'needs-clarity': PencilSimpleLine
};

export function QualityLevelIcon({ level, className = 'h-3.5 w-3.5' }) {
  const Icon = LEVEL_ICONS[level?.id] || Lightbulb;
  return <Icon className={className} aria-hidden="true" />;
}

export default QualityLevelIcon;
