import { useReducedMotion } from "../../hooks/useReducedMotion";

export function EmptyJournalIllustration({ className = "" }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={`relative ${className}`}>
      <img
        src="/images/illustrations/empty-states/empty-journal.png"
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
