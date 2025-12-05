import { useReducedMotion } from "../../hooks/useReducedMotion";

export function NoFiltersIllustration({ className = "" }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={`relative ${className}`}>
      <picture>
        <source
          srcSet="/images/illustrations/empty-states/no-filters-match.webp"
          type="image/webp"
        />
        <img
          src="/images/illustrations/empty-states/no-filters-match.png"
          alt=""
          role="presentation"
          loading="lazy"
          decoding="async"
          className={`
            w-full max-w-xs mx-auto opacity-80
            ${prefersReducedMotion ? "" : "animate-pulse-slow"}
          `}
        />
      </picture>
    </div>
  );
}
