import { useReducedMotion } from "../../hooks/useReducedMotion";

function BadgeWrapper({ src, alt, className = "", ...rest }) {
  const prefersReducedMotion = useReducedMotion();
  const webpSrc = src.replace(/\.png$/, ".webp");

  return (
    <div className={`relative inline-block ${className}`} {...rest}>
      <picture>
        <source srcSet={webpSrc} type="image/webp" />
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={`
            w-full h-full object-contain
            ${prefersReducedMotion ? "" : "animate-float-gentle"}
          `}
        />
      </picture>
    </div>
  );
}

export function FirstReadingBadge({ className, ...rest }) {
  return <BadgeWrapper src="/images/illustrations/badges/first-reading.png" alt="First Reading" className={className} {...rest} />;
}

export function TenReadingsBadge({ className, ...rest }) {
  return <BadgeWrapper src="/images/illustrations/badges/ten-readings.png" alt="10 Readings" className={className} {...rest} />;
}

export function FiftyReadingsBadge({ className, ...rest }) {
  return <BadgeWrapper src="/images/illustrations/badges/fifty-readings.png" alt="50 Readings" className={className} {...rest} />;
}

export function StreakBadge({ className, ...rest }) {
  return <BadgeWrapper src="/images/illustrations/badges/streak-fire.png" alt="Streak" className={className} {...rest} />;
}

export function MasteryBadge({ className, ...rest }) {
  return <BadgeWrapper src="/images/illustrations/badges/mastery-glow.png" alt="Mastery" className={className} {...rest} />;
}
