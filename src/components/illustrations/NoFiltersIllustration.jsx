import { useReducedMotion } from "../../hooks/useReducedMotion";

export function NoFiltersIllustration({ className = "" }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={`relative ${className}`}>
      <img
        src="/images/illustrations/empty-states/no-filters-match.png"
        alt=""
        role="presentation"
        className={`
          w-full max-w-xs mx-auto opacity-80
          ${prefersReducedMotion ? "" : "animate-pulse-slow"}
        `}
      />
    </div>
  );
}
