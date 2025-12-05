import { useReducedMotion } from "../../hooks/useReducedMotion";

export function ArchetypeEmptyIllustration({ className = "" }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={`relative ${className}`}>
      <picture>
        <source
          srcSet="/images/illustrations/empty-states/archetype-empty.webp"
          type="image/webp"
        />
        <img
          src="/images/illustrations/empty-states/archetype-empty.png"
          alt=""
          role="presentation"
          loading="lazy"
          decoding="async"
          className={`
            w-full max-w-sm mx-auto
            ${prefersReducedMotion ? "" : "animate-float-gentle"}
          `}
        />
      </picture>
    </div>
  );
}
