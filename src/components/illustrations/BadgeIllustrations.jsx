import { useReducedMotion } from '../../hooks/useReducedMotion';

const BADGE_VARIANT_SUFFIX = Object.freeze({
  default: '',
  compact: '-compact'
});

function buildBadgeSources(baseName, size = 'default') {
  const suffix = BADGE_VARIANT_SUFFIX[size] || BADGE_VARIANT_SUFFIX.default;

  return {
    png: `/images/illustrations/badges/${baseName}${suffix}.png`,
    webp: `/images/illustrations/badges/${baseName}${suffix}.webp`
  };
}

function BadgeWrapper({ sources, alt, className = '', ...rest }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={`relative inline-block ${className}`} {...rest}>
      <picture>
        <source srcSet={sources.webp} type="image/webp" />
        <img
          src={sources.png}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={`
            w-full h-full object-contain
            ${prefersReducedMotion ? '' : 'animate-float-gentle'}
          `}
        />
      </picture>
    </div>
  );
}

export function FirstReadingBadge({ className, size = 'default', ...rest }) {
  return <BadgeWrapper sources={buildBadgeSources('first-reading', size)} alt="First Reading" className={className} {...rest} />;
}

export function TenReadingsBadge({ className, size = 'default', ...rest }) {
  return <BadgeWrapper sources={buildBadgeSources('ten-readings', size)} alt="10 Readings" className={className} {...rest} />;
}

export function FiftyReadingsBadge({ className, size = 'default', ...rest }) {
  return <BadgeWrapper sources={buildBadgeSources('fifty-readings', size)} alt="50 Readings" className={className} {...rest} />;
}

export function StreakBadge({ className, size = 'default', ...rest }) {
  return <BadgeWrapper sources={buildBadgeSources('streak-fire', size)} alt="Streak" className={className} {...rest} />;
}

export function MasteryBadge({ className, size = 'default', ...rest }) {
  return <BadgeWrapper sources={buildBadgeSources('mastery-glow', size)} alt="Mastery" className={className} {...rest} />;
}
