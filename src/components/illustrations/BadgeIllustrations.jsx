import { useReducedMotion } from "../../hooks/useReducedMotion";
 
function BadgeWrapper({ src, alt, className = "", ...rest }) {
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <div className={`relative inline-block ${className}`} {...rest}>
      <img
        src={src}
        alt={alt}
        className={`
          w-full h-full object-contain
          ${prefersReducedMotion ? "" : "animate-float-gentle"}
        `}
      />
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
