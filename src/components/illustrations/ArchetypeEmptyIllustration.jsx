import { useReducedMotion } from "../../hooks/useReducedMotion";

export function ArchetypeEmptyIllustration({ className = "" }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={`relative ${className}`}>
      <img
        src="/images/illustrations/empty-states/archetype-empty.png"
        alt=""
        role="presentation"
        className={`
          w-full max-w-sm mx-auto
          ${prefersReducedMotion ? "" : "animate-float-gentle"}
        `}
      />
    </div>
  );
}
